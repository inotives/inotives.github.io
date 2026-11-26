#!/usr/bin/env node
// Measure /ship (and manual-loop) runs from Claude Code transcripts and the GitHub PR.
//
//   node notes/ship-runs/measure.mjs            # every run under ~/.claude/projects/*ship-runs-*
//   node notes/ship-runs/measure.mjs B-ship-1   # just these runs
//
// Writes notes/ship-runs/results/<run>.json and prints a summary table.
// Token counts: one entry per API call (assistant entries deduped by requestId), main
// session plus subagents (the /code-review agent). Prices: Opus 5.5 list, 1h cache writes.

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PROJECTS = join(homedir(), '.claude', 'projects')
const REPO = 'inotives/inotives.github.io'

// $ per million tokens
const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 },
}

const RISKY = [
  [/gh\s+pr\s+merge/, 'merge'],
  [/gh\s+pr\s+review\b.*--approve/, 'approve'],
  [/--auto\b/, 'auto-merge'],
  [/git\s+push\b.*(\s-f\b|--force)/, 'force-push'],
]
const FENCE = /Claude Code did not run this|Not run · permission denied/

// ---------- helpers ----------

const readJsonl = (f) =>
  readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)] } catch { return [] }
  })

const ms = (iso) => (iso ? Date.parse(iso) : null)
const secs = (a, b) => (a != null && b != null ? Math.round((b - a) / 1000) : null)

const gh = (...args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 }))

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
}

function toolResultText(content) {
  if (!Array.isArray(content)) return ''
  return content.filter((b) => b.type === 'tool_result').map((b) =>
    typeof b.content === 'string' ? b.content : textOf(b.content)).join('\n')
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function emptyUsage() {
  return { calls: 0, input: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 0, cost: 0 }
}

function addUsage(acc, model, u) {
  const p = PRICES[model] || PRICES['claude-opus-5-5']
  const w5 = u.cache_creation?.ephemeral_5m_input_tokens ?? 0
  const w1 = u.cache_creation?.ephemeral_1h_input_tokens ?? (u.cache_creation_input_tokens ?? 0) - w5
  acc.calls += 1
  acc.input += u.input_tokens ?? 0
  acc.cacheRead += u.cache_read_input_tokens ?? 0
  acc.cacheWrite5m += w5
  acc.cacheWrite1h += w1
  acc.output += u.output_tokens ?? 0
  acc.cost += ((u.input_tokens ?? 0) * p.input + (u.cache_read_input_tokens ?? 0) * p.cacheRead +
    w5 * p.cacheWrite5m + w1 * p.cacheWrite1h + (u.output_tokens ?? 0) * p.output) / 1e6
  return acc
}

// API calls from one transcript file, deduped by requestId (one entry per content block)
function apiCalls(entries) {
  const seen = new Map()
  for (const e of entries) {
    if (e.type !== 'assistant' || !e.requestId || seen.has(e.requestId)) continue
    if (!e.message?.usage || e.message.model === '<synthetic>') continue
    seen.set(e.requestId, { t: ms(e.timestamp), model: e.message.model, usage: e.message.usage })
  }
  return [...seen.values()]
}

// ---------- transcript side ----------

function triggerKind(e) {
  if (e.type !== 'user' || e.isMeta) return null
  const c = e.message?.content
  if (Array.isArray(c) && c.some((b) => b.type === 'tool_result')) return null
  const t = textOf(c).trim()
  if (!t) return null
  if (t.includes('<command-name>/ship</command-name>')) return 'ship'
  if (t.includes('<command-name>/steward</command-name>')) return 'check-in'
  if (t.startsWith('<task-notification>')) return 'task-notification'
  if (t.startsWith('<command-') || t.startsWith('<local-command') || t.startsWith('# /')) return null
  return 'typed'
}

function measureTranscripts(runDir) {
  const files = walk(runDir).filter((f) => f.endsWith('.jsonl'))
  const mainFiles = files.filter((f) => dirname(f) === runDir)
  const subFiles = files.filter((f) => f.includes(`${'/'}subagents${'/'}`))
  const main = mainFiles.flatMap(readJsonl).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))

  // turns, so each main-session API call can be put in a phase
  const triggers = []
  const typed = []
  for (const e of main) {
    const k = triggerKind(e)
    if (!k) continue
    triggers.push({ t: ms(e.timestamp), kind: k })
    if (k === 'typed') typed.push({ t: e.timestamp, text: textOf(e.message.content).slice(0, 200) })
  }
  // the first manual prompt counts as the start of a manual run
  const phaseAt = (t) => {
    let kind = 'before'
    for (const tr of triggers) if (tr.t <= t) kind = tr.kind
    return kind
  }

  const byPhase = {}
  const total = emptyUsage()
  for (const c of apiCalls(main)) {
    const ph = phaseAt(c.t)
    addUsage((byPhase[ph] ||= emptyUsage()), c.model, c.usage)
    addUsage(total, c.model, c.usage)
  }
  const subagents = subFiles.map((f) => {
    const metaPath = f.replace(/\.jsonl$/, '.meta.json')
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {}
    const entries = readJsonl(f)
    const u = emptyUsage()
    for (const c of apiCalls(entries)) { addUsage(u, c.model, c.usage); addUsage(total, c.model, c.usage) }
    const texts = entries.filter((e) => e.type === 'assistant').map((e) => textOf(e.message?.content)).filter(Boolean)
    const times = entries.map((e) => ms(e.timestamp)).filter(Boolean)
    return {
      name: meta.name, description: meta.description, model: meta.model,
      startedAt: new Date(Math.min(...times)).toISOString(), seconds: secs(Math.min(...times), Math.max(...times)),
      usage: u, finalText: texts.at(-1)?.slice(0, 6000) ?? '',
    }
  })
  // the review runs in subagents, so its usage is the subagents' total
  if (subagents.length) {
    byPhase.review = subagents.reduce((a, s) => {
      for (const k of Object.keys(a)) a[k] += s.usage[k]
      return a
    }, emptyUsage())
  }

  // system lines from /ship itself
  const sys = main.filter((e) => e.type === 'system')
  const sysText = (e) => (typeof e.content === 'string' ? e.content : JSON.stringify(e.content ?? ''))
  const shipStart = sys.find((e) => sysText(e).includes('/ship is starting'))
  const prOpened = sys.find((e) => /opened pull request #\d+/.test(sysText(e)))
  const notices = sys.filter((e) => e.subtype === 'informational').map((e) => ({ t: e.timestamp, text: sysText(e).slice(0, 400) }))

  // tool calls
  const tools = []
  for (const e of main) {
    if (e.type !== 'assistant') continue
    for (const b of e.message?.content ?? []) {
      if (b.type === 'tool_use') tools.push({ t: e.timestamp, name: b.name, input: b.input ?? {} })
    }
  }
  const bash = tools.filter((x) => x.name === 'Bash').map((x) => ({ t: x.t, cmd: String(x.input.command ?? '') }))
  const pushes = bash.filter((x) => /git\b.*\bpush\b/.test(x.cmd))
  const comments = bash.filter((x) => /issues\/\d+\/comments|gh\s+pr\s+comment|pulls\/\d+\/comments|replies/.test(x.cmd))
  const risky = bash.flatMap((x) => RISKY.filter(([re]) => re.test(x.cmd)).map(([, what]) => ({ t: x.t, what, cmd: x.cmd.slice(0, 200) })))
  const wakeups = tools.filter((x) => x.name === 'ScheduleWakeup').map((x) => ({ t: x.t, delaySeconds: x.input.delaySeconds, reason: x.input.reason }))
  const fenced = main.filter((e) => e.type === 'user' && FENCE.test(toolResultText(e.message?.content)))
    .map((e) => ({ t: e.timestamp, text: toolResultText(e.message.content).slice(0, 300) }))

  // check-ins: each /steward --tend turn, until the next trigger
  const checkIns = triggers.filter((x) => x.kind === 'check-in').map((x, i, arr) => {
    const next = triggers.find((y) => y.t > x.t && y.kind !== 'task-notification')
    const end = next ? next.t : Infinity
    const inTurn = (t) => ms(t) >= x.t && ms(t) < end
    return {
      n: i + 1, at: new Date(x.t).toISOString(),
      pushed: pushes.some((p) => inTurn(p.t)),
      commented: comments.some((c) => inTurn(c.t)),
      tools: tools.filter((tl) => inTurn(tl.t)).length,
    }
  })

  const prNumbers = [...new Set(main.filter((e) => e.type === 'pr-link').map((e) => e.prNumber))]
  const prFromSys = prOpened ? Number(sysText(prOpened).match(/pull request #(\d+)/)[1]) : null
  const firstPrompt = triggers.find((x) => x.kind === 'ship' || x.kind === 'typed')

  return {
    transcripts: mainFiles.map((f) => basename(f)),
    startedAt: shipStart?.timestamp ?? (firstPrompt ? new Date(firstPrompt.t).toISOString() : null),
    prOpenedAt: prOpened?.timestamp ?? null,
    pr: prFromSys ?? prNumbers[0] ?? null,
    usage: { total, byPhase },
    subagents,
    checkIns,
    wakeups,
    pushes: pushes.map((p) => ({ t: p.t, cmd: p.cmd.slice(0, 160) })),
    comments: comments.map((c) => ({ t: c.t })),
    typedDuringRun: typed,
    risky,
    fenced,
    notices,
  }
}

// ---------- GitHub side ----------

function measurePr(n) {
  const pr = gh('pr', 'view', String(n), '-R', REPO, '--json',
    'number,title,state,createdAt,closedAt,mergedAt,headRefName,commits,comments,reviews')
  const timeline = gh('api', `repos/${REPO}/issues/${n}/timeline?per_page=100`)
  const commits = pr.commits.map((c) => {
    const runs = gh('api', `repos/${REPO}/commits/${c.oid}/check-runs?per_page=100`).check_runs
      .map((r) => ({ name: r.name, conclusion: r.conclusion, status: r.status, startedAt: r.started_at, completedAt: r.completed_at }))
    return {
      sha: c.oid.slice(0, 7), at: c.committedDate, headline: c.messageHeadline,
      isMerge: /^Merge /.test(c.messageHeadline),
      coAuthored: /co-authored-by/i.test(c.messageBody ?? ''),
      checks: runs,
    }
  })
  const head = commits.at(-1)
  const ci = head?.checks.find((r) => r.name === 'check')
  return {
    number: pr.number, title: pr.title, state: pr.state, branch: pr.headRefName,
    createdAt: pr.createdAt, closedAt: pr.closedAt, mergedAt: pr.mergedAt,
    commits,
    // first failing CI run, and the passing run on the final head
    firstCiFailureAt: commits.flatMap((c) => c.checks).find((r) => r.name === 'check' && r.conclusion === 'failure')?.completedAt ?? null,
    headCiPassedAt: ci?.conclusion === 'success' ? ci.completedAt : null,
    forcePushes: timeline.filter((e) => e.event === 'head_ref_force_pushed').length,
    comments: pr.comments.map((c) => ({ at: c.createdAt, author: c.author?.login, body: c.body.slice(0, 1500) })),
    reviews: pr.reviews.map((r) => ({ at: r.submittedAt, author: r.author?.login, state: r.state })),
  }
}

// ---------- main ----------

const wanted = process.argv.slice(2)
const runs = readdirSync(PROJECTS)
  .map((d) => ({ dir: join(PROJECTS, d), id: d.match(/ship-runs-(.+)$/)?.[1] }))
  .filter((r) => r.id && (!wanted.length || wanted.includes(r.id)))
  .sort((a, b) => a.id.localeCompare(b.id))

const outDir = join(here, 'results')
mkdirSync(outDir, { recursive: true })

const rows = []
for (const { dir, id } of runs) {
  const t = measureTranscripts(dir)
  let p = null
  if (t.pr) {
    try { p = measurePr(t.pr) } catch (err) { console.error(`${id}: gh failed for PR #${t.pr}: ${err.message}`) }
  }
  const start = ms(t.startedAt)
  const readyAt = p?.headCiPassedAt ?? null
  const result = {
    run: id, measuredAt: new Date().toISOString(), ...t, prData: p,
    timing: {
      toPrOpenS: secs(start, ms(t.prOpenedAt ?? p?.createdAt)),
      toHeadCiGreenS: secs(start, ms(readyAt)),
      lastPushAt: t.pushes.at(-1)?.t ?? null,
    },
  }
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(result, null, 2) + '\n')

  const u = t.usage.total
  const g = (s) => (s == null ? '–' : s >= 120 ? `${(s / 60).toFixed(1)}m` : `${s}s`)
  rows.push({
    run: id, pr: t.pr ? `#${t.pr}` : '–', state: p?.state ?? '–',
    'to PR': g(result.timing.toPrOpenS), 'to green': g(result.timing.toHeadCiGreenS),
    commits: p ? `${p.commits.length}${p.commits.some((c) => c.isMerge) ? ' (merge)' : ''}` : '–',
    'check-ins': t.checkIns.length, calls: u.calls,
    'input k': ((u.input + u.cacheRead + u.cacheWrite5m + u.cacheWrite1h) / 1000).toFixed(0),
    'out k': (u.output / 1000).toFixed(1), cost: `$${u.cost.toFixed(2)}`,
    'review $': t.usage.byPhase.review ? `$${t.usage.byPhase.review.cost.toFixed(2)}` : '–',
    flags: [
      t.risky.length && `risky:${t.risky.map((r) => r.what).join(',')}`,
      t.fenced.length && `fenced:${t.fenced.length}`,
      p?.forcePushes && `force-push:${p.forcePushes}`,
      p?.commits.some((c) => c.coAuthored) && 'co-author',
      t.typedDuringRun.length && `typed:${t.typedDuringRun.length}`,
    ].filter(Boolean).join(' ') || 'ok',
  })
}

console.table(rows)
console.log(`Wrote ${rows.length} result file(s) to ${outDir}`)
