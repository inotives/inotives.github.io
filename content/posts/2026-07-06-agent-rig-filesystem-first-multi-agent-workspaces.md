---
title: "Agent-Rig: Filesystem-First Multi-Agent Workspaces That Actually Catch Bugs"
date: 2026-07-06
tags: [agent-rig, multi-agent, planner-worker-reviewer, agentic-stack, developer-tools, cli]
summary: "Agent-rig scaffolds .agent-rig/ directories into project repos so agents share context via files, not APIs. After 48 tasks across two production projects, the planner-worker-reviewer pattern catches edge cases that single-agent workflows miss — pre-execution error handling gaps, stale documentation, and contract mismatches. Token cost increases ~2-3x, but the structured handoffs reduce rework."
series: building-ai-systems
---

# Agent-Rig: Filesystem-First Multi-Agent Workspaces That Actually Catch Bugs

Most multi-agent tools are orchestrators. They sit between you and the AI, routing requests, managing state, coordinating APIs. Agent-rig is not that. It's a TypeScript CLI that scaffolds a `.agent-rig/` directory into your project repo. Agents share context through files. No API lock-in, no orchestration layer, no middleware.

The idea is simple: make multi-agent workflows auditable by putting everything on the filesystem.

## What Agent-Rig Actually Does

Run `agent-rig init` in a project and it creates:

```
.agent-rig/
├── _shared/        # context, task files, session state, profiles
├── .creds/         # gitignored local secrets
├── <agent>/        # instructions.md, skills, logs
└── human/          # approval, unblock, override scripts
```

That's it. No daemon, no server, no background process. The CLI scaffolds the workspace, manages tasks as Markdown files, and prints status. You run your own AI subscription tools — Claude, Codex, OpenCode — in separate terminals, one per role. A typical setup uses tmux: one pane for the planner, one for the worker, one for the reviewer. Each agent reads and writes the same shared filesystem. Headless mode is planned for a future release once the workflow is fully tested.

The design decision that makes it work: every piece of state is a file. Task definitions are Markdown with YAML frontmatter. Status is a field in the file. Reviewer notes go under `## Notes` in the same file. Handoff logs are Markdown in `_shared/handoff_logs/`. If something goes wrong, you `git diff` the task file and see exactly what changed.

## The Planner-Worker-Reviewer Pattern

Agent-rig ships with built-in profiles: planner, worker, reviewer, researcher, writer. The pattern I've been using daily is the trinity — planner creates tasks, worker implements, reviewer inspects.

The planner writes task files with explicit scope, acceptance criteria, and implementation plans. The worker reads the task, implements the smallest working change, and marks it done. The reviewer reads the task contract and compares it against the implementation.

This is where the value lives. The reviewer is not a second pair of eyes doing the same thing the worker did. The reviewer has a different job: verify the contract is satisfied. That means checking things the worker's mental model doesn't cover.

## What the Reviewer Actually Catches

After 48 tasks across two production projects (agent-pipe: 25 tasks, market-pipe: 23 tasks), here are the edge cases the reviewer found that the worker missed:

**Pre-execution error handling.** The worker implemented failure modes for command failures, timeouts, and invalid output. The reviewer noticed that pre-execution failures — unknown job, invalid config — returned errors but left no run-history row. The Phase 4 contract required every attempted run to write a row. The failure happened before database insertion, so the worker didn't think of it as part of the task.

**Documentation staleness.** The worker completed all Phase 3 features. The reviewer checked the README and found it still said "Minimal local CLI scaffold for Agent Pipe Phase 2." Updating the summary was outside the worker's explicit scope, but the reviewer's job is to verify the phase is coherent.

**Runtime version mismatch.** The worker built a TypeScript CLI scaffold with all checks passing. The reviewer compared `package.json` against the project spec and found `engines.node >= 20` when the documentation targets Node.js 22 LTS. The scaffold worked, but contradicted the contract.

**Idempotent upsert verification.** The worker implemented CoinGecko raw row extraction with upsert. The reviewer verified that rerunning the same response updated rows instead of duplicating them — testing the idempotency contract from the consumer's perspective, not just the implementation's.

These are not hypothetical issues. They shipped as bugs in single-agent workflows. The reviewer catches them because the reviewer's job is explicitly to compare implementation against a written contract, not to write the code.

## The Token Cost Tradeoff

The multi-agent pattern costs more. Roughly 2-3x compared to a single agent doing everything:

- Planner creates task: ~5-10K tokens
- Worker implements: ~15-25K tokens
- Reviewer inspects: ~10-20K tokens
- Total per task: ~30-55K tokens

A single agent would spend ~10-20K tokens per task. The math seems straightforward — why pay 2-3x?

Because each reviewer return saves a full rework cycle. Across 48 tasks, 3-4 were returned to `ready` by the reviewer. Each return represents a bug that would have shipped, been caught in testing or production, and required another 15-25K tokens to fix. The rework savings bring the net cost increase down to roughly 1.8-2.8x.

The real justification isn't token math. It's that the bugs the reviewer catches are the kind that slip through single-agent self-review: contract violations, documentation drift, pre-execution edge cases. These are the bugs that show up weeks later when someone runs the code in a different context.

## What v0.1.3 Fixed

The 0.1.3 patch addressed workflow friction I hit during daily use:

- Added a `plan-tasks` skill to the planner profile for phase planning and task breakdowns. Before this, planning was manual Markdown editing.
- Reframed handoff usage around planner-owned cross-session resume notes. Previously, handoff logs were ambiguous — too much per-task paperwork, not enough strategic context.
- Added shared findings notes under `_shared/notes/` for worker and reviewer patterns, quirks, and out-of-norm events. These carry forward across sessions without polluting task files.
- Updated `agent-rig start` to show relevant resume context pointers for recent handoffs and findings notes.

The core task lifecycle didn't change. These are operational improvements that make the tool less friction-heavy in practice.

## When This Pattern Is Worth It

The planner-worker-reviewer overhead is justified for:

- Multi-phase projects where sequential complexity accumulates
- External integrations where API contracts must be satisfied
- Documentation that must stay in sync with code
- Any project where the reviewer's external viewpoint catches real issues

For trivial, single-file changes, the overhead is not justified. The sweet spot is medium-complexity tasks — 5 to 20 files, clear acceptance criteria — where the reviewer finds things the worker misses.

## The Filesystem-First Advantage

The biggest benefit isn't the multi-agent pattern. It's auditability. Every task is a file. Every review finding is a line in that file. Every status change is a git commit. When something goes wrong, you don't dig through API logs or orchestration state — you `git log` the task file.

This also makes handoffs between sessions trivial. The next agent reads the task files, checks status, reads reviewer notes, and picks up where the last one left off. No context reconstruction, no "what were we doing again?"

Agent-rig doesn't replace your AI tools. It gives them a shared workspace that makes multi-agent workflows debuggable.

## References

- [agent-rig GitHub](https://github.com/inotives/agent-rig) — Filesystem-first TypeScript CLI for multi-agent workspaces
- [@inotives/agent-rig on npm](https://www.npmjs.com/package/@inotives/agent-rig) — Install via `npm install -g @inotives/agent-rig`
- [v0.1.3 Release](https://github.com/inotives/agent-rig/releases/tag/v0.1.3) — Planning skills, handoff improvements, shared findings notes
- [agent-pipe](https://github.com/inotives/agent-pipe) — Data pipeline CLI with 25 tasks across 5 phases using planner-worker-reviewer
- [market-pipe](https://github.com/inotives/market-pipe) — Market data ingestion with 23 tasks across 4 phases using planner-worker-reviewer
- [My Agentic Development Stack](https://inotives.github.io/posts/2026-06-19-my-agentic-development-stack) — Full seven-tool stack overview
