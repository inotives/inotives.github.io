var e=`---
title: "Data Lineage for Small Crypto Pipelines"
date: 2026-07-24
tags: [data-lineage, crypto, data-engineering, dbt, data-quality, pipelines]
series: data-engineering
summary: "Small crypto pipelines still need lineage. When a report number is wrong, you need to trace it from report to mart, mart to staging, staging to raw source, and through internalized tables like assets and platforms."
---

# Data Lineage for Small Crypto Pipelines

Lineage sounds like an enterprise catalog feature until a number is wrong.

A portfolio report says BTC exposure changed. A price mart shows a strange value. An agent explains a movement that does not reconcile with the wallet balance. Someone asks the only question that matters:

\`\`\`text
Where did this number come from?
\`\`\`

If the answer requires opening five SQL files, guessing which source ran, and manually tracing joins through asset mappings, the pipeline is too opaque.

Small crypto pipelines need lineage. Not a platform. A traceable path.

## The path should be boring

The basic path is:

\`\`\`text
raw -> staging -> internal tables -> marts -> reports
\`\`\`

Raw stores provider truth.

Staging normalizes provider fields.

Internal tables resolve shared identity, like assets, platforms, chains, venues, and mappings.

Marts expose consumer-ready facts.

Reports freeze a version of the answer.

That path should be visible in code, docs, run logs, and dbt lineage.

## Internalized tables matter

Crypto pipelines need internal tables because providers disagree.

CoinGecko has asset IDs. Exchanges have symbols. Token lists have chain IDs and contract addresses. Wallet feeds may report native assets differently from ERC-20 tokens. If every mart joins directly to provider data, every mart re-solves identity in its own way.

That is how reports drift.

Internalized tables give the project one controlled vocabulary:

\`\`\`text
assets
asset_provider_mappings
platforms
chains
venues
\`\`\`

\`assets\` owns canonical asset identity.

\`asset_provider_mappings\` maps provider IDs, symbols, chain IDs, and contract addresses into canonical assets.

\`platforms\` or \`chains\` own network identity, so Ethereum, Base, Solana, and Tron do not become loose strings spread across models.

These tables are not decoration. They are lineage anchors.

When a report number is wrong, you can ask whether the bug came from the source row, the staging parser, the asset mapping, the platform mapping, the mart join, or the report version.

## dbt lineage is the first map

dbt gives you a useful graph for free if models use \`ref()\` and \`source()\` properly.

For example:

\`\`\`text
source('coingecko', 'coins')
  -> stg_coingecko__coins
  -> asset_provider_mappings
  -> mart__assets
  -> agent__asset_lookup
\`\`\`

And:

\`\`\`text
source('wallet', 'balances')
  -> stg_wallet__balances
  -> mart__portfolio_exposure
  -> report__monthly_exposure
\`\`\`

That graph helps humans and agents avoid random file search. It shows the dependency chain before debugging starts.

The graph is not enough by itself, but it is the first map.

## Run IDs connect data to execution

Model lineage tells you which tables depend on which tables.

Run lineage tells you which execution produced the rows.

Every raw row, staging row, quarantine row, mart build, and report version should carry or link to a run ID:

\`\`\`text
source_run_id
transform_run_id
backfill_run_id
report_run_id
\`\`\`

If a report changed after a backfill, the lineage should show that.

\`\`\`json
{
  "report_id": "monthly_exposure_2026_06",
  "report_version": 2,
  "source_run_id": "2026-06-30T235500Z",
  "backfill_run_id": "backfill_2026-07-23T021500Z",
  "mapping_version": "asset_mapping_v3"
}
\`\`\`

Now the wrong-number investigation has a trail.

## Debugging a wrong number

Suppose a report says USDC exposure dropped by $12,000.

The debug path should be mechanical:

\`\`\`text
report version -> mart row -> asset mapping -> staging balance -> raw payload -> run log
\`\`\`

Questions:

- Did the report use the expected version?
- Did the mart use the correct \`canonical_asset_id\`?
- Did the asset mapping use the correct effective window?
- Did staging parse the chain and contract correctly?
- Did raw data contain the balance?
- Did the run log show quarantine or freshness issues?

This is where internal tables pay off. If USDC on Ethereum and USDC on Base collapsed too early, the lineage path exposes the layer where that happened.

Without lineage, the agent or analyst guesses.

## Catalog metadata should expose lineage

The minimum viable catalog should describe tables and show how they connect.

For each mart, store:

\`\`\`text
upstream_sources
upstream_models
internal_tables_used
join_keys
freshness_source
report_outputs
\`\`\`

Example:

\`\`\`json
{
  "dataset": "mart__portfolio_exposure",
  "upstream_sources": ["wallet.balances", "coingecko.prices"],
  "internal_tables_used": ["assets", "asset_provider_mappings", "platforms"],
  "join_keys": ["canonical_asset_id", "platform_id"],
  "freshness_source": "mart__asset_prices.observed_at",
  "report_outputs": ["report__monthly_exposure"]
}
\`\`\`

That is enough for an MCP metadata tool to answer, "What does this report depend on?"

## Agent-readable lineage

Agents need lineage in small chunks.

Useful tool responses:

\`\`\`text
describe_dataset(mart__portfolio_exposure)
trace_report(monthly_exposure_2026_06)
show_upstream(mart__asset_prices)
show_latest_runs_for_dataset(mart__portfolio_exposure)
\`\`\`

The response should include the next useful handles: model name, run ID, report version, contract path, and open review items.

Do not make the agent rediscover lineage by reading every SQL file. Give it the map, then let it inspect the suspicious layer.

## The practical rule

Lineage is the ability to explain a number without guessing.

For a small crypto pipeline, keep the path explicit: raw to staging, staging through internalized assets and platforms, internal tables into marts, marts into versioned reports. Use dbt lineage for the model graph. Use run IDs for execution. Expose enough metadata for agents and humans to trace wrong numbers quickly.

If you cannot answer where the number came from, the pipeline is not finished.

## References

- [The Minimum Viable Data Catalog for a Solo Crypto Project](/posts/2026-07-22-minimum-viable-data-catalog-solo-crypto-project)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [The Crypto Asset Mapping Table](/posts/2026-07-21-crypto-asset-mapping-table)
- [Point-in-Time Correctness in Crypto Analytics](/posts/2026-07-24-point-in-time-correctness-crypto-analytics)
- [Backfills Without Breaking Crypto Reports](/posts/2026-07-23-backfills-without-breaking-crypto-reports)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
`;export{e as default};