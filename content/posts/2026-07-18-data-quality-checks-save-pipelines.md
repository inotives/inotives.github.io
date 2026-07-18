---
title: "Data Quality Checks: The Boring Layer That Saves Pipelines"
date: 2026-07-18
tags: [data-quality, data-testing, dbt, crypto, data-engineering, pipelines]
series: data-engineering
summary: "Data quality checks are the cheap tripwires that stop bad crypto data before it reaches dashboards, agents, and reports. The useful checks are boring: row counts, freshness, uniqueness, nulls, relationships, accepted values, and a few business rules that encode how the domain actually works."
---

# Data Quality Checks: The Boring Layer That Saves Pipelines

Data quality checks are not glamorous. They are not a platform strategy. They are not a new architecture.

They are the small assertions that stop a pipeline from quietly lying.

That matters more in crypto than in most domains. Crypto data has reused symbols, chain-specific contract addresses, stale price feeds, token migrations, exchange-specific tickers, missing metadata, and providers that disagree about the same asset. If those problems reach the mart layer, everything downstream gets more expensive: dashboards, compliance reports, trading summaries, and AI agents all start reasoning from bad facts.

I wrote about [data contracts](/posts/2026-07-18-data-contracts-crypto-pipelines) as the API layer for data. Quality checks are the enforcement layer. A contract says what a dataset promises. A check proves whether today's batch kept that promise.

## The first useful checks are boring

The best starting set is not clever.

For most pipeline tables, I want these checks first:

- row count is not zero
- required columns are not null
- primary keys are unique
- values come from an accepted set where the domain is closed
- foreign keys resolve to the dimension table
- timestamps are fresh enough for the table's SLA
- important numeric values stay inside sane ranges
- the schema did not drift unexpectedly

That is it. No machine learning. No anomaly platform. No profiler dashboard with fifty charts.

If `coingecko.stg__coins_list` has zero rows, I do not need AI to diagnose the first failure. The ingestion broke, the provider changed, credentials failed, or the transform read the wrong source. Stop the run.

If `coingecko_id` is null, stop the run.

If two rows claim the same `coingecko_id`, stop the run.

If a mart joins balances to assets through `symbol`, stop the run and fix the model.

The boring checks catch the expensive failures.

## Where this fits in `market-pipe`

`market-pipe` already has the right shape for this: raw data lands, staging normalizes it, marts expose consumer-facing tables, and dbt sits in the transform layer. The project has also moved toward source-owned model names like `coingecko.stg__<entity>` and `coingecko.mart__<entity>`.

That gives a clean testing rule:

```text
raw: ingestion sanity
staging: normalization and identity checks
marts: consumer-facing guarantees
```

Raw checks should be light. Vendor data is allowed to be ugly. The pipeline should only reject records that cannot be stored safely: malformed JSON, missing local identity, invalid timestamp shape, broken batch metadata.

Staging checks should be stricter. This is where provider-specific mess becomes typed columns. For CoinGecko data, `id`, `symbol`, `name`, `asset_platform_id`, `chain_identifier`, and contract address handling deserve explicit checks because downstream models will trust them.

Mart checks should be strictest. If a mart is used by reports or agents, it should fail loudly when its assumptions break.

A minimal dbt YAML for a CoinGecko staging model might look like this:

```yaml
models:
  - name: coingecko_stg__coins_list
    columns:
      - name: coingecko_id
        data_tests:
          - not_null
          - unique
      - name: symbol
        data_tests:
          - not_null
      - name: name
        data_tests:
          - not_null
```

Then add one singular SQL test for the crypto-specific rule:

```sql
select symbol
from {{ ref('coingecko_stg__coins_list') }}
group by symbol
having count(*) = 1
```

Actually, do not use that test. It is the wrong rule.

Symbols are supposed to collide. That is the point. The useful test is the opposite: prove nobody is treating symbol as identity in the mart. In practice, that means canonical asset joins should go through a provider mapping table or internal asset id, not `symbol`.

This is why domain checks matter. Generic checks tell you whether data is shaped correctly. Domain checks tell you whether the model is lying in a way only your business would notice.

## Where this fits in `agent-pipe`

`agent-pipe` is closer to an event store. It writes records into local SQLite with deterministic identity and run history. The right checks there are not warehouse-style model tests. They are ingestion invariants.

For each record:

- `project_id` exists
- `entity` exists
- `local_id` is deterministic
- `payload_json` parses
- `metadata_json` parses or defaults cleanly
- soft deletes preserve `deleted_at`
- reruns do not duplicate records

Those checks are enough. More would be decoration.

This matters because `market-pipe` can ingest from `agent-pipe`. If the local store has weak identity, the warehouse inherits that weakness. If local reruns duplicate records, dbt tests later catch symptoms, but the bug started earlier.

Quality checks should sit as close as possible to the point where the assumption is created.

## The crypto checks I would add first

For a crypto market-data pipeline, I would start with these.

Identity checks:

- provider asset id is present
- internal asset id is present after mapping
- provider id plus provider name is unique
- contract address is paired with chain id where applicable
- symbol is never used as a primary key

Freshness checks:

- market prices are updated within the expected interval
- daily reference tables arrive before the transform window
- exchange balances have an as-of timestamp
- stale provider batches do not overwrite newer records

Range checks:

- prices are non-negative
- circulating supply is non-negative
- percentage values stay within expected bounds
- volume does not become negative

Relationship checks:

- every staged price has a known asset
- every token contract maps to a chain
- every balance row maps to a venue or wallet
- every mart row traces back to a raw source

Business checks:

- wrapped assets are not collapsed into native assets unless explicitly mapped
- token migrations keep historical validity windows
- delisted assets remain queryable for historical reporting
- compliance report tables do not include unmapped assets

That last group is where most teams under-invest. It is also where the money is.

## dbt is enough for the first version

The lazy path for `market-pipe` is dbt tests.

dbt ships with four generic data tests: `unique`, `not_null`, `accepted_values`, and `relationships`. They cover a surprising amount of ground. For everything else, a singular dbt test is just a SQL query that returns failing rows. If the query returns zero rows, the test passes.

That model fits data engineering work because failed rows are the debugging artifact. You do not want a vague "data quality score." You want the exact asset id, timestamp, and source row that broke the assumption.

Example:

```sql
select
  asset_id,
  provider,
  symbol,
  price_usd,
  observed_at
from {{ ref('coingecko_mart__prices') }}
where price_usd < 0
```

That is a complete test. It is boring and good.

If the project later needs richer validation across files, Spark, or multiple warehouses, Great Expectations, Soda, Deequ, or Data Contract CLI can enter. But I would not start there. A pile of simple SQL tests in dbt will catch the first class of failures with almost no new machinery.

## Tests are not observability

There is one trap: treating checks as the whole data quality system.

Checks enforce known rules. Observability catches unexpected behavior.

You need both eventually, but not at the same time and not everywhere. A dbt `not_null` test catches a required field going missing. It will not tell you that CoinGecko returned 40% fewer coins than usual unless you wrote a row-count threshold. It will not know that a daily file usually arrives by 00:15 UTC unless you track freshness. It will not spot distribution drift unless you measure distributions over time.

Start with checks. Add observability where the table is important enough and failure patterns are not fully predictable.

For crypto, that usually means prices, balances, market volume, compliance events, and customer-facing marts.

## What to do on failure

Every check needs a failure action. Without that, the check becomes a dashboard tile nobody reads.

My default failure policy:

```text
raw parse failure: quarantine the record
raw batch failure: mark run failed, keep prior good data
staging identity failure: fail dbt
mart contract failure: fail dbt and block publish
freshness warning: alert
freshness failure: block agent/reporting use
```

The important part is blocking agent use. An AI agent will happily explain stale data with fresh confidence. If a price mart is stale, the agent should not get to query it for client-facing output. The failure should be machine-readable, not just a Slack message.

This is where the [data contracts post](/posts/2026-07-18-data-contracts-crypto-pipelines) and this one meet. Contracts define who can rely on what. Checks decide whether the contract is currently valid.

## A small testing ladder

If I were adding this to `market-pipe`, I would not build a framework. I would add checks in this order:

1. Primary keys on every staging and mart model: `unique` plus `not_null`
2. Relationships from marts back to dimensions
3. Freshness checks on source data
4. Singular SQL tests for crypto identity rules
5. Stored failures for the tests that need investigation

Then stop.

Only add a broader tool when dbt is no longer enough. The usual signals are cross-source validation, non-warehouse files, business-user-managed checks, historical anomaly detection, or a need to publish quality reports outside the engineering workflow.

Until then, use SQL.

## The practical rule

Put checks at the boundary where bad assumptions become expensive.

In crypto pipelines, that boundary is usually asset identity, provider mapping, price freshness, and public marts. In agentic workflows, it is also the table access layer. Agents should only consume datasets that passed their latest quality checks.

The layer is boring. Good. Boring things are easier to run every day.

## References

- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [Great Expectations documentation](https://docs.greatexpectations.io/docs/core/define_expectations/)
- [Soda data testing](https://docs.soda.io/data-testing)
- [Data Contract CLI documentation](https://docs.datacontract.com/)
- [AWS Deequ data quality at scale](https://aws.amazon.com/blogs/big-data/test-data-quality-at-scale-with-deequ/)
- [Data contracts: the API layer your crypto pipeline is missing](/posts/2026-07-18-data-contracts-crypto-pipelines)
- [Crypto asset data cleanup in agentic spaces](/posts/2026-06-08-crypto-asset-data-cleanup-agentic-spaces)
- [dbt Fusion and Core v2.0](/posts/2026-07-04-dbt-fusion-core-v2-rust-rewrite)
