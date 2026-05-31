var e=`---
title: "Building agent-knowledge: A Persistent Memory System for AI Agents"
date: 2026-05-12
tags: [agent-knowledge, karpathy-wiki, ai-agents, persistent-memory, claude-code, codex, opencode, obsidian, github, markdown, knowledge-management]
summary: "How I built agent-knowledge — a CLI + session hooks system inspired by Andrej Karpathy's LLM Wiki pattern. Agent-agnostic, works across Claude Code, Codex, and OpenCode, stores everything as plain markdown compatible with Obsidian, and uses GitHub private repos for sync instead of Obsidian Sync subscription."
---

## agent-knowledge: Persistent Memory for AI Agents

Agent sessions are ephemeral. When you close the terminal, the agent forgets everything it learned — decisions made, context established, insights uncovered, workarounds discovered. The next session starts from zero.

I built [agent-knowledge](https://github.com/inotives/agent-knowledge) to solve this. It is a CLI (\`akw\`) plus session hooks that give AI agents persistent memory across sessions, agents, and machines.

## The Karpathy Inspiration

This is directly inspired by [Andrej Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The core idea is simple but powerful: instead of treating each agent session as a fresh start, the LLM incrementally builds and maintains a persistent wiki of markdown files. The wiki compounds over time — every session adds to it, every question deepens it, every new source enriches the cross-references.

Karpathy describes three layers:

- **Raw sources** — immutable source documents (articles, papers, data files)
- **The wiki** — LLM-generated markdown files: summaries, entity pages, concept pages, cross-references
- **The schema** — a config file (AGENTS.md, CLAUDE.md) that tells the LLM how to maintain the wiki

The key insight: the tedious part of maintaining a knowledge base is the bookkeeping — updating cross-references, keeping summaries current, noting contradictions, maintaining consistency across pages. Humans abandon wikis because the maintenance burden grows faster than the value. LLMs do not get bored, do not forget to update a cross-reference, and can touch 15 files in one pass.

## From Pattern to Implementation

Karpathy's write-up is intentionally abstract — a pattern, not a product. I built agent-knowledge to make it concrete and automated.

The system has three tiers:

\`\`\`
Turns & Sessions → Drafts → Knowledge → Skills & Workflows
     (raw)        (proposed)  (curated)     (actionable)
\`\`\`

- **Tier 1: Drafts** — Auto-generated session summaries in \`1_drafts/sessions/\`
- **Tier 2: Knowledge** — Curated pages organized as entities, concepts, patterns in \`2_knowledges/\`
- **Tier 3: Intelligences** — Skills and agent personas in \`3_intelligences/skills/\` and \`3_intelligences/agents/\`

The CLI captures sessions. Humans curate the knowledge. Agents propose; people decide.

## CLI + Session Hooks Architecture

The system ships as a Python CLI (\`akw\`) plus session hooks. The lifecycle is intentionally simple — two hooks, not four:

| Hook | What it does |
|---|---|
| \`SessionStart\` | Opens a session, persists \`AKW_SESSION_ID\`, returns recent project summaries |
| \`SessionEnd\` | Blocks exit or \`/new\` until the agent saves a summary with \`akw session close\` |

There is no turn-level capture. No buffering prompts and responses. The agent writes one durable markdown summary at session close using \`akw session close --content-file summary.md\`. This is simpler, more reliable, and avoids the complexity of incremental turn assembly.

When a session starts with \`--json\`, it returns the latest five saved summaries for the resolved project — full markdown content, newest first, excluding the current session. The agent starts each session already knowing what happened recently.

Projects auto-register on first use. An unknown working directory is automatically added to the project registry and gets a project entity page under \`2_knowledges/entities/projects/\`.

## Cross-Agent Knowledge Sharing

This is the feature I wanted most: knowledge captured in one agent session is available in all future sessions, regardless of which agent I use.

The hooks wire into whatever agent I am running — Claude Code at work, Codex or OpenCode at home. The same \`~/.agent-knowledge/memory\` folder is shared across all of them. A research session in Claude Code produces a draft that Codex can search the next day. A pattern discovered in OpenCode becomes a skill that Claude Code can load.

The \`akw search\` command runs BM25 search across all drafts and curated knowledge. \`akw skill search\` and \`akw agent search\` query the intelligences tier separately. Every command that returns structured data accepts \`--json\` for piping into jq or other tools.

## Obsidian for Editing, GitHub for Sync

All knowledge is plain markdown with YAML frontmatter. This means I can open the entire \`~/.agent-knowledge/memory\` folder in Obsidian as a vault and browse it with graph view, backlinks, and Dataview queries.

The curation workflow is straightforward:

\`\`\`
cd ~/.agent-knowledge/memory
\`\`\`

From there I use Obsidian to read drafts, follow cross-references, and make notes. When I want the LLM to help with curation, I open Claude Code or OpenCode in the same folder and ask it to review drafts and propose new knowledge pages following the frontmatter conventions in \`0_configs/rules/knowledge-management.md\`.

The entire memory folder is a git repository. I push it to a private GitHub repo for syncing across machines. This replaces Obsidian Sync (which costs a subscription) with a standard \`git push\` workflow. The structure works the same either way — Obsidian reads local markdown files regardless of how they are synced.

The savings are real. Obsidian Sync is $5/month for the basic plan. GitHub private repos are free. And I get proper version history, branching, and CI on top.

## What the CLI Looks Like

\`\`\`bash
# Start a session (returns recent project summaries)
akw session start --project my-project --create-project-folder --json

# Search accumulated knowledge
akw search "auth middleware" --json
akw search "auth middleware" -t knowledge

# Read a page
akw memory read 2_knowledges/architecture/event-bus.md

# Close a session with a summary (agent-safe)
akw session close --content-file /tmp/session-summary.md --json

# Create a draft page (agent-safe)
akw memory create \\
  --path "1_drafts/sessions/my-project/abc123-20260512T1530.md" \\
  --title "Session: refactoring auth pipeline" \\
  --content-file /tmp/draft.md \\
  --tags "auth,refactor"

# Archive old drafts
akw archive 1_drafts/sessions/my-project/abc123-20260501T1000.md

# Check status
akw session status --json
akw maintain stats --json

# Recover from crash
akw recover --dry-run
akw recover
\`\`\`

## Why Not MCP?

The v0.1.x release of agent-knowledge shipped as an MCP server. I migrated to CLI + session hooks in v0.2.0 for the same reason I choose playwright-cli over @playwright/mcp: token efficiency.

An MCP server loads tool definitions into context on every connection. The agent-knowledge MCP server had tools like \`memory_read\`, \`memory_create\`, \`session_start\`, \`session_end\` — each with typed parameter schemas. Those schemas consumed context even when the tools were not being used.

The CLI approach has zero context overhead. The agent only calls \`akw\` when it needs to. The hooks fire at session boundaries and cost nothing between turns. The commands are concise one-liners that pipe directly into shell tools.

Piping is another advantage. CLI output with \`--json\` streams directly into \`jq\`, \`grep\`, or the next tool in a chain — no parsing MCP response envelopes, no extracting values from nested JSON-RPC payloads. A session summary can flow into a search, then into a draft, then into a skill, all in one line:

\`\`\`bash
akw session start --json | jq -r '.latest_summaries[0].content' | akw memory create --path "1_drafts/..." --title "Chained summary" --content-file -
\`\`\`

The audience boundary is also cleaner:

- **Agent-safe commands**: \`akw session …\`, \`akw search\`, \`akw skill …\`, \`akw agent …\`, \`akw memory read/create\`, \`akw memory ls/history\` — callable from inside a session
- **Curator commands**: \`akw memory update/rm\`, \`akw maintain …\`, \`akw archive\`, \`akw recover\`, \`akw reindex\`, \`akw init\` — humans only

The old \`akw group\` commands are deprecated aliases. \`akw group end\` now fails with a reminder to use \`akw session close\` — sessions cannot end without a summary.

## Tech Stack

| Component | Choice |
|---|---|
| Language | Python 3.12+ |
| CLI framework | \`click\` |
| Sessions storage | SQLite |
| Search | DuckDB (BM25) |
| Package manager | \`uv\` |
| DB migrations | Built-in, auto-applied |
| Testing | \`pytest\` |
| Type checking | \`pyright\` |
| License | Apache 2.0 |

## Where It Fits

The three-tier system maps to how knowledge actually matures:

1. **Close every session with a summary** — the \`SessionEnd\` hook refuses to let you exit or open a new session until the agent saves a summary with \`akw session close\`
2. **Start every session with context** — \`akw session start --json\` returns the latest project summaries so the agent knows what happened recently
3. **Curate intentionally** — review drafts in Obsidian, synthesize into knowledge pages, promote patterns to skills
4. **Reuse across sessions** — skills load on demand, search returns relevant knowledge, project summaries compound

The agent captures. The human curates. The repository persists. The next session builds on everything before it.

## References

- [agent-knowledge](https://github.com/inotives/agent-knowledge) — the project repository
- [Andrej Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — the original pattern that inspired this
- [Obsidian](https://obsidian.md) — markdown editor and vault browser
`;export{e as default};