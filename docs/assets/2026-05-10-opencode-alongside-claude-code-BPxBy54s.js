var e=`---
title: "OpenCode Alongside Claude Code: Two Agents, One Workflow"
date: 2026-05-10
tags: [opencode, claude-code, ai-agents, coding-agents, zen, big-pickle, codex, agent-agnostic, developer-tools]
summary: "How I use Claude Code for work and OpenCode for personal projects — the agent-agnostic model switching, free Zen models for research and organizing, and why this dual-agent setup works better than committing to one."
---

## OpenCode Alongside Claude Code

I run two AI coding agents daily. Claude Code for work at Flowdesk. OpenCode for my personal projects. They are not competitors in my setup — they serve different contexts with different constraints.

This note covers why I split them, what OpenCode brings that Claude Code does not, and the features that keep me coming back to OpenCode for personal work.

## The Split: Work vs Personal

At work, I use Claude Code. It is what the team uses, it integrates with our existing workflows, and the Anthropic API is what the company pays for. It makes sense for the job.

For my personal projects — this site, agent-memory workspace, crypto dashboards, research notes — I use OpenCode with a Codex subscription. The reasons are practical, not ideological:

- **Cost**: My personal projects do not justify an Anthropic API budget. Codex gives me access to capable coding models at a flat monthly rate.
- **Flexibility**: OpenCode is provider-agnostic. I can switch between models depending on the task — cheap fast models for quick edits, stronger models for complex refactors, free models for research and organizing.
- **Open-source**: I can inspect how the agent works, configure every detail, and extend it with skills, commands, and plugins.

## Free Zen Models for Daily Grind Work

OpenCode includes free models through Zen — no API key required. The one I use most is **Big Pickle**, the default free model. It is not the most capable model for coding, but it is good enough for the tasks that take up most of my agent interaction time.

What I use the free model for:

- **Research and reading**: Fetching documentation, comparing tools, summarizing web pages, answering quick questions about a library or API. These are high-volume, low-complexity queries where paying per token would add up fast.
- **Organizing local files**: Moving notes around, renaming files, cleaning up directory structures, sorting research into knowledge folders. Big Pickle handles bash commands and file operations without issue.
- **Drafting and editing**: Writing first drafts of articles (like this one), editing YAML frontmatter, maintaining the content index, formatting markdown. The prose quality is solid for technical writing.
- **Communication**: Drafting commit messages, README updates, issue descriptions. The model understands context well enough to produce clear, concise output.

There is a catch worth noting. Big Pickle is an open-source model, and like most free/open models, the prompts and data you send may be used for training. I do not send personal information, credentials, API keys, or proprietary code through it. The free model is fine for public research, documentation summaries, and file organization — nothing that would be a problem if it ended up in a training set.

That is also why I switch to Codex for actual coding sessions. Codex is a paid subscription with standard privacy terms — no training on your data, no prompt retention. When I need to build a React component, debug a data pipeline, or write a Python scraper, I swap models mid-session without closing the TUI.

## Agent-Agnostic: The Feature I Value Most

The single feature I like most about OpenCode is that it is **agent-agnostic**. The tool does not lock me into one provider, one model family, or one pricing model.

In practice, this means:

\`\`\`text
Today's session:

  08:00  —  OpenCode + Big Pickle (free)     —  organize notes, draft article outline
  09:30  —  OpenCode + Codex (subscription)   —  build new component, type checks, lint
  14:00  —  OpenCode + Codex                  —  debug CSS, fix build pipeline
  16:00  —  OpenCode + Big Pickle (free)      —  research libraries, write tests
\`\`\`

I never worry about "wasting" expensive tokens on trivial commands. I never need a second tool for cheap queries. The same OpenCode session handles both, and I choose the model that matches the task.

This is different from Claude Code, where you are tied to Anthropic's pricing. If you want a cheap model for research, you need a separate tool. OpenCode collapses that into one interface.

## Features I Use and How They Hold Up

**LSP integration** — This is one I did not expect to rely on, but now I notice when it is missing. OpenCode auto-loads language servers (TypeScript, PyRight) and the agent gets real-time diagnostics without extra tool calls. Fewer hallucinated imports, less back-and-forth on type errors. It just works in the background.

**Plan / Build modes** — Tab to toggle. Plan mode disables write tools so the agent can only read files and edit \`.opencode/plans/*.md\`. I use this before any non-trivial refactor — let the agent propose an approach, review it, then Tab back to Build to execute. Catches wrong directions before they become wrong edits.

**@explore subagent** — Dispatch with \`@explore\` in your prompt and it runs a fast read-only agent specialized for codebase search and file reading. I use this when I need a quick answer about how something works without derailing the main session context. The explore agent reads broadly, reports back concisely, and the main agent picks up from there.

**Custom commands** — I have a \`/review\` command that runs my code review checklist and a \`/deploy\` that sequences the deploy steps. They are just markdown files in \`.opencode/commands/\` with \`$ARGUMENTS\` for parameters. Nothing fancy, but they save me typing the same multi-step prompts every time.

**Skills** — Reusable skill files in \`.opencode/skills/<name>/SKILL.md\`. The agent loads them automatically when the task matches. I keep skills for playwright-cli, trading workflows, and data extraction patterns. They are version-controlled, sharable between projects, and work across any provider I switch to.

**MCP integration** — I run CodeGraph for codebase structure queries and draw.io for architecture diagrams. Adding a server is one entry in \`opencode.json\`. No restart needed. The agent picks up the tools mid-session.

**Session sharing** — \`/share\` generates a URL for the session. I use this mostly for saving references — instead of dumping a wall of terminal output into a note, I share the session and move on.

**Parallel agents** — Start multiple agents on the same project. I use this less often, but when it fits (one agent migrating component A while another does component B), it cuts total time noticeably.

## When I Use Which

| Task | Tool |
|---|---|
| Work codebase (Flowdesk) | Claude Code |
| Personal coding sessions | OpenCode + Codex |
| Research, reading, organizing | OpenCode + Big Pickle (free) |
| Quick questions, drafting | OpenCode + Big Pickle (free) |
| Codebase exploration | OpenCode + @explore subagent |
| Multi-step refactor | OpenCode + @general subagent |

## Verdict

OpenCode and Claude Code are not a zero-sum choice. Claude Code is better when you are in an Anthropic-only environment with a budget for it. OpenCode is better when you want provider flexibility, free options for cheap work, and the ability to match the model to the task without leaving the TUI.

For my personal work, the agent-agnostic model switching is the killer feature. One tool, one session, whatever model makes sense for the next five minutes.

## References

- [OpenCode](https://opencode.ai) — official site
- [OpenCode GitHub](https://github.com/anomalyco/opencode) — source repository
- [OpenCode Zen](https://opencode.ai/zen) — curated model gateway
- [OpenCode Go](https://opencode.ai/go) — low-cost subscription for coding models
`;export{e as default};