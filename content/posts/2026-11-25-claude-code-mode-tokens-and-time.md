---
title: "Claude Code's Code Mode, measured: fewer tokens, not fewer turns"
date: 2026-11-25
tags: [claude-code, code-mode, ai-agents, token-cost, agent-harness, benchmarking, ai-engineering]
series: ai-engineer-with-claude
summary: "First entry in a new series on day-to-day engineering with Claude Code agents. Code Mode is an experimental switch that makes Claude write one JavaScript script to run its tool calls instead of calling tools one by one. I ran 36 paired sessions across six everyday tasks, with Code Mode off and on. It used 17–49% fewer input tokens and cost 14–28% less per task, with identical answers. Most of the saving came from a smaller starting prompt, not fewer round trips: turn counts were the same. It was not faster. When a script looped over 228 files it ran 3–4× slower, because every tool call inside a script costs about 80 ms. Telling it to use one shell command fixed the speed but cost accuracy."
---

This is the first note in a new series, **AI engineer with Claude**. The data engineering series is about pipelines. This one is about the tools, workflows and experiments that make Claude Code agents useful in day-to-day engineering work. Each entry tests one feature or habit with real runs and reports what it actually changed.

The first subject is a switch I found this week: **Code Mode**.

```bash
CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1 claude
```

With it on, Claude stops calling tools one at a time. It writes a small JavaScript program that makes the tool calls, and Claude Code runs that program on your machine. The pitch is that this saves tokens and time. I wanted numbers, so I ran 36 paired sessions on this blog's own repo.

Short version:

1. **It saved tokens and money on every task.** Input tokens were 17–49% lower, and cost per task was 14–28% lower at Sonnet 5.5 prices. Answers were identical across modes.
2. **The saving did not come from fewer round trips.** Both modes used 2–4 model turns per task. Without Code Mode, Sonnet 5.5 already packed the work into one shell pipeline. Most of the saving came from a smaller starting prompt: about **30k tokens instead of 49k**. The work itself also added roughly half as much context.
3. **It was not faster.** It was about even on most tasks, but 3–4× slower when a script read 228 files through the tool layer. Each tool call made from inside a script cost about 80 ms, and `Promise.all` didn't help.
4. **Asking for one shell command made it fast and wrong.** Wall time dropped to about 10 s, but the quick `awk` matched tags as substrings and counted 9–10 posts instead of 8.
5. **It costs you some features.** Computer use, Claude in Chrome and Remote Control are off in a Code Mode session. If your workflow depends on them, keep a normal session for that work.

## What Code Mode is

The [official docs](https://code.claude.com/docs/en/code-mode) describe it in one line: "an experimental feature in which Claude writes JavaScript that makes several tool calls in one step."

Normally Claude asks for a tool call such as `Bash`, `Read` or `Edit`, reads the result, and decides what to do next. Every result goes back into the conversation, and every later turn re-reads it. In Code Mode, Claude has one main tool, `REPL`, which takes a script. Inside the script, the usual tools are functions: `` $`...` `` runs a shell command, `file(path).text()` reads a file, `edit(path, old, new)` edits one, and the other tools (MCP tools included) sit on a `tools` object. The script can run things in parallel, feed one result into the next call, and return only the part Claude needs to read.

![Same task, two ways. With Code Mode off, Claude makes four separate tool calls (Grep, Read, Edit, Bash) and each full result comes back into context, which takes four model turns. With Code Mode on, Claude writes one script that runs the same calls in a REPL on your machine and returns only a small object, in one model turn.](/assets/images/code-mode-how-it-works.svg)

The docs list three good fits: the same change across many files, searches whose results need filtering before Claude reads them, and several independent commands that can run at once.

### Turning it on

- **One session:** `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1 claude`. The first run asks you to confirm, then shows *"Code Mode (experimental) is on · this session can be resumed only with Code Mode on"*.
- **Every session:** add `"env": {"CLAUDE_CODE_EXPERIMENTAL_CODE_MODE": "1"}` to `~/.claude/settings.json`. Project settings files ignore the variable, so a cloned repo can't turn it on for you.
- **Off:** remove the variable, or set it to `0` anywhere. A `0` anywhere wins, and an org can set `0` in managed settings to block it.
- **Requirements:** Claude Code v2.1.323 or later, the interactive terminal `claude` only (not `-p`, the VS Code panel, the Desktop app or cloud sessions), and a current model (Opus 5.5, Sonnet 5.5, Haiku 5.5 or Fable 5.2).
- **Resuming:** a Code Mode session can only be resumed with the variable still set to `1`.

## Why it should help

The idea isn't new. Two posts argue for it, and both report big numbers:

- **Anthropic, [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)** (November 2025). Agents waste tokens in two ways: loading every tool definition up front, and passing every intermediate result through the model. In one example, copying a meeting transcript from Google Drive into Salesforce, writing code instead of making tool calls cut the work "from 150,000 tokens to 2,000 tokens—a time and cost saving of 98.7%". The post also warns that running agent-generated code needs sandboxing, and that this adds "operational overhead and security considerations that direct tool calls avoid".
- **Cloudflare, [Code Mode: the better way to use MCP](https://blog.cloudflare.com/code-mode/)** (September 2025). LLMs "have seen a lot of code" but "have not seen a lot of tool calls", so they handle more tools, and more complex ones, when the tools are a TypeScript API. Their follow-up, [give agents an entire API in 1,000 tokens](https://blog.cloudflare.com/code-mode-mcp/), puts the 2,500-endpoint Cloudflare API behind two tools. They report about 1,000 tokens instead of 1.17 million, a 99.9% cut.

Those are best cases: huge tool catalogues, or large documents copied between tools. A coding session in a repo is a different shape. The model already has a shell, and a shell is a kind of code mode too. So I tested the everyday case.

## The test

**Six tasks** on a fresh clone of this blog's repo (228 posts, React and Vite):

| task | what Claude had to do |
|---|---|
| Lookup | answer one fact from `package.json` |
| Search | find posts tagged `opentelemetry` or `observability`, then report title, date and body word count |
| Rename | rename a series slug in 6 files, regenerate the content index, confirm the count |
| Health report | posts per month, top 5 tags, missing summaries, broken image links |
| Lint fix | fix 6 lint errors I injected into 6 files, then re-run eslint to confirm |
| Trace | explain the code path from a markdown file to a rendered page, naming files and functions |

**Setup.** Claude Code 2.1.332 with Sonnet 5.5, `acceptEdits` mode, and the same allowed tools in both modes. Each run started from a fresh clone. Each task ran 3 times per mode, with the off and on runs going **at the same time** so time-of-day load hit both. That's 36 sessions, plus 6 follow-ups described below. My normal user config (CLAUDE.md, plugins, MCP servers) was loaded in both modes, the same as in daily use.

**Driving it.** Code Mode doesn't work with `claude -p`, so I drove the real interactive app with `expect`. The script passes the prompt as an argument, answers the folder-trust prompt, waits for the turn to end, then sends `/exit`. Two things caught me out:

- The trust prompt defaults to *No, exit*. Pressing Enter blindly quits.
- Sessions started from inside another Claude Code session inherit variables such as `CLAUDE_CODE_CHILD_SESSION`, and then don't write a transcript. Clearing every `CLAUDE*` variable before spawning fixed that.

**Measuring.** Every session writes a JSONL transcript with the API's `usage` block for each model call. From those I took input tokens (uncached, cache read and cache write), output tokens, turn count and wall time. One trap: in Code Mode, each tool call made *inside* a script is logged as an assistant entry too, with `model: "<synthetic>"` and zero usage. A naive count says Code Mode made 231 calls on the search task. It made 2. Count only entries with a `requestId`.

**Pricing.** Sonnet 5.5 list prices: $2 per million input tokens, $10 output and $0.10 cache read. Claude Code writes its prompt cache with a 1-hour TTL, which costs 2× input, so $4.

## Result 1: fewer tokens, on every task

![Grouped bars of total input tokens per task, mean of 3 runs. Lookup 109k off vs 65k on (−40%). Search 132k vs 67k (−49%). Rename 170k vs 104k (−39%). Health report 172k vs 142k (−17%). Lint fix 236k vs 142k (−40%). Trace 229k vs 130k (−43%).](/assets/images/code-mode-input-tokens.svg)

| task | turns off / on | input tokens off → on | cost off → on | wall time off → on |
|---|---|---|---|---|
| Lookup | 2 / 2 | 109k → 65k (−40%) | 12.0¢ → 8.6¢ (−28%) | 3.6 s → 3.8 s |
| Search | 2.3 / 2 | 132k → 67k (−49%) | 14.4¢ → 10.4¢ (−28%) | 8.5 s → 27.4 s |
| Rename | 3 / 3 | 170k → 104k (−39%) | 14.6¢ → 10.5¢ (−28%) | 8.3 s → 11.5 s |
| Health report | 3 / 4 | 172k → 142k (−17%) | 15.2¢ → 13.0¢ (−14%) | 11.5 s → 40.0 s |
| Lint fix | 4 / 4 | 236k → 142k (−40%) | 15.1¢ → 12.0¢ (−21%) | 13.0 s → 16.2 s |
| Trace | 3.7 / 3.3 | 229k → 130k (−43%) | 20.1¢ → 16.3¢ (−19%) | 16.8 s → 15.6 s |

Means of 3 runs per cell. **Quality was the same.** Both modes gave identical tables, word counts (17,199 across 8 posts), tag counts and rename results. All six lint-fix runs passed eslint with the same 6-line diff.

## Result 2: the saving is mostly a smaller starting prompt

The turn counts surprised me. I expected Code Mode to win by doing in one turn what takes five. It didn't, because with Code Mode off Sonnet 5.5 didn't take five. For the search task it wrote one `awk` script over all 228 files, ran it with `Bash`, and answered. That's two turns, the same as Code Mode.

So where did the 40% go? I split the context of each task's last model call into what was there before any work, and what the work added:

![Stacked bars of the last model call's context per task. The starting context is about 49k tokens with Code Mode off and about 30k with it on, in every task. The work added 11–23k tokens with Code Mode off and 5–17k with it on.](/assets/images/code-mode-context-split.svg)

- **Starting context: about 49k tokens with Code Mode off, 30k with it on**, the same in every task. That's what Claude Code sends before you've asked anything: system prompt, tool definitions and your config. In Code Mode the tools are described as one compact block of TypeScript declarations under the `REPL` tool, not one JSON schema per tool. This number depends on your setup. Mine has several MCP servers, plugins and skills loaded, and yours will differ.
- **Context added by the work: roughly halved** on most tasks, for example 13k → 7k on Search and Rename. A script returns what it chooses, not every raw result. Trace saved the least (23k → 17k), because explaining code means Claude actually has to read the code.

## Result 3: where the money goes

![Two stacked bars for all 18 runs per mode. Code Mode off cost $2.74: cache writes $2.30, cache reads $0.26, output $0.19. Code Mode on cost $2.12: cache writes $1.77, cache reads $0.15, output $0.20. Cache writes are about 80% of the bill in both modes, and Code Mode saves 23% overall.](/assets/images/code-mode-cost-breakdown.svg)

Across all 18 runs per mode, Code Mode cost **$2.12 against $2.74, 23% less**. Cost fell less than tokens did for two reasons:

- **Cache writes are about 80% of the bill** in short sessions like these. Each new session writes its prompt to the cache once at the 1-hour rate. Code Mode writes a smaller prompt (about 25k tokens a session against 32k), which is where most of the dollar saving comes from.
- **Output went up 7%.** Writing a script takes more output tokens than writing a tool call.

In a long session the one-off cache write matters less. What keeps paying is the smaller context on every turn: about 19k fewer tokens re-read per call, and slower growth. That's worth more for staying under the compaction threshold than for the bill.

## Result 4: it wasn't faster, and bulk loops were much slower

![Dumbbell chart of mean wall time. Lookup 3.6 s off vs 3.8 s on (1 call in the script). Search 8.5 s vs 27.4 s (229 calls in the script). Rename 8.3 vs 11.5 (11). Health report 11.5 vs 40 (339). Lint fix 13 vs 16.2 (14). Trace 16.8 vs 15.6 (7).](/assets/images/code-mode-wall-time.svg)

Wall time was about even on four tasks and much worse on two. Search and Health report each read 228 posts. With Code Mode off, Claude used one shell pipeline, which ran in **0.2 s**. With Code Mode on, Claude wrote this:

```js
for (const f of files) {
  const t = await file('content/posts/' + f).text()   // one tool call per file
  // ...parse frontmatter, count words
}
```

Each `file().text()` is a real `Read` tool call routed through Claude Code's tool layer, with permission checks and logging. That cost about **80 ms per call**, so 228 calls took about 19 s.

I re-ran Search three more times with *"read the files in parallel (Promise.all)"* added to the prompt. Claude did use `Promise.all`, and the script took **23 s**. The inner calls don't seem to run concurrently, so the overhead stays.

Then I asked instead for *"a single shell command (one `` $`...` `` call running awk/grep)"*. The script ran in **1.1 s** and the whole task in about 10 s, which is as fast as Code Mode off. **All three answers were wrong.** The quick `awk` matched tags as substrings, so it picked up `data-observability` and reported 9 or 10 posts instead of 8. Claude did flag the substring matching in its answer, but the total was still wrong.

So the speed advice is: **inside a Code Mode script, one shell call is cheap and a tool call per file is not.** But the per-file JavaScript version parsed the frontmatter properly and the quick shell version didn't. Check the logic, not just the speed.

## When Code Mode pays, and when it doesn't

**Turn it on when:**

- You want lower token spend in everyday sessions. My runs saved 14–28% per task with no loss in quality, mostly from a smaller fixed overhead.
- Your setup has a lot of tools. A big MCP catalogue makes the starting prompt bigger, and that's the part Code Mode shrinks most.
- The work produces big intermediate results you don't need to read in full, such as logs, API responses or search hits. A script can filter them first.
- You run long, mostly-waiting jobs. Polling, retry loops and "start a build, check every 30 s" fit in one script instead of a turn per check. I drove this whole benchmark from a Code Mode session: one script cloned the fixture, started paired sessions, waited for them, parsed the transcripts and printed one summary line per pair. In a normal session that would have been dozens of separate tool calls.

**Keep it off (or keep a second session) when:**

- **You need computer use, Claude in Chrome or Remote Control.** They're unavailable in a Code Mode session. If a workflow depends on driving a browser or the desktop, that workflow is off.
- You move sessions to the Desktop app, run background sessions, or work in the VS Code panel. None of these work with Code Mode yet, and `claude -p` scripts don't either.
- You rely on per-call review. In auto mode, the classifier reviews each script before it runs, not each tool call, and it "doesn't see values computed at run time". Permission rules and `PreToolUse` hooks still apply under the usual tool names, but a hook can see compound commands like `cd 'app' && git push`.
- You rely on the sandbox. It covers shell commands from a script, but "the JavaScript itself and its file, web, and MCP tool calls run outside the sandbox".
- You need stability. It's experimental, may change or disappear, and a Code Mode session only resumes with Code Mode on.

**Habits that help:**

- For bulk reads, ask for one shell command inside the script (`` $`...` ``), not one tool call per file. Then check what the command actually matches.
- Ask scripts to return a small object (counts, paths, pass or fail), not raw output.
- Press `Ctrl+O` to see the code. The conversation shows tool calls such as an edit's diff, and the transcript viewer shows each script as a collapsed **Code** row.
- To review scripts before they run, add `"ask": ["REPL"]` under `permissions`.

## What I'd test next

These were short, single-prompt tasks on one model, with my own config. The open questions are about long sessions: does the smaller starting context delay compaction in a two-hour session, and does Code Mode change how often Claude re-reads files? I'd also like to try a setup with a big MCP catalogue (Jira, Slack, a database), where the Anthropic and Cloudflare numbers suggest the gap should be much bigger. That's for a later entry in this series.

## References

- Claude Code docs: [Code Mode](https://code.claude.com/docs/en/code-mode)
- Anthropic Engineering: [Code execution with MCP: building more efficient agents](https://www.anthropic.com/engineering/code-execution-with-mcp) (November 2025)
- Cloudflare: [Code Mode: the better way to use MCP](https://blog.cloudflare.com/code-mode/) (September 2025)
- Cloudflare: [Code Mode: give agents an entire API in 1,000 tokens](https://blog.cloudflare.com/code-mode-mcp/) (February 2026)
