---
title: "Freshness Is a Data Quality Dimension"
date: 2026-07-19
tags: [data-quality, freshness, crypto, data-engineering, dbt, market-data]
series: data-engineering
summary: "Freshness is not a monitoring afterthought. For crypto pipelines, stale data can be worse than missing data because dashboards, reports, and agents will still treat it as current unless the pipeline makes age visible and enforceable."
---

# Freshness Is a Data Quality Dimension

Most teams notice data freshness only after someone asks why the dashboard looks wrong.

The row count is fine. The schema is fine. The dbt tests are green. The agent can query the table. The report renders.

Then someone checks the timestamp and finds out the prices are nine hours old.

That is a data quality failure. It just does not look like the usual one.

Freshness belongs beside null checks, uniqueness, relationships, accepted values, and range checks. A table can have the right columns, the right types, and the right keys while still being unusable because it arrived too late.

Crypto makes this obvious. A stale daily reference table is annoying. A stale price feed can make a portfolio report wrong. A stale compliance alert can create a real operational problem. A stale table exposed to an AI agent is worse, because the agent may explain old data with fresh confidence.

## Fresh does not mean "recent"

"Recently updated" is not a useful promise.

Freshness needs a clock, a source, and a tolerance.

For example:

```text
coingecko.mart__prices must include BTC and ETH prices observed within 15 minutes of the report run.
coingecko.stg__coins_list must be loaded successfully at least once every 24 hours.
wallet.mart__balances must expose an as_of timestamp and block client-facing use after 30 minutes.
```

Those are different promises because the tables do different jobs.

Reference data changes slowly. Price data changes constantly. Balance data is tied to a point in time. Compliance data may need a stricter threshold than anything else in the warehouse.

The mistake is treating every table as if one freshness rule fits all of them.

## Three timestamps, three meanings

Freshness bugs often start with sloppy timestamp names.

In a market-data pipeline, I want three different times kept separate:

- `observed_at`: when the value was true at the source
- `ingested_at`: when the pipeline stored it
- `transformed_at`: when the warehouse model was built

These are not interchangeable.

If CoinGecko reports a price observed at 10:00, the collector stores it at 10:03, and dbt builds the mart at 10:10, the business freshness is probably about `observed_at`. The pipeline freshness may be about `ingested_at`. The warehouse build status is about `transformed_at`.

Using only `updated_at` hides that distinction. It lets stale values look fresh because the row was rewritten, not because the source value changed.

That is how a pipeline lies politely.

## Where freshness fits in `market-pipe`

`market-pipe` has the right kind of boundary for this problem: raw ingestion, staging models, and marts.

I would keep the rules simple.

Raw data should record when the source returned the payload and when the local pipeline stored it. Do not try to prove business freshness here. Raw data is allowed to be uneven.

Staging should normalize timestamp meaning. If the source has a vendor timestamp, name it clearly. If the pipeline only knows ingestion time, say that. Do not let one generic `timestamp` column survive into the mart layer.

Marts should enforce consumer freshness. If a price mart is used for reporting, the freshness rule belongs close to that mart. If the mart is stale, reports and agents should not treat it as available.

The boring version is enough:

```text
raw: store observed_at if the source provides it, always store ingested_at
staging: normalize timestamp names and time zones
marts: expose as_of and fail or block when as_of is too old
```

No platform needed to start. A SQL test and one status table can carry a lot of weight.

## Freshness is not the same as uptime

A job can run on schedule and still produce stale data.

Maybe the source returned cached values. Maybe the API gave yesterday's candle because today's market has not closed. Maybe a retry reused the last good payload. Maybe the transform rebuilt from old raw rows after ingestion failed.

This is why freshness checks should inspect the data and the orchestrator.

An Airflow DAG success, a cron exit code, or a green GitHub Actions check tells you the process ran. It does not prove the table is fresh.

For a crypto price mart, the check should ask the table:

```sql
select max(observed_at) as latest_observed_at
from {{ ref('coingecko_mart__prices') }}
where asset_id in ('btc', 'eth')
```

Then compare that value with the freshness contract for the dataset.

The exact SQL will vary by warehouse and model names. The point is boring: measure the age of the facts, not the health of the job wrapper.

## Stale data should have a failure mode

Freshness checks are useless if stale data keeps flowing.

I prefer a small set of outcomes:

- warn when a low-risk reference table is late
- fail the transform when a required source is too old
- block agent and report access when a public mart is stale
- keep serving the last good dataset only if the UI labels it clearly

That last line matters. "Last known good" is sometimes the right operational choice. It is not the same as fresh.

If a portfolio dashboard needs to stay online, show the stale `as_of` time. If an agent is answering a client-facing question, stale market data should be machine-readable so the agent can refuse or qualify the answer. A Slack alert does not help if the agent never sees it.

## Where this fits with data contracts

Freshness should be part of the data contract.

A contract that says `price_usd` is a number but says nothing about age is incomplete. The consumer needs to know what the field means and when it stops being safe to use.

A minimal contract section could look like this:

```yaml
freshness:
  timestamp: observed_at
  max_age_minutes: 15
  required_assets: [btc, eth]
  on_failure: block_publish
```

For a daily reference table, it might be:

```yaml
freshness:
  timestamp: ingested_at
  max_age_hours: 24
  on_failure: warn
```

The important part is not the YAML shape. It is the decision. Every important dataset should say which timestamp defines freshness, how old is too old, and what happens when the promise breaks.

## Agents need freshness metadata

Agents do not naturally know when data is stale.

They see a table. They see columns. They see plausible rows. Unless the tool response or schema exposes freshness, the agent has to guess.

That is a bad default.

For agent-facing analytics, I would expose freshness in the tool boundary:

```json
{
  "dataset": "coingecko.mart__prices",
  "as_of": "2026-07-20T08:15:00Z",
  "freshness_status": "stale",
  "max_age_minutes": 15
}
```

Then the agent can make the right move: refuse a current-price answer, ask to refresh the dataset, or say exactly how old the data is.

This is where freshness becomes part of agent safety. Not safety in the abstract policy sense. Plain operational safety: do not let software present old market data as current.

## The checks I would add first

For a crypto pipeline, I would start with four checks.

First, every consumer-facing mart gets an `as_of` timestamp. If the mart cannot explain its age, it is not ready for agents or reports.

Second, price tables get a max-age check on `observed_at`, not just `ingested_at`.

Third, reference tables get a slower freshness check. Coin lists, asset platforms, and provider mappings do not need minute-level freshness, but they should not drift for days without anyone noticing.

Fourth, freshness status becomes part of the query interface. If an MCP tool or agent helper returns market data, it should also return the dataset age or freshness status.

That is enough for the first version.

## The practical rule

Freshness is a quality rule, not a dashboard decoration.

If a dataset has consumers, define how fresh it must be. If it is stale, make that state visible to code. If the data feeds agents, do not rely on a human reading an alert somewhere else.

The pipeline should answer three questions before anyone trusts the output:

- What time does this data represent?
- How old is too old for this use case?
- What happens when the data is stale?

If those answers are missing, the table is only pretending to be production-ready.

## References

- [dbt source freshness](https://docs.getdbt.com/docs/deploy/source-freshness)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [Data Contracts: The API Layer Your Crypto Pipeline Is Missing](/posts/2026-07-18-data-contracts-crypto-pipelines)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Crypto asset data cleanup in agentic spaces](/posts/2026-06-08-crypto-asset-data-cleanup-agentic-spaces)
