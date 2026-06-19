---
title: "My Agentic Development Stack: The Seven Tools That Actually Work Together"
date: 2026-06-19
tags: [agentic-stack, ai-agents, mattpocock-skills, context-mode, codegraph, agent-reach, playwright-mcp, strata-memory, git-conveyor, developer-tools, mcp]
summary: "After months of experimenting with AI coding agents, I've settled on a seven-tool stack that covers every layer of the workflow: engineering discipline, context optimization, code intelligence, internet access, browser automation, persistent memory, and multi-agent orchestration. Here's what each tool does and why they compose."
---

# My Agentic Development Stack: The Seven Tools That Actually Work Together

Everyone's building agents now. But the dirty secret is that most people's agents are flying blind — no memory, no context management, no internet access, no engineering discipline. They're just LLMs with a terminal attached.

I spent months assembling a stack that actually works. Not a wishlist. Not a "this would be nice." A real, daily-driver setup that handles every layer of agentic development. Here are the seven tools and why they matter together.

## The Stack at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                 Task Orchestration Layer                     │
│  git-conveyor (multi-agent pipeline + SQLite Kanban)        │
├─────────────────────────────────────────────────────────────┤
│                    Agent Interface Layer                     │
│  mattpocock/skills (discipline + workflows)                 │
├─────────────────────────────────────────────────────────────┤
│                    Context Management                        │
│  context-mode (98% reduction)  │  codegraph (code intel)    │
├─────────────────────────────────────────────────────────────┤
│                    External Access                           │
│  agent-reach (13+ platforms)   │  playwright-mcp (browser)  │
├─────────────────────────────────────────────────────────────┤
│                    Persistent Memory                         │
│  strata-memory (3-tier wiki + SQLite index)                 │
└─────────────────────────────────────────────────────────────┘
```

Each tool operates at a different abstraction level. Together, they eliminate most of the friction in AI-assisted development.

---

## 1. mattpocock/skills — The Discipline Layer

GitHub: [mattpocock/skills](https://github.com/mattpocock/skills)

This is the foundation. Without it, your agent is just vibes.

Matt Pocock's skills encode real engineering practices into composable markdown files. The agent reads them and follows the workflow. Key skills I use daily:

- `/grill-me` — relentless interview session before implementation. Forces alignment on design before a single line of code.
- `/tdd` — red-green-refactor loop. The agent writes a failing test first, then makes it pass.
- `/diagnosing-bugs` — disciplined diagnosis loop instead of random guessing.
- `/to-prd` — turns conversations into PRDs for planning.
- `/handoff` — compacts a session into a handoff document for the next agent.

**Why it matters**: The #1 failure mode of AI agents is misalignment. They write the wrong thing because nobody asked the right questions. The grilling sessions fix this.

**Install**: `npx skills@latest add mattpocock/skills`

---

## 2. context-mode — The Context Saver

GitHub: [mksglu/context-mode](https://github.com/mksglu/context-mode)

Your context window is a finite resource. Without context-mode, every MCP tool call dumps raw data into it. A Playwright snapshot costs 56 KB. Twenty GitHub issues cost 59 KB. After 30 minutes, 40% of your context is gone.

Context-mode sandboxes tool output. It runs code in a sandbox and only lets results enter context. A 315 KB web fetch becomes 5.4 KB. That's a 98% reduction.

Key capabilities:
- `ctx_execute` — run code in sandbox, only results enter context
- `ctx_fetch_and_index` — fetch web pages, index content, return summary
- `ctx_search` — search previously indexed content via FTS5
- Session continuity — survives compaction

**Why it matters**: Without this, long sessions are impossible. Context-mode extends sessions from ~30 minutes to ~3 hours.

**Install**: Plugin marketplace for Claude Code, or MCP server for other platforms.

---

## 3. codegraph — The Code Intelligence Layer

GitHub: [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)

Without codegraph, agents spawn Explore subagents that scan files with grep/glob/Read — burning tokens on every call. Codegraph gives them a pre-indexed knowledge graph instead.

It auto-syncs on file changes and provides instant access to symbol relationships, call graphs, and code structure. 20+ languages, framework-aware routes.

Key capabilities:
- `codegraph_explore` — answer any code question in one call
- `codegraph_node` — one symbol's full source + caller/callee trail
- `codegraph_search` — find symbols by name across codebase
- `codegraph_callers` — every call site of a function

**Why it matters**: ~47% fewer tokens, ~22% faster, ~58% fewer tool calls compared to no CodeGraph. For codebases with any complexity, it's a multiplier.

**Install**: `codegraph install` auto-configures for Claude Code, Cursor, Codex, etc.

---

## 4. agent-reach — The Internet Access Layer

GitHub: [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach)

When your agent needs to research something, browser automation is the wrong tool. It's slow, brittle, and wastes tokens on raw HTML parsing.

Agent-reach is a capability layer — not a browser automation tool. It routes to platform-specific CLIs that already handle auth, parsing, and rate limiting. One command for 13+ platforms:

- Twitter/X: `twitter search "query"`
- Reddit: `opencli reddit search "query"`
- YouTube: `yt-dlp --dump-json "URL"`
- Bilibili: `bili search "query"`
- Plus RSS, GitHub, LinkedIn, V2EX, XiaoHongShu, and more.

**Why it matters**: Multi-backend routing with automatic failover. If yt-dlp gets blocked, agent-reach switches to bili-cli automatically. Zero configuration for 6 platforms.

**Install**: `pip install agent-reach` + `agent-reach install`

---

## 5. playwright-mcp — The Browser Automation Layer

GitHub: [microsoft/playwright](https://github.com/microsoft/playwright)

Agent-reach handles reading. Playwright handles interacting.

When you need to fill out a form, click through a multi-step flow, test a SPA, or take a screenshot — that's browser automation territory. Playwright MCP gives AI agents full browser control through structured accessibility snapshots.

**Why it matters**: For UI testing and complex browser interactions, nothing else works. Agent-reach + Playwright is the hybrid approach — CLI tools for research, browser automation for interaction.

**Install**: `npx @playwright/mcp@latest`

---

## 6. strata-memory — The Memory Layer

GitHub: [inotives/strata-memory](https://github.com/inotives/strata-memory)

This is my own tool, born from a simple observation: agents need memory that persists across sessions, and markdown is the perfect format for it.

Strata-memory is a 3-tier wiki-like system:

```
1_draft → 2_knowledge → 3_intelligence
```

Markdown files are canonical. SQLite is a rebuildable derived index. No external database dependency.

Key capabilities:
- Three-tier lifecycle with safe promotion via `strata promote`
- SQLite FTS5 full-text search
- Templates for research drafts and entity pages
- Link review, tag review, privacy review

**Why it matters**: Agents interact naturally with markdown — it's their native format. You can read, edit, and version the vault directly. If the SQLite index corrupts, rebuild from markdown. Fully local-first.

**Install**: `~/.strata-memory` is the vault. `strata search` for retrieval.

---

## 7. git-conveyor — The Orchestration Layer

GitHub: [inotives/git-conveyor](https://github.com/inotives/git-conveyor)

The missing piece for multi-agent workflows.

Without git-conveyor, agents don't know what to work on, can't claim tasks atomically, and don't advance through a pipeline. It orchestrates a human PM with autonomous Coder and Reviewer agents.

```
┌─────────────────────────────────────────┐
│         Project Manager (human)         │
│  Scopes issues, prioritizes backlog    │
├─────────────────────────────────────────┤
│         SQLite Kanban (WAL mode)        │
│  Backlog → Ready → In Progress → Review │
├─────────────────────────────────────────┤
│  Coder Agent    │    Reviewer Agent     │
│  Claims tasks   │    Reviews PRs        │
│  Writes code    │    Runs hooks         │
│  Advances stage │    Approves/Blocks    │
└─────────────────────────────────────────┘
```

**Why it matters**: SQLite Kanban with WAL mode for race-condition safety across agents. Atomic task claiming. Stack-agnostic engine adapters for Claude, Codex, OpenCode, or custom agents.

**Install**: `npm run conveyor:init` scaffolds `.conveyor/` into any project.

---

## How They Compose: A Real Workflow

Here's what a typical day looks like:

1. PM scopes issues via git-conveyor, adds to SQLite Kanban
2. Coder agent polls Kanban, claims task atomically
3. Coder uses `/grill-me` (mattpocock) to align on requirements
4. Coder uses `agent-reach` to research the problem across platforms
5. Coder uses `context-mode` to sandbox web fetches (98% savings)
6. Coder uses `codegraph` to understand existing code
7. Coder writes code, pushes to branch
8. Reviewer agent claims review task, runs hooks (lint, test, build)
9. Reviewer uses `playwright-mcp` to verify UI changes
10. Reviewer approves or blocks with failure log
11. `/handoff` writes session to strata-memory for continuity
12. Next agent picks up from handoff log if needed

No human intervention except step 1 and approval gates.

---

## What I'd Do Differently

The stack isn't perfect. The missing pieces:

- **No unified auth**: Each tool has its own auth model
- **No team sharing**: Memory and code graphs are local, not shared
- **No visual regression**: Playwright-MCP doesn't do visual diff
- **No CI/CD integration**: Everything is local-first

But for a solo developer working with agents daily, this stack covers 90% of what I need. The other 10% is edge cases I'd rather not optimize for yet.

---

## References

- [mattpocock/skills](https://github.com/mattpocock/skills) — Engineering discipline and workflows for coding agents
- [context-mode](https://github.com/mksglu/context-mode) — MCP server for context window optimization (98% reduction)
- [codegraph](https://github.com/colbymchenry/codegraph) — Pre-indexed code knowledge graph for AI agents
- [Agent-Reach](https://github.com/Panniantong/Agent-Reach) — AI agent capability layer for multi-platform internet access
- [Playwright](https://github.com/microsoft/playwright) — Cross-browser automation framework (includes playwright-mcp)
- [strata-memory](https://github.com/inotives/strata-memory) — Local-first 3-tier persistent memory for agentic work
- [git-conveyor](https://github.com/inotives/git-conveyor) — Multi-agent task orchestration with SQLite Kanban
- [Loop Engineering: Stop Prompting Agents, Start Building Systems That Prompt Them](https://inotives.github.io/posts/2026-06-12-loop-engineering-patterns) — Background on the loop engineering pattern git-conveyor implements
