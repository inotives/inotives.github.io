var e=`---
title: "Keep a Docs Folder for Agent Memory"
date: 2026-07-25
tags: [ai-agents, documentation, agent-memory, repositories, agent-workflows, software-engineering]
series: data-engineering
summary: "A repo-local docs folder is one of the simplest ways to give agents durable project memory. Record past decisions, constraints, runbooks, and phase notes there, then point agents to it from AGENTS.md."
---

# Keep a Docs Folder for Agent Memory

Every repo that uses coding agents should have a \`docs/\` folder.

Not a polished documentation site. Not a giant wiki. Just a durable place where the project records decisions, constraints, runbooks, and past work.

Then \`AGENTS.md\` should tell agents to read it.

That sounds small because it is small. It also fixes one of the most common problems with agent work: the agent only knows what is in the current context.

Chat history is fragile. Context windows fill up. Sessions get compacted. A different agent joins tomorrow. The human remembers why a choice was made, but the repo does not.

The \`docs/\` folder is how the repo remembers.

## AGENTS.md is the front door

\`AGENTS.md\` should tell the agent how to start.

At minimum:

\`\`\`markdown
# Agent instructions

Before changing code:

1. Read \`docs/project.md\`.
2. Read any relevant file in \`docs/decisions/\`.
3. Read the runbook for the area you are touching.
4. Preserve documented decisions unless the user explicitly changes them.
\`\`\`

That gives the agent a reliable entrypoint. It does not need to ask, "Where are the docs?" It does not need to infer the project history from code alone.

For a data pipeline repo, \`AGENTS.md\` should point to the project memory that matters before code changes start. In my \`felts\` repo, the agent startup path is explicit: first read the role-local AgentRig files, then shared AgentRig context, then the task file, then the phase docs.

The important part is not AgentRig itself. The important part is that \`AGENTS.md\` names the memory sources in order.

For example:

\`\`\`markdown
Before changing code:

1. Read your assigned task in \`.agent-rig/_shared/tasks/\`.
2. Read \`docs/project_specs.md\`.
3. Read \`docs/architecture.md\`.
4. Read the active phase doc under \`docs/phases/\`.
5. Read related ADRs under \`docs/adr/\`.
6. Read any relevant runbook under \`docs/runbooks/\`.
\`\`\`

Now an agent adding a CoinGecko feature knows where the task lives, what phase it belongs to, which decisions are already made, and which runbook explains operations.

## Keep the docs boring

The best agent-memory docs are not fancy.

Use plain files:

\`\`\`text
docs/
  project_specs.md
  architecture.md
  implementation_phases.md
  adr/
    0001-raw-landing-design.md
    0002-provider-schema-transform-layout.md
    0003-yaml-driven-csv-import-contracts.md
  runbooks/
    local_operations.md
  mcp/
    production-data.md
  phases/
    phase_13_coingecko_ohlc_capture.md
  _archived/
    phase_08_source_scaffolding.md
    phase_09_production_data_agent_access.md
    phase_10_agent_pipe_sqlite_ingestion.md
\`\`\`

That is enough.

Do not make the agent search Slack, old pull requests, issue comments, and private notes to learn basic project rules. Put the stable decisions in the repo.

## The Felts pattern

The \`felts\` repo has a useful pattern because it separates different kinds of memory.

\`AGENTS.md\` is the routing layer. It tells the agent where to start:

\`\`\`text
.agent-rig/<agent>/instructions.md
.agent-rig/<agent>/context.md
.agent-rig/_shared/context.md
.agent-rig/_shared/tasks/
docs/phases/
docs/_archived/
\`\`\`

The task file is the immediate source of truth for active work. The docs folder is the durable source of truth for project decisions.

The split looks like this:

\`\`\`text
docs/project_specs.md          What the project is trying to do
docs/architecture.md           How the system is shaped
docs/implementation_phases.md  What has been implemented so far
docs/adr/                      Decisions worth preserving
docs/phases/                   Active planning and acceptance criteria
docs/_archived/                Completed phase history and old handoffs
docs/runbooks/                 How to operate the system
docs/mcp/                      Agent-facing data access notes
\`\`\`

That is the kind of memory agents can use.

If an agent is asked to work on a production-data MCP issue, it can read the MCP docs and the archived production-data phase. If it is asked to work on CoinGecko OHLC capture, it can read the active phase doc. If it is about raw landing or transform layout, it can read the ADRs.

The agent does not need to reconstruct the whole project from code.

The docs tell it which decisions are already settled.

## Record decisions, not vibes

A good decision note should answer:

\`\`\`text
What did we decide?
Why?
What alternatives did we reject?
What files or modules does this affect?
When should we revisit it?
\`\`\`

Example:

\`\`\`markdown
# 0002 Raw tables are append-only

Decision: raw financial tables are append-only. Pipelines insert correction rows instead of updating raw records.

Reason: raw data is regulatory evidence. Reports must be explainable later from the data that existed at filing time.

Rejected: updating raw rows in place after parser fixes. This destroys evidence and makes replay ambiguous.

Applies to:
- \`raw_provider_records\`
- source ingestion jobs
- backfill jobs
- agent database tools

Revisit if storage cost becomes a real operational problem.
\`\`\`

That note is short, but it saves future work. An agent that reads it will not "simplify" the pipeline by updating raw rows in place.

## Use docs as handoff memory

Agents should leave behind the facts the next agent needs.

After a non-trivial change, update a small doc:

\`\`\`text
What changed?
What command verifies it?
What decision was made?
What follow-up remains?
\`\`\`

This does not need to become a process monster. A few lines are enough.

Example:

\`\`\`markdown
## 2026-07-25

Added CoinGecko asset platforms ingestion.

Verify:
- \`pytest tests/unit/sources/coingecko\`
- \`dbt parse\`

Notes:
- Provider \`id\` is stored as \`provider_platform_id\`.
- Canonical platform mapping is deferred to staging.
- No schedule yet. Run manually until live validation passes.
\`\`\`

Now tomorrow's agent has a starting point.

This works because the handoff lives in the repo.

Once the doc is committed, it is version controlled, diffable, and available in every future checkout. It survives chat deletion, context compaction, tool changes, and a different agent joining the project later.

That is a simple but important distinction. Chat memory helps during a session. Committed docs become project memory.

If an old decision turns out to be wrong, update the doc in a new commit. The history still shows what changed and when. That is much better than trying to remember which conversation contained the original reasoning.

## Docs reduce context loading

A useful \`docs/\` folder cuts down how much code the agent needs to load.

If an agent has to understand the whole project by reading source files, it will spend context on details it does not need. It may load unrelated modules, old tests, generated files, and implementation branches before it finds the actual rule.

A decision note is cheaper:

\`\`\`text
Use source-module folders.
Raw tables are append-only.
Agents query only \`agent__\` marts through MCP.
Soft deletes use \`deleted_at\`, not \`is_deleted\`.
Backfills must preserve historical mappings.
\`\`\`

Those sentences point the agent toward the right files and away from bad edits.

This is especially useful in modular repos. If the agent is working on \`sources/coingecko/\`, the docs can say which boundaries matter, and the agent can stay inside that slice unless the task requires shared code.

Good docs do not replace code reading. They prevent unnecessary code reading.

## Put project rules near the repo

Agent memory should travel with the code.

If the project rule lives only in one chat session, it is already half-lost. If it lives in \`docs/decisions/\` and \`AGENTS.md\` points to it, every future agent can find it.

This matters for financial data projects:

\`\`\`text
Do not mutate raw financial rows.
Use \`deleted_at\` for soft deletes.
Use effective dates for mappings.
Do not expose raw tables to general agent tools.
Store report snapshots for filed numbers.
\`\`\`

Those rules affect code, dbt models, database migrations, MCP tools, and reviews. They belong in the repo.

## Keep docs current by making them small

Large docs rot.

Small docs survive.

Prefer many focused files over one huge project bible. The \`felts\` structure is a good example:

\`\`\`text
docs/project_specs.md
docs/architecture.md
docs/adr/0002-provider-schema-transform-layout.md
docs/runbooks/local_operations.md
docs/mcp/felts-prod-data.md
docs/phases/phase_13_coingecko_ohlc_capture.md
\`\`\`

Each file should be easy to update in the same commit as the code change.

If updating the doc feels like writing a report, the doc is too heavy.

## The practical rule

Every agent-friendly repo should have:

\`\`\`text
AGENTS.md
docs/project_specs.md
docs/architecture.md
docs/adr/
docs/runbooks/
docs/phases/
docs/_archived/
\`\`\`

And \`AGENTS.md\` should say which docs to read before work starts.

This is the simplest form of project memory:

\`\`\`text
The code says what the system does.
The docs say why it is shaped that way.
AGENTS.md tells agents where to look first.
\`\`\`

That is enough to make future sessions less wasteful.

## References

- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [How to Structure Data Pipelines So Agents Can Extend Them](/posts/2026-07-25-how-to-structure-data-pipelines-so-agents-can-extend-them)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [MCP Is Becoming the API Layer for Internal Data](/posts/2026-07-24-mcp-api-layer-internal-data)
- [Immutable Raw Tables for Financial Pipelines](/posts/2026-07-25-immutable-raw-tables-financial-pipelines)
- [AgentRig: Filesystem-First Multi-Agent Workspaces](/posts/2026-07-06-agent-rig-filesystem-first-multi-agent-workspaces)
`;export{e as default};