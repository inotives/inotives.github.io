var e=`---
title: "How to Structure Data Pipelines So Agents Can Extend Them"
date: 2026-07-25
tags: [ai-agents, data-engineering, pipelines, modular-design, dbt, crypto]
series: data-engineering
summary: "Agents extend data pipelines better when each source is a small module with predictable files, explicit contracts, tests, logs, and dbt boundaries. The goal is not clever automation. It is a repo shape that gives the agent fewer chances to guess."
---

# How to Structure Data Pipelines So Agents Can Extend Them

Agents are much better at extending a data pipeline when the pipeline is already split into pieces they can understand.

That sounds obvious until you look at real projects.

A lot of pipelines start as one script. Fetch from an API, normalize a few fields, write to a table, trigger a transform, maybe print some logs. Then the second source gets added. Then a CSV import. Then a backfill path. Then a scheduler. Then a few one-off fixes around provider quirks.

After a while, nobody is sure where the source ends and the pipeline begins.

Humans can survive that longer than agents can. A person remembers that CoinGecko symbols are weird, Alpha Vantage returns throttling messages inside HTTP 200 responses, and CSV imports use contracts instead of schemas. An agent has to rediscover those rules from files.

The fix is not a smarter prompt.

The fix is a pipeline structure that gives every source a home.

## Pick the source as the boundary

Most pipeline extension work happens by source:

\`\`\`text
Add a CoinGecko endpoint.
Fix Alpha Vantage throttling.
Add a CSV import contract.
Backfill one provider.
Change one provider's payload parsing.
\`\`\`

So the source should be the main folder boundary.

That boundary matters more for agents than it does for humans. Agents do not have infinite working memory. Every file loaded into the context window competes with the task, the error message, the test output, the docs, and the code being edited.

If the task is about CoinGecko market data, the agent should mostly live in the CoinGecko slice:

\`\`\`text
sources/coingecko/
tests/unit/sources/coingecko/
tests/integration/sources/coingecko/
transforms/models/sources/coingecko.yml
transforms/models/staging/coingecko/
\`\`\`

It should not need Alpha Vantage extraction code, CSV import contracts, every scheduler registration, every mart, and the shared runner internals just to add one CoinGecko entity.

That is the practical win: the folder boundary becomes a context boundary.

Smaller context means fewer unrelated patterns to copy, fewer accidental edits, faster review, and clearer tests. When the agent touches a CoinGecko feature, the diff should mostly say \`coingecko\`.

## Compare the three common shapes

There are three common ways to structure a small pipeline.

The first is one big script:

\`\`\`text
ingest.py
\`\`\`

At first, it has one provider and one table. Then it grows branches:

\`\`\`text
if source == "coingecko":
if source == "alphavantage":
if mode == "backfill":
if response_shape == "keyed_object":
if use_csv_contract:
\`\`\`

Now every change risks every source. Agents are especially bad in this shape because they search for a term, find a nearby branch, and patch the local symptom. They may miss another branch that needs the same behavior.

The second shape is layer-based:

\`\`\`text
extractors/
  coingecko.py
  alphavantage.py
schemas/
  coingecko.py
  alphavantage.py
runners/
  coingecko.py
  alphavantage.py
flows/
  coingecko.py
  alphavantage.py
events/
  coingecko.py
  alphavantage.py
\`\`\`

This looks organized because every technical layer has its own folder. All extractors are together. All schemas are together. All runners are together.

For agent work, it is usually worse than it looks.

If the task is "add a CoinGecko entity," the agent has to collect the feature from across the repo:

\`\`\`text
extractors/coingecko.py
schemas/coingecko.py
runners/coingecko.py
flows/coingecko.py
events/coingecko.py
deployments/coingecko.py
cli/coingecko.py
tests/extractors/test_coingecko.py
tests/runners/test_coingecko.py
tests/events/test_coingecko.py
\`\`\`

The feature is scattered by technical layer. The agent has to gather the CoinGecko slice before it can reason about the change.

That burns context.

It also increases accidental cross-source edits. When all extractors live beside each other, the agent sees Alpha Vantage and CSV patterns while editing CoinGecko. It may copy the wrong provider behavior because it is nearby. It may change a shared layer helper because that looks like the central place, even when a local CoinGecko change would be safer.

The third shape is source-module based:

\`\`\`text
sources/
  coingecko/
    constants.py
    extractor.py
    schemas.py
    runner.py
    flow.py
    events.py
    deployments.py
    cli.py
\`\`\`

Now the feature is gathered by business boundary. The agent can load one folder and understand the vertical slice.

Layer-based structure optimizes for people thinking in technical categories. Source-module structure optimizes for changes that happen by source, provider, or product capability.

There are still good shared layers. Keep them small:

\`\`\`text
common/http.py
common/events.py
common/raw_writer.py
common/run_ids.py
\`\`\`

Shared code should exist for real repetition. Provider behavior belongs at the edge.

## What goes inside a source module

For a small crypto or market-data pipeline, the source module can stay boring:

\`\`\`text
sources/
  coingecko/
    constants.py
    extractor.py
    schemas.py
    runner.py
    flow.py
    events.py
    deployments.py
    cli.py
\`\`\`

Each file answers one question:

\`\`\`text
constants.py      What endpoints and source names exist?
extractor.py      How do provider payloads become records?
schemas.py        What shape do valid records have?
runner.py         How does one source run execute?
flow.py           How does orchestration call the run?
events.py         What completion or failure events are emitted?
deployments.py    How is this source registered with the scheduler?
cli.py            How does a human or agent run it directly?
\`\`\`

That gives an agent a map. If the task is "add a new endpoint," it can inspect \`constants.py\`, \`extractor.py\`, \`schemas.py\`, and tests. It does not need to scan the whole ingestion system.

If CoinGecko needs provider-specific pagination, put it in \`sources/coingecko/\`. If Alpha Vantage has HTTP-200 error envelopes, keep that in \`sources/alphavantage/\`. If CSV import is contract-driven, let it have its own module that reads \`contracts.yaml\`.

Once that shape is stable, agents can do repeatable extension work. They are no longer inventing where files belong. They are filling in a known source slice.

## Scaffolding should create rails, not pretend to know the provider

Agents are good at filling in a known pattern. They are much weaker when they have to invent the pattern.

That is where scaffolding helps.

A source scaffold can create the boring structure:

\`\`\`text
sources/<source>/
  constants.py
  extractor.py
  schemas.py
  runner.py
  flow.py
  events.py
  deployments.py
  cli.py
tests/unit/sources/<source>/
tests/integration/sources/<source>/
transforms/models/sources/<source>.yml
transforms/models/staging/<source>/
\`\`\`

It can also register the CLI and orchestration entrypoint.

What it should not do is hallucinate business logic.

Authentication, rate limits, pagination, provider error formats, schema fields, declared grain, schedules, and mart logic should stay explicit. A scaffold can leave TODOs and print a checklist. That is better than generating fake confidence.

For example, a scaffold can know this:

\`\`\`text
This endpoint returns a keyed object.
The record path is "Time Series (Daily)".
The mapping key should become trading_date.
The runtime parameter symbol must be copied into each payload.
\`\`\`

It should not guess this:

\`\`\`text
The provider throttles through a JSON "Note" field.
The free tier allows 25 requests per day.
The correct analytical grain is symbol plus trading_date.
This endpoint is safe to schedule every five minutes.
\`\`\`

Those are provider and business decisions. Keep them visible.

## Give the agent a vertical slice

The best unit of pipeline work is a vertical slice.

Not "add the provider."

That is too broad.

A better task is:

\`\`\`text
Add Alpha Vantage daily prices.
Land raw records.
Emit run events.
Create the dbt source declaration.
Create the staging model.
Add the smallest tests that prove extraction and staging work.
Leave scheduling manual until live validation passes.
\`\`\`

That task has boundaries. An agent can work through it without redesigning the whole pipeline.

For a crypto source, a vertical slice might look like this:

\`\`\`text
Source: coingecko
Entity: coins_markets
Raw table: raw_coingecko__coins_markets
Staging model: stg_coingecko__coins_markets
Run event: coingecko.coins_markets.completed
Quality check: row_count_above_minimum
Mart follow-up: mart__asset_prices
\`\`\`

The slice touches extraction, validation, raw landing, events, dbt, and tests. It does not build every downstream mart on day one.

That is enough for the next agent to continue.

## Contracts belong near the boundary

Agents need to know what a source promises.

Put that promise near the source or the dbt model, not in a forgotten project note.

For a source entity:

\`\`\`yaml
source: coingecko
entity: coins_markets
records:
  identity: [provider_asset_id, observed_at]
  required_fields: [provider_asset_id, symbol, price_usd, observed_at]
  raw_table: raw_coingecko__coins_markets
  staging_model: stg_coingecko__coins_markets
freshness:
  max_age_minutes: 60
\`\`\`

For a CSV import, the contract may describe columns, types, required fields, and identity. For an API source, it may describe endpoint parameters, response shape, record path, and runtime parameters.

The important part is that the contract is machine-readable enough for an agent to inspect.

Then the agent can answer practical questions:

\`\`\`text
Which field defines identity?
Where does raw data land?
Which staging model consumes it?
What freshness threshold applies?
Is this source scheduled?
Which fields are allowed into marts?
\`\`\`

That is how contracts become working infrastructure instead of documentation theater.

## dbt gives the pipeline a second boundary

Extraction is not the mart.

That separation matters for agents.

The source module should get provider truth into raw storage with enough metadata to replay and debug it. dbt should turn raw records into staging models and marts with clearer semantics.

The boundary can be simple:

\`\`\`text
raw          provider truth
staging      typed and named source records
marts        consumer-ready analytics tables
agent marts  curated tables safe for agents
\`\`\`

When the agent is adding a new source, it should not jump straight from provider payload to mart logic. That hides too much.

A staging model gives the review point:

\`\`\`text
Did we preserve provider IDs?
Did we keep observed_at separate from ingested_at?
Did we avoid using symbol as identity?
Did we expose source_run_id?
Did we type the fields needed downstream?
\`\`\`

Once staging is stable, marts can join to canonical asset tables, platform tables, mapping tables, and freshness checks.

The agent gets a path instead of a pile.

## Logs and events make the module debuggable

A source module should emit structured events.

Not decorative terminal logs. Events.

\`\`\`json
{"run_id":"run_20260725_0900","source":"coingecko","entity":"coins_markets","event":"started"}
{"run_id":"run_20260725_0900","source":"coingecko","entity":"coins_markets","event":"records_extracted","count":250}
{"run_id":"run_20260725_0900","source":"coingecko","entity":"coins_markets","event":"raw_write_completed","count":250}
{"run_id":"run_20260725_0900","source":"coingecko","entity":"coins_markets","event":"completed"}
\`\`\`

Now the agent can debug with code:

\`\`\`text
Find the latest failed run.
Compare extracted count with written count.
List entities that have repeated zero-row runs.
Trace a mart row back to source_run_id.
\`\`\`

This is where source modules, run logs, and lineage connect. The source module emits the facts. The transform layer carries the run IDs. The mart exposes enough lineage for agents and humans to explain a number.

Without those checkpoints, the agent has to inspect raw payloads and guess where the number changed.

## Tests should match the module shape

Agent-friendly tests are small and local.

For a source module, useful tests cover:

\`\`\`text
payload extraction
invalid record handling
source record identity
runtime parameter copying
event emission
runner behavior
dbt source/staging parse
\`\`\`

The goal is not full coverage theater. The goal is one fast check that catches the most likely break in each boundary.

If a scaffold creates a source, it should run fast checks before leaving the repo changed:

\`\`\`text
format generated files
lint generated files
run generated source tests
dbt parse
\`\`\`

Full live API tests can wait. Scheduling can wait. Production settings can wait.

That restraint matters. A scaffold that tries to do everything becomes another system to debug.

## What agents should be allowed to change

A modular pipeline also gives better access boundaries.

For normal extension work, an agent can touch:

\`\`\`text
sources/<source>/
tests/unit/sources/<source>/
tests/integration/sources/<source>/
transforms/models/sources/<source>.yml
transforms/models/staging/<source>/
docs/source-notes/<source>.md
\`\`\`

It should be more cautious with:

\`\`\`text
shared ingestion framework
production scheduler
canonical asset mapping tables
mart definitions used by reports
MCP allowlists
secrets and settings
\`\`\`

This does not mean agents can never change shared code. It means the task should make that explicit. Most provider additions should not need a framework change.

That is the test of the structure. If every new source requires editing the core runner, the source boundary is too weak.

## The practical rule

Structure the pipeline so the next source is mostly local.

The agent should be able to answer:

\`\`\`text
Where do I add endpoint metadata?
Where do I parse the payload?
Where do I define valid records?
Where do I run this source?
Where do events come from?
Where does raw data land?
Where is the staging model?
Which tests prove the slice works?
\`\`\`

If those answers are obvious from the repo shape, agents can extend the pipeline with less supervision.

If those answers are hidden in one giant script, agents will keep guessing.

And guessing is the expensive part.

## References

- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [Data Lineage for Small Crypto Pipelines](/posts/2026-07-24-data-lineage-small-crypto-pipelines)
- [MCP Is Becoming the API Layer for Internal Data](/posts/2026-07-24-mcp-api-layer-internal-data)
- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
`;export{e as default};