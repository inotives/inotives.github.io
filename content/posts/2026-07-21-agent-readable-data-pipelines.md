---
title: "Agent-Readable Data Pipelines"
date: 2026-07-21
tags: [ai-agents, data-engineering, pipelines, agent-rig, context-mode, codegraph, agent-pipe]
series: data-engineering
summary: "Coding agents can debug data pipelines faster when the repo gives them stable files, structured logs, explicit contracts, and narrow commands. The trick is not more documentation. It is making the pipeline legible to software."
---

# Agent-Readable Data Pipelines

Most data pipelines are written for humans who already know the project.

The senior engineer knows which script runs first. The analyst knows which table is trusted. The data engineer knows that `symbol` is display metadata, not identity. The person who wrote the ingestion job knows where the logs land and which failure can be ignored.

Then a coding agent joins the project and has none of that memory.

It can search files. It can run commands. It can inspect schemas. But if the repo hides its operating model in scattered scripts, informal naming, and unstructured logs, the agent has to guess.

Guessing is where agents get expensive.

Agent-readable pipelines are pipelines that explain themselves through their files, commands, contracts, logs, and tests. Not with a giant wiki. With boring structure.

## The goal is fewer guesses

An agent debugging a failed pipeline needs quick answers:

- What sources exist?
- Which command runs ingestion?
- Where does raw data land?
- Which transforms are trusted?
- What does this table promise?
- How fresh is the data?
- What failed last time?
- What should not be touched?

If those answers require reading twenty files and reconstructing the project from vibes, the pipeline is not agent-readable.

The fix is not to write more prose everywhere. The fix is to put the important facts where tools can find them.

## Start with predictable files

Agents handle repos better when the shape is boring.

For a small crypto pipeline, I want names like this:

```text
sources.yaml
contracts/
  coingecko/
    mart__asset_prices.yaml
models/
  staging/
  marts/
logs/
  runs.jsonl
docs/
  pipeline.md
```

Those names are not magical. They are obvious. That matters.

`agent-pipe` already points in this direction with file-defined sources and durable run state. A source config tells the agent what can be ingested. A run record tells it what happened. A local SQLite store gives it something concrete to inspect.

This is better than a pipeline where the only source of truth is "run the script and see what happens."

## Make commands discoverable

Every pipeline should have a small command surface.

```text
npm run ingest
npm run transform
npm run test:data
npm run status
```

Use whatever names fit the repo. The point is that the agent should not need to open five scripts to find the happy path.

For agent work, `status` is underrated. A good status command prints the current state without dumping the world:

```text
last_run: failed
source: coingecko.coins
started_at: 2026-07-21T02:10:00Z
error: missing required field coingecko_id
next: inspect .agent-pipe/runs/2026-07-21T021000Z.json
```

That is enough for the agent to move. No 5,000-line log. No archaeology.

## Logs should be structured

Plain text logs are fine for humans watching a terminal. They are weak evidence for agents.

Use JSON lines for pipeline events:

```json
{"run_id":"2026-07-21T021000Z","event":"source_started","source":"coingecko.coins"}
{"run_id":"2026-07-21T021000Z","event":"record_count","source":"coingecko.coins","count":0}
{"run_id":"2026-07-21T021000Z","event":"run_failed","error":"row_count_below_minimum"}
```

Now the agent can filter, count, group, and compare without parsing decorative terminal output.

This is exactly where context-mode-style tooling helps. Let code process the log and print the answer. Do not pour the full log into the conversation and ask the model to read it like a tired human.

The lazy rule: logs are for machines first, humans second. Pretty output can be derived later.

## Contracts should live beside the data boundary

If a table has consumers, it needs a contract.

For a crypto mart, a small contract can say:

```yaml
dataset: coingecko.mart__asset_prices
owner: market-data
identity:
  join_key: canonical_asset_id
  display_field: display_symbol
freshness:
  timestamp: observed_at
  max_age_minutes: 15
agent_access:
  allowed: true
  stale_behavior: refuse_current_price_answer
```

That file tells the agent the part it cannot safely infer from SQL alone.

It says which field is identity. It says which timestamp controls freshness. It says whether the dataset is safe for agent use. It says what to do when the data is stale.

This connects the recent posts in the data-engineering series: contracts define promises, quality checks enforce them, freshness gives the clock, and crypto symbols stay out of identity.

## Docs should be operational

Most docs are written like tours. Agents need maps.

A useful `docs/pipeline.md` should answer:

```text
Purpose: what this pipeline produces
Inputs: where data enters
Outputs: which tables/files consumers use
Commands: how to run, test, and inspect
Contracts: where promises live
Failure policy: what blocks publish
Agent boundary: what tools/views agents may use
```

Keep it short. Link to the source files. Do not describe every implementation detail.

The agent can read code. What it cannot reliably infer is intent.

## CodeGraph helps when names are stable

CodeGraph is useful because it can answer "what calls this?" and "where does this flow?" without a grep tour.

But it works best when the codebase gives it stable names.

Functions named `run()`, `process()`, and `handle()` everywhere are cheap to type and expensive to understand. A function named `ingestCoinGeckoCoins()` gives both humans and code tools a better starting point.

Same with files:

```text
coingeckoCoinsSource.ts
writeRunRecord.ts
renderCronSchedule.ts
```

Names are documentation that tools can index.

Do not over-abstract for agents. Just stop hiding the domain behind generic names.

## AgentRig needs handoff-shaped evidence

AgentRig-style workflows work when planners, workers, and reviewers can pass evidence without replaying the whole session.

For data pipeline work, that means every task note should include:

```text
changed files
commands run
source rows tested
latest run id
known skipped checks
reviewer focus
```

That is not bureaucracy. It is compression.

A reviewer agent should not need to ask whether the worker really ran the pipeline. The note should say which command ran and where the durable result lives.

For pipeline changes, fake assertions are especially dangerous. A test that only checks a mocked parser is not the same as proving a real source file, run record, or dbt model works.

## `agent-pipe` is the right primitive

`agent-pipe` is useful here because it makes local work durable.

Records have identities. Runs can be inspected. File sources can be declared. State survives the chat session. That is exactly the kind of surface an agent can work with.

The more pipeline state lives in durable files and local records, the less the agent has to rely on conversation memory.

For an agent-readable data pipeline, I would rather have:

```text
.agent-pipe/sources.yaml
.agent-pipe/runs.sqlite
contracts/coingecko/mart__asset_prices.yaml
docs/pipeline.md
```

than a long prompt explaining what happened last time.

Prompts vanish. Files stay.

## The minimum version

The smallest useful version is:

```text
one source config
one status command
structured run logs
contracts for public marts
short operational docs
tests that name the domain rule
```

That is enough for a coding agent to debug without inventing the project from scratch.

Do not build an agent platform around this. Make the existing pipeline legible.

## The practical rule

If a human needs tribal knowledge to debug the pipeline, an agent will guess.

Move that knowledge into files, names, contracts, logs, and commands. Keep the surface small. Make failures inspectable. Give tools something stable to search.

Agent-readable data pipelines are not fancy. They are ordinary pipelines with fewer hiding places.

## References

- [Agent-Rig: Filesystem-First Multi-Agent Workspaces That Actually Catch Bugs](/posts/2026-07-06-agent-rig-filesystem-first-multi-agent-workspaces)
- [The Right Tools at the Right Time: Why Context Matters More Than Capability](/posts/2026-07-06-right-tools-right-time-context-over-capability)
- [CodeGraph for Agentic Codebase Work](/posts/2026-05-20-codegraph-for-agentic-codebase-work)
- [Data Contracts: The API Layer Your Crypto Pipeline Is Missing](/posts/2026-07-18-data-contracts-crypto-pipelines)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
