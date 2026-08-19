---
title: "Data Engineering in 30 Days, Day 30: Build the Capstone and Choose a Direction"
date: 2026-08-19
tags: [data-engineering, learning-path, capstone-project, data-quality]
summary: "Finish the 30-day data engineering path by building a complete two-provider market-price pipeline: preserve raw evidence, standardise records, surface disagreements, publish a daily mart, and report data quality."
series: data-engineering-in-30-days
---

The final day should not end with another tutorial fragment. Build one small system that has a clear input, a repeatable run, a useful output, and visible failure behaviour.

This capstone uses a familiar problem: collect the daily BTC/USDT price from two exchange or market-data providers. Keep each response exactly as received, map both providers into one schema, compare the reported values, publish a daily analytics table, and produce a short quality report. It is small enough for a weekend, yet it forces the same decisions that appear in a larger production pipeline.

## The outcome for day 30

At the end, a scheduled run should produce these layers:

```text
provider APIs
    |
    v
raw provider responses  ->  standardised price records  ->  disagreement checks
                                                              |
                                                              v
                                                        daily price mart
                                                              |
                                                              v
                                                       quality report
```

The capstone is successful when a reader can answer five ordinary questions without opening application logs:

- What did each provider actually return?
- What price did the pipeline publish for a given day?
- Did the providers disagree, and by how much?
- Did the job run with fresh, complete input?
- Which code and rule produced the final number?

That is a better finish line than "the script called an API successfully."

## 1. Choose the smallest useful contract

Start with one instrument and one grain. For example: one row per provider, symbol, and observed minute. Do not begin with every cryptocurrency, every exchange, live WebSockets, or a prediction model. Those are separate projects.

Write the contract down before writing the extractor:

```yaml
instrument: BTC/USDT
providers: [binance, coinbase]
grain: one observation per provider per minute
published_mart: one row per UTC day
acceptable_price_gap_bps: 50
freshness_target_minutes: 10
```

Fifty basis points is 0.50%. The number is a business rule, not a universal truth. A liquid pair may justify a tighter threshold; an illiquid asset or providers with different market coverage may need a wider one. Put the rule in version-controlled configuration so it can be reviewed and changed deliberately.

## 2. Preserve raw responses first

The raw layer is evidence. Store the response body, the retrieval time, provider name, request URL or endpoint identifier, HTTP status, and a run ID. A database JSON column, object storage, or line-delimited JSON file can all work for this project.

```sql
create table raw_price_response (
  response_id text primary key,
  run_id text not null,
  provider text not null,
  retrieved_at timestamptz not null,
  endpoint text not null,
  http_status integer not null,
  payload jsonb not null
);
```

Avoid overwriting yesterday's response with today's response. If Binance calls its field `lastPrice` and another provider calls it `price`, the original payload lets you inspect the mapping later. It also makes a provider dispute tractable: you can show what was received rather than reconstructing it from a transformed table.

Treat error bodies as raw evidence too. A 429 rate-limit response or a malformed payload tells you why a provider was absent from the mart. Hiding it behind a `null` turns an operational problem into a data mystery.

## 3. Standardise into a shared schema

Raw provider responses are deliberately provider-shaped. The standardised layer is where the project gives their values shared meaning.

```sql
create table stg_market_price (
  response_id text primary key references raw_price_response(response_id),
  provider text not null,
  canonical_symbol text not null,
  provider_symbol text not null,
  observed_at timestamptz not null,
  retrieved_at timestamptz not null,
  price numeric(20, 8) not null,
  quote_currency text not null,
  parse_status text not null,
  parse_error text
);
```

`canonical_symbol` is `BTC/USDT`; `provider_symbol` records the provider's spelling, such as `BTCUSDT`. Keep both. The canonical value makes joins reliable, while the original is useful when an API changes its convention.

The transformation should be boring and explicit. Parse a timestamp into UTC. Convert numeric strings to a decimal type. Reject an unexpected quote currency rather than quietly comparing US dollars with USDT. If a provider returns a field with the wrong type, retain the raw response and write a failed standardisation row with a useful error message.

## 4. Make disagreement a first-class dataset

Two providers will sometimes disagree. One may be stale, one may have returned a different market, and one may simply have an upstream incident. Do not make the disagreement disappear by taking the first non-null value.

For each minute where both values exist, calculate a gap in basis points:

```sql
with paired as (
  select
    date_trunc('minute', a.observed_at) as observed_minute,
    a.price as binance_price,
    b.price as coinbase_price
  from stg_market_price a
  join stg_market_price b
    on date_trunc('minute', a.observed_at) = date_trunc('minute', b.observed_at)
   and a.canonical_symbol = b.canonical_symbol
  where a.provider = 'binance'
    and b.provider = 'coinbase'
    and a.parse_status = 'valid'
    and b.parse_status = 'valid'
)
select
  *,
  abs(binance_price - coinbase_price)
    / nullif((binance_price + coinbase_price) / 2, 0) * 10000 as gap_bps
from paired;
```

Store that result in a `fct_price_disagreement` table. Add a policy column such as `within_threshold`, `warning`, or `blocked`. The published mart can use a documented rule, for example the median of valid provider prices when the gap is within the threshold. When it is not, publish a flagged row or hold the value back. The right response depends on the consumer. A dashboard can show a warning; a liquidation engine should fail closed.

## 5. Publish a narrow daily mart

The daily mart is for consumers. It should not expose raw JSON or force every dashboard author to understand provider-specific details.

```sql
create table mart_daily_btc_usdt_price as
select
  date_trunc('day', observed_at)::date as price_date,
  canonical_symbol,
  avg(price) as average_price,
  min(price) as low_price,
  max(price) as high_price,
  count(*) as valid_observations,
  count(distinct provider) as provider_count,
  max(retrieved_at) as latest_retrieved_at
from stg_market_price
where canonical_symbol = 'BTC/USDT'
  and parse_status = 'valid'
group by 1, 2;
```

In a real project, make this an incremental dbt model with a unique key such as `(price_date, canonical_symbol)`. Attach tests: the date and symbol cannot be null, `provider_count` must be at least one, and the day must have enough observations to call it complete.

The point is not the exact average. It is the boundary. A report, dashboard, or agent should query `mart_daily_btc_usdt_price`, not reach into a raw provider table and reinvent the rules.

## 6. Write a quality report that an on-call human can use

A compact report makes the pipeline's health visible. It can be a Markdown file, a Slack message, or a table viewed by a dashboard. Start with facts that lead to action.

```text
Run: 2026-08-19T01:00:00Z
Symbol: BTC/USDT
Providers requested: 2
Providers with valid prices: 2
Newest observation: 2026-08-19T00:59:12Z
Observations this UTC day: 1,438 / expected 1,440
Largest provider gap: 18.4 bps
Rows with parse errors: 0
Result: pass with 2 missing observations
```

The expected count needs an explicit rule. With one observation per minute from two providers, a full UTC day expects 2,880 raw observations, though maintenance windows and an initial partial day will change that. Say which figure the report uses and why. A count without a denominator is decorative.

Useful checks for this capstone are simple:

- freshness: the newest valid observation is no older than ten minutes;
- completeness: each expected provider has enough observations for the run window;
- validity: prices are positive and parse successfully;
- consistency: provider gaps stay within the agreed threshold;
- schema: expected fields and types still exist in each payload.

When a check fails, retain the output and make the report fail clearly. A green report made from missing data is worse than a noisy red one.

## 7. Test the unpleasant paths on purpose

The happy path is easy: two APIs respond with valid prices. Add fixtures for the cases that will eventually happen:

| Fixture | Expected result |
| --- | --- |
| Provider returns HTTP 429 | Raw error retained; provider marked unavailable; quality report fails or warns by policy. |
| Provider removes the price field | Schema check fails; no invented price enters the mart. |
| One response arrives ten minutes late | Freshness check flags the provider; run stays traceable. |
| Prices differ by 120 bps | Disagreement row is stored and the mart follows the documented policy. |
| The job retries after a crash | Existing response IDs prevent duplicate standardised rows. |

Fixtures give the capstone a repeatable test environment. Run them locally before connecting real credentials, then run a staging job with a short lookback window before enabling the scheduled production job.

## 8. Make the project easy to run and inspect

Keep the repository legible. A minimal layout is enough:

```text
src/
  extract/          provider clients and raw-response writer
  transform/        normalisation and reconciliation logic
dbt/
  models/           staging models, disagreement fact, daily mart
  tests/            schema and data-quality tests
fixtures/           saved success and failure provider responses
reports/            generated run-quality reports
README.md           run instructions, contracts, and known limits
```

Add a single command for the local happy path and a separate command for fixture tests. Document the data contract and explain the reconciliation policy in the README. Version-control the code, dbt models, tests, and configuration. Do not commit API tokens or live raw payloads that contain secrets.

This is also a good point to use the delivery workflow from days 25-26: local fixtures first, staging with a bounded amount of real data, then production. A failed production run should be safe to rerun. It should either reuse the recorded raw response or create a new traceable run, never silently alter a previous result.

## 9. Choose where to go next

Once this capstone works, choose a direction based on the part that held your attention. The project is deliberately narrow so that each extension has a visible reason to exist.

| If you enjoyed... | Go deeper with... |
| --- | --- |
| SQL models and business definitions | dbt, dimensional modelling, warehouse performance, semantic layers |
| API extraction and reliable delivery | incremental loads, orchestration, retries, secrets, infrastructure |
| late or high-volume data | Kafka, Flink or Spark Structured Streaming, event-time design |
| alerts and failure investigation | data observability, lineage, incident response, SLOs |
| AI applications | retrieval pipelines, agent tool contracts, evaluation environments, audit trails |

Pick one extension. For example, add a third provider only after the two-provider disagreement policy has been tested. Or replace the daily batch with a streaming consumer only after the batch result is trusted enough to use as a reconciliation baseline.

## A practical definition of done

Your capstone is done when it can be cloned, configured with test data, run from scratch, and inspected by someone other than you. It has raw evidence, a standard schema, a published mart, visible quality results, and tests for at least a few bad days.

That is the skill behind data engineering work: making a useful number defensible after the source system, a provider, or a deployment behaves badly.

## Terminology to learn with an LLM

Use these prompts to deepen the parts you choose next:

- "Explain idempotency in a data ingestion pipeline using response IDs and a retry after a crash."
- "Show the difference between raw, staging, fact, and mart tables with a two-provider market-price example."
- "How should a data-quality policy distinguish warning, quarantine, and failed-run outcomes?"
- "Explain basis points and show a SQL calculation for comparing two provider prices."
- "Design a dbt project with source freshness, schema tests, and an incremental daily market-price mart."

## References

- [CCXT Manual](https://docs.ccxt.com/)
- [dbt documentation: data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt documentation: incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [OpenLineage documentation](https://openlineage.io/docs/)
- [Data Engineering in 30 Days, Day 23-24: Observability and data quality](/posts/2026-08-17-data-engineering-day-23-24-data-observability-quality)
- [Data Engineering in 30 Days, Day 29: Data for AI systems](/posts/2026-08-18-data-engineering-day-29-data-for-ai-systems)
