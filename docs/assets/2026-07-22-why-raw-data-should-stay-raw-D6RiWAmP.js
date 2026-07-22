var e=`---
title: "Why Raw Data Should Stay Raw"
date: 2026-07-22
tags: [data-engineering, crypto, elt, data-quality, pipelines, dbt]
series: data-engineering
summary: "Raw data is evidence. If a pipeline normalizes, filters, renames, or deduplicates too early, it loses the provider truth needed for replay, debugging, audits, and agent-readable data workflows."
---

# Why Raw Data Should Stay Raw

Raw data is not ugly data waiting to be fixed.

Raw data is evidence.

That distinction matters. A pipeline that overwrites source truth too early may look cleaner, but it becomes harder to debug the first time a provider changes a field, a token mapping breaks, or a report number does not reconcile.

The raw layer has one job: preserve what arrived.

Everything else belongs later.

## The three-layer boundary

The simplest useful shape is still:

\`\`\`text
raw -> staging -> marts
\`\`\`

Raw stores provider truth. It should keep source identifiers, source timestamps, payload shape, ingestion metadata, and run IDs.

Staging makes the data usable. It parses timestamps, normalizes types, renames fields with provider scope, and applies basic contracts.

Marts make the data trustworthy for consumers. They expose canonical IDs, safe joins, freshness status, and business-ready fields for dashboards, reports, and agents.

Each layer has a different job. Problems start when raw tries to behave like a mart.

## What raw should preserve

For a crypto pipeline, raw should keep the messy facts:

\`\`\`text
provider
source_endpoint
source_record_id
source_payload_json
provider_timestamp
ingested_at
run_id
request_metadata
\`\`\`

If CoinGecko sends \`id\`, \`symbol\`, and \`name\`, keep those names in the payload. If an exchange sends \`XBT\` instead of \`BTC\`, keep it. If a token list omits a chain ID, keep the row and let staging or quarantine decide what to do.

Do not rename \`symbol\` to \`canonical_symbol\` in raw. Do not map provider IDs in raw. Do not drop fields because no current mart uses them.

Raw is where future-you goes when current-you was wrong.

## Premature normalization destroys evidence

Cleaning too early feels efficient.

You pull the source, rename fields, map IDs, dedupe rows, and store the final shape. The table looks nice. The first dashboard works.

Then something changes.

A provider starts reusing a symbol. A token migrates. A source timestamp was actually local time, not UTC. A mapping table points an external ID to the wrong canonical asset. A price row was overwritten by a stale retry.

If the pipeline only stored the cleaned row, you now have two problems: the data is wrong, and the evidence is gone.

The fix may be simple, but replay is impossible because the raw input was discarded.

That is expensive.

## Raw data makes replay possible

Replay is the reason to keep raw data.

If you improve the asset mapping table, you should be able to rebuild staging and marts from the original provider rows.

If you fix a timestamp parser, you should be able to rerun the transform without pulling the API again.

If a dbt test catches a bad mart, you should be able to trace the row back to the raw payload and run ID.

The pipeline should support this path:

\`\`\`text
raw payload -> staging fix -> mart rebuild -> report corrected
\`\`\`

Without raw, every historical correction becomes a negotiation with whatever the provider returns today.

That is not replay. That is re-ingestion with hope.

## Provider truth is not consumer truth

Keeping raw data raw does not mean consumers should use it.

Raw provider truth can be messy, duplicated, stale, incomplete, or semantically weird. A source may call a field \`updated_at\` without meaning the same thing your mart means by \`as_of\`. A symbol may be a display label, not an identity. A contract address may be missing its chain.

That is why the raw layer should usually be hidden from dashboards and production agents.

Consumers should use marts.

Engineers, tests, and debugging agents should be able to inspect raw when something breaks.

That split is the whole point.

## What staging should do

Staging is where raw provider data becomes typed, named, and scoped.

For a CoinGecko source, staging fields might look like:

\`\`\`text
coingecko_id
coingecko_symbol
coingecko_name
asset_platform_id
contract_address
provider_observed_at
ingested_at
run_id
\`\`\`

Those names are honest. They do not pretend provider identity is canonical identity.

Staging is also a good place for quarantine decisions. If a timestamp cannot parse, if a provider ID is missing, or if a token contract has no chain, the row should be rejected into a quarantine table with the raw payload and failure reason.

Staging should make bad data visible, not silently fix it into a shape that looks safe.

## What marts should do

Marts are for consumers.

A crypto price mart should expose fields like:

\`\`\`text
canonical_asset_id
display_symbol
price_usd
observed_at
as_of
freshness_status
source_name
\`\`\`

A portfolio exposure mart should not ask users or agents to know whether \`BTC\`, \`XBT\`, \`bitcoin\`, and a wrapped token refer to the same thing. The mart should already encode the approved business meaning.

This is where data contracts matter. A mart should promise identity, freshness, nullability, and allowed use.

Raw data makes the mart debuggable. It should not make the mart optional.

## The ELT connection

This is why ELT fits modern analytics work.

Extract the data. Load raw-safe data. Transform later where the transformations can be tested, documented, and replayed.

That does not mean loading secrets or sensitive fields blindly. If raw data contains fields the warehouse should never store, remove or tokenize them before loading. That is a safety step, not business normalization.

The useful rule:

\`\`\`text
make data safe before loading
make data meaningful after loading
\`\`\`

That keeps privacy and security boundaries intact without throwing away source evidence.

## Agents need the layers

Agents debug better when the layers are explicit.

If a report is wrong, an agent should be able to inspect:

\`\`\`text
mart row -> staging row -> raw payload -> run log -> quarantine record
\`\`\`

That flow gives the agent evidence. It can see whether the bug came from the source, the parser, the mapping table, the freshness check, or the mart SQL.

If the pipeline only has one cleaned table, the agent has to infer too much. It may still produce an explanation. It will just be less grounded.

Agent-readable pipelines need raw data because agents need traceability.

## The practical rule

Raw data should preserve what arrived, not what you wish had arrived.

Normalize in staging. Publish through marts. Quarantine failed rows. Keep run IDs and source payloads so you can replay and debug.

Raw data is not for everyone. It is for the moment when something looks wrong and you need the truth.

## References

- [What Is ETL and ELT? When to Use One Over the Other](/posts/2026-07-21-what-is-etl-and-elt)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [The Crypto Asset Mapping Table](/posts/2026-07-21-crypto-asset-mapping-table)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
`;export{e as default};