var e=`---
title: "Seven AI Coding Tools, One Year of Churn, and What I Actually Use"
date: 2026-06-07
tags: [ai-tools, cursor, zed, warp, terminal, tmux, coding-workflow, tool-comparison, editor-wars, antigravity, claude-code, codex-cli, opencode, mcp]
summary: "I spent a year rotating through seven AI-augmented development tools. This post covers what each does well, where each falls short, and how my actual workflow — CLI coding agents with skills, plugins, and MCP servers connecting to GitHub, Postgres, BigQuery, and more — shaped the tools that survived in my daily bag."
---

## Seven AI Coding Tools, One Year of Churn, and What I Actually Use

There's no shortage of AI-augmented editors and terminals right now. Every month brings a new one claiming to be the last editor you'll ever need. I tried most of them over the past year — not as a reviewer testing for an hour, but as a daily driver writing real code, running multi-agent workflows, and managing data pipelines.

Here's the thing though: my actual workflow isn't centered on an editor. It's centered on **CLI coding agents** — [Claude Code](https://claude.ai/code), [Codex CLI](https://github.com/openai/codex-cli), [opencode](https://opencode.ai), pi — running in a terminal. These agents carry skills, plugins, custom tools, and MCP server configurations that connect them to GitHub, Postgres, BigQuery, ClickHouse, Snowflake, and whatever else the task needs. The editor is secondary. It's where I review diffs, make manual corrections, and leave comments on agent-generated code.

With that bias established, here's what I learned about the seven tools I cycled through: Google Antigravity, VS Code, Cursor, plain terminal+tmux, Warp, Terax, and Zed.

**My top 3 IDE:** 

1) Zed — fastest, best 2x2 terminal for hosting agents, light on RAM, 
2) VS Code — unmatched diff review and extension ecosystem for manual correction work, 
3) Warp — best terminal for research flows and markdown-heavy sessions.

The rest fill specific niches or didn't make the cut. Read on for the full breakdown of why.

---

## Google Antigravity

[→ Antigravity](https://cloud.google.com/antigravity)

Antigravity is Google's autonomous agent platform — not an editor at all. You give it a project brief, it plans, writes code, runs tests, checks results, and iterates. Multi-agent orchestration baked in.

The upsides are real. For batch automation — refactor a module, migrate an API, fix a class of bugs across a repo — it's impressive. The agents self-correct, they explore the codebase, they don't need handholding.

But as a daily driver? It's not a terminal. You can't run a CLI agent in it, you can't configure MCP servers, you can't jump in and tweak a line the agent got wrong. The opaque execution model means you're watching an agent work and hoping it gets it right. And the resource usage is brutal: 5-8GB of RAM after a few iterations. On my 16GB machine, that's half the system gone to one tool.

**Antigravity is a batch automation platform. I keep it in mind for large-scale refactors, but my daily workflow is terminal-agent-centric, and Antigravity doesn't fit in that model.**

## VS Code

[→ code.visualstudio.com](https://code.visualstudio.com)

VS Code has the deepest extension ecosystem in the game — GitHub Copilot, Cline, Cody, and dozens of AI extensions. If you're looking for an AI-augmented editor, it's a solid choice.

But my AI agent workflow runs in the terminal, not through editor extensions. I found myself using VS Code primarily as a **diff viewer and manual correction tool** — reviewing what my CLI agents produced, leaving comments, making small edits. The built-in diff editor is excellent for this. The problem is the terminal: left/right splits only, no top/bottom. On a standard monitor you get three panes max, and when one of those needs to run a coding agent, another for tests, and a third for git, there's no room left for anything else.

The Electron tax is real too. VS Code is heavy, and with enough extensions it becomes a memory hog — ironic when you're running LLM-powered agents that already consume significant RAM.

**VS Code stays installed as my diff review and manual correction tool. Its terminal limitations prevent it from being the host for my agentic workflow.**

## Cursor

[→ cursor.com](https://cursor.com)

Cursor is a VS Code fork with deep AI integration at the editor level — tab-to-complete, multi-file editing, context-aware diffs, Composer 2.5. It's genuinely the gold standard for inline AI in an editor.

But Cursor's model is "the editor is the agent." My workflow is "the terminal is the agent host." I don't want an editor that writes code for me — I want a terminal where I can run Claude Code with a Postgres MCP, a GitHub MCP, a BigQuery MCP, and a skills directory, all configured independently of whatever editor I'm looking at. Cursor's AI is tied to Cursor. My agents are portable across terminals.

The privacy tradeoff and subscription cost are secondary concerns. The fundamental mismatch is paradigm: Cursor is an AI editor, and I don't use an AI editor as my primary tool.

**Cursor has the strongest AI editor experience I've used. But my workflow is terminal-agent-centric, not editor-agent-centric.**

## Terminal + tmux

[tmux → github.com/tmux/tmux](https://github.com/tmux/tmux)

This is the setup that aligns most closely with how I actually work. A terminal emulator, tmux for multiplexing, and CLI coding agents — Claude Code, Codex CLI, opencode, pi — each configured with their own set of skills, plugins, custom tools, and MCP servers.

The multi-terminal flexibility is unmatched. A 3x3 tmux grid gives you nine panes on a large display. In practice, a 2x3 or 3x2 layout works better:

| Pane | Purpose |
|------|---------|
| Top-left | Claude Code with GitHub MCP + skills directory |
| Top-center | Codex CLI running a parallel task |
| Top-right | opencode or pi for quick agent queries |
| Bottom-left | Terminal for git operations, builds |
| Bottom-center | MCP server logs, database connections |
| Bottom-right | scratch shell, quick commands |

Each CLI agent carries its own personality — different skills loaded, different MCP endpoints configured, different tool access levels. [Claude Code](https://claude.ai/code) might have the full suite (GitHub, Postgres, BigQuery, ClickHouse, Snowflake MCPs) for a data pipeline refactor. [Codex CLI](https://github.com/openai/codex-cli) might have a lighter config for quick codegen tasks. [opencode](https://opencode.ai) might handle project-level orchestration with its own plugin system.

The MCP layer is where the real power lives. When an agent can query your production Postgres, pull schema from ClickHouse, read issues from GitHub, and run queries against BigQuery — all within a single session — the quality of code it generates is radically different from an agent working with zero context about your infrastructure.

The tradeoffs are real though: no graphical diff view (you're piping diff output to the terminal or a separate tool), no file explorer, no integrated markdown preview. And switching between agent conversation threads means either multiple tmux panes or scrolling through terminal history.

**Terminal+tmux is the foundation of my daily workflow. The agent ecosystem — skills, plugins, tools, MCPs — lives in the terminal, not in any editor.**

## Warp

[→ warp.dev](https://www.warp.dev)

Warp is a GPU-accelerated terminal with built-in AI features — natural language to shell commands, smart autocomplete, agent mode for multi-step terminal workflows. The terminal itself is excellent: fast, modern UI, split panes, smart layout.

I found a surprising use case: Warp renders markdown well with basic editing, and its folder tree navigation makes it a solid environment for research workflows where agents produce markdown reports. It works well as a secondary terminal for those sessions.

For my primary coding workflow though, Warp falls short. It's proprietary and closed-source — you need to log in, and AI features send data to Warp servers. More importantly, running CLI coding agents in Warp means those agents' MCP configs, skills, and plugins all work fine (they're terminal-agnostic), but I lose the ability to deeply customize the terminal environment. And CLI agents like Claude Code already handle their own AI — I don't need my terminal to add another AI layer on top.

**Warp is a great terminal for research and markdown-heavy workflows. For coding, I prefer an open terminal I can fully control.**

## Terax

[→ terax.dev](https://terax.dev)

Terax is a lightweight AI-native terminal with an editor overlay. The concept aligns well with my workflow — a multi-agent diff system where AI agents propose, diff, and apply code changes directly in a terminal-editor hybrid view. The folder tree auto-refreshes when you \`cd\`.

But it's early. Small community, breaking changes, and a frustrating bug where the folder tree doesn't refresh when agents create new files (requires a \`cd\` out and back in). For a workflow where agents are constantly creating and modifying files, that friction kills flow.

The MCP and skills story is unclear too — Terax has its own agent system, but I don't know if I can point it at my existing Claude Code configs or opencode plugins. If I have to reconfigure everything, that's a non-starter.

**Terax has the right concept. It's not mature enough, and its agent ecosystem doesn't interoperate with my existing CLI agent configs.**

## Zed

[→ zed.dev](https://zed.dev)

Zed is the one that stuck. Written in Rust, it's fast — startup is instant, the UI is minimal, Vim mode is excellent. Here's how it fits into my terminal-agent-centric workflow:

The **2x2 split terminal grid** is the killer feature. I dedicate one terminal pane to my primary coding agent ([Claude Code](https://claude.ai/code) or [opencode](https://opencode.ai)), one to a secondary agent or MCP server logs, one to git operations, and one to a scratch shell. All four are visible at once, and I can jump between them without leaving the editor. This is the sweet spot — more panes than VS Code's left/right splits, fewer than a full tmux grid, and integrated into the editor view so I can see diffs and agent output simultaneously.

When an agent produces code changes, I review them in Zed's diff editor, make manual corrections or leave comments, then switch back to the agent terminal pane to iterate. The markdown preview renders agent-generated reports inline. Thread-per-agent means I can keep multiple agent conversations alive without losing context.

Zed doesn't care about my agent configs — and that's the point. My Claude Code skills directory, opencode plugins, and MCP server configurations all live outside the editor. They survive whether I'm in Zed, VS Code, or a raw tmux session. Zed is just the window I put them in.

The extension ecosystem is smaller than VS Code, and Linux support lags behind macOS. But for a workflow where the terminal hosts the agents and the editor handles review — Zed is the best host I've found.

**Zed is my daily editor. Not because of its AI features, but because its 2x2 terminal + fast diff review + markdown preview is the best host for my CLI agent workflow.**

## How the Workflow Actually Works

Putting it together, the daily loop looks like this:

1. **Configure agent context** — Each CLI agent ([Claude Code](https://claude.ai/code), [Codex CLI](https://github.com/openai/codex-cli), [opencode](https://opencode.ai), pi) has its own config directory with skills, plugins, tools, and MCP endpoint definitions. A project might need different agents for different tasks: the data pipeline agent gets Postgres + BigQuery + Snowflake MCPs, the code review agent gets GitHub MCP, the research agent gets web fetch and nothing else.

2. **Run agents in terminal** — The terminal (Zed's built-in or a tmux session) hosts multiple agents in parallel. Each pane runs one agent with its own configuration. The agents talk to MCP servers — querying databases, reading issues, running queries — and produce code or analysis.

3. **Review diffs** — Agent-generated changes land in the git working tree. I review them in the editor's diff view. This is where I catch the things agents consistently miss: naming convention violations, architectural mismatches, security considerations.

4. **Correct and iterate** — I make manual edits or leave comments in the code for the agent to fix on the next round. This feedback loop is where the quality comes from — not from the agent getting it right on the first try, but from the human-in-the-loop tightening the output.

5. **Push** — Once the diff is clean, it gets committed and pushed. The GitHub MCP closes related issues and links the PR.

The key insight: **the agents are the writers, the terminal is the workshop, the editor is the review desk.** No single tool owns the full pipeline.

## What Changed About My Workflow

A year ago, I was in VS Code with Copilot and a separate terminal window. The AI was a helper inside the editor. Today:

- **The terminal is the primary interface** — it hosts [Claude Code](https://claude.ai/code), [opencode](https://opencode.ai), and other CLI agents
- **Agent configs are portable** — skills directories, MCP JSON configs, and plugin manifests live in dotfiles, not in any editor
- **The editor is a review tool** — I reach for it when agents produce diffs that need human eyes
- **MCP servers are infrastructure** — GitHub, Postgres, BigQuery, ClickHouse, Snowflake are always connected; agents choose which to use based on the task
- **tmux is for fan-out** — when I need 6 agents working in parallel, tmux gives me the grid

The biggest shift: **I stopped looking for the perfect AI editor and started looking for the best terminal to host AI agents.** That changed which tools I care about.

## The Table

| Tool | Role in My Workflow | Multi-Terminal | Agent Config Portability | MCP/Infra Support | Resource Footprint |
|---|---|---|---|---|---|
| Antigravity | Batch automation only | No | None (locked-in) | Google-only | Very heavy |
| VS Code | Diff review + manual correction | Left/right splits | Portable (external) | Via terminal | Heavy |
| Cursor | Not in my workflow | VS Code-like | None (Cursor-specific AI) | Via terminal | Heavy |
| terminal+tmux | Primary agent host | Up to 3x3 grid | Fully portable | Yes | Minimal |
| Warp | Research terminal | Split panes | Portable (agnostic) | Via terminal | Medium |
| Terax | Watching, not using | Tabs + tree | Unknown | Unknown | Light |
| Zed | Daily agent host + review | 2x2 grid | Fully portable | Via terminal | Light |

## Final Thoughts

The AI developer tool landscape is still figuring out what the workflow actually looks like. Editor-first tools (Cursor, VS Code extensions) assume the AI is a feature of the editor. Terminal-first tools (Zed's terminal, tmux) assume the AI runs in the terminal and the editor is for review. Agent platforms (Antigravity) assume the AI replaces the human in the loop.

None of these assumptions is wrong. But for my work — data pipelines, multi-service architecture, infrastructure-connected coding — the terminal-agent model wins. The agents need to talk to databases, APIs, and repos through MCP servers. They need portable skill configurations. They need to run in parallel and produce diffs that a human reviews.

The tool that wins is the one that gets out of the way. For me, that's a terminal hosting portable agents, with a fast editor beside it for review. Zed happens to be the best terminal-with-editor package I've found for that. But if a better terminal came along tomorrow, I'd switch — my agents would come with me.

That's the real test of a tool in this era: **how much of my workflow does it own, and how much of it stays portable?** The less it owns, the more I trust it.
`;export{e as default};