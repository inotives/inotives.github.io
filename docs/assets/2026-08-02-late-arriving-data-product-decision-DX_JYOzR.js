var e=`---
title: "Late-Arriving Data Is a Product Decision, Not a Scheduler Problem"
date: 2026-08-02
tags: [data-engineering, crypto-data, data-quality, dbt]
summary: "Late records are normal in financial and crypto pipelines. The hard part is deciding which reports may change, how long a mart waits, and how corrections become reproducible instead of surprising."
series: data-engineering
---

# Late-Arriving Data Is a Product Decision, Not a Scheduler Problem

At 10:05, a dashboard says BTC traded at $104,200 during the 10:00 minute. At 10:17, the provider delivers trades from that same minute. At 11:00, it corrects one of them.

None of this is unusual. Networks retry. Exchanges publish delayed snapshots. Providers repair their own gaps. A chain indexer may discover a block after a reorganization settles. The failure is treating every late record as a scheduler bug and every rebuilt aggregate as harmless.

The real question is product-facing: when is a report allowed to change, and how will a consumer know that it did?

## Event time and ingestion time answer different questions

Every market-data record needs at least two timestamps:

\`\`\`text
event_time:     when the trade, candle, balance, or chain event happened
ingested_at:    when your pipeline received it
\`\`\`

\`event_time\` tells you where the record belongs in an analysis. \`ingested_at\` tells you what your system knew at a particular moment.

If a 10:00 trade arrives at 10:17, it belongs in the 10:00 candle. A report produced at 10:05 could not have included it. Both facts must remain true.

This is where pipelines often make history look cleaner than it was. They overwrite the 10:00 aggregate, then an agent or analyst reruns yesterday's report and gets a number that did not exist yesterday. The SQL may be correct. The product behavior is still wrong.

Keep both timestamps in raw and modeled data. Do not infer arrival time from a batch filename or a job log that may disappear.

## A watermark is a promise about lateness

A watermark is the line after which the pipeline considers a period complete enough to publish. It is not a universal number.

For a liquid exchange's minute candles, a five-minute lateness window might be reasonable. For on-chain transfer data, the window may depend on confirmation depth. For monthly provider metadata, waiting a day may be cheap and sensible.

Write the policy down per mart:

\`\`\`yaml
mart: mart_exchange_minute_prices
event_time_column: minute_start
publish_after: 5 minutes
correction_window: 24 hours
late_record_policy: recompute_affected_minutes
after_correction_window: quarantine_and_open_review_item
\`\`\`

This says more than "the job runs every five minutes." It tells consumers when a number becomes available, how long it can still move, and what happens when a correction arrives too late for the normal path.

The window is a business choice. A trading alert might prefer a fast, provisional number. A finance report might wait longer for a stable close. Calling both outputs "the price" hides an important difference.

## Recompute the smallest affected range

Late data does not require rebuilding a warehouse table from the beginning of time. It requires finding the affected event-time range and replaying the transformation for that range.

For minute prices, that might be one minute. For a daily OHLC aggregate, one late trade near midnight can affect the open, high, low, close, volume, and trade count for a day. The proper repair boundary comes from the model's grain, not the raw record's size.

A dbt incremental model can make that boundary explicit:

\`\`\`sql
{{ config(
    materialized='incremental',
    unique_key=['provider_id', 'symbol', 'minute_start']
) }}

with source as (
    select *
    from {{ ref('stg_provider_trades') }}
    where event_time >= current_timestamp - interval '24 hours'
),

minutes as (
    select
        provider_id,
        symbol,
        date_trunc('minute', event_time) as minute_start,
        min_by(price, event_time) as open_price,
        max(price) as high_price,
        min(price) as low_price,
        max_by(price, event_time) as close_price,
        sum(quantity) as volume
    from source
    group by 1, 2, 3
)

select * from minutes
\`\`\`

The 24-hour range is a correction window, not a magic optimization. Its length belongs in the mart contract. If the provider routinely revises 48 hours of history, the model should say so or route the exception to review.

## Preserve the record that arrived late

Do not update raw data in place to make it look punctual. A late arrival is evidence about the provider and the pipeline.

Raw records should retain provider identifiers, \`event_time\`, \`ingested_at\`, source payloads where appropriate, and the run that received them. The modeled mart can update its affected bucket. The raw layer should let you answer a later question: did the provider publish this then, or did we fail to ingest it?

That distinction changes the incident response. A provider delay may call for a freshness warning. An ingestion outage needs an operational fix. A parser bug may require a controlled replay from immutable raw data.

## Provisional and final are useful product states

Teams often have a binary mental model: data is either correct or broken. Late-arriving data needs a third state: provisional.

For example:

\`\`\`text
10:05  10:00 candle published as provisional
10:10  watermark passes; candle is final for live consumers
10:17  late trade arrives; candle is corrected within its 24-hour window
10:18  correction version is published with a revised_at timestamp
\`\`\`

The word "final" still needs care. It means final under the stated correction policy, not metaphysically impossible to revise. For high-stakes consumers, expose \`data_status\`, \`revised_at\`, and a report or mart version. An API client can decide whether to accept a provisional candle; a weekly report can pin the version it used.

This avoids a familiar failure mode: a user asks why a historical number changed, and the team has to reconstruct it from job logs after the fact.

## Route exceptions out of the normal path

The normal correction window should handle normal provider behavior. A record that arrives six months late needs a different decision. It may be valid, a provider backfill, or a malformed timestamp.

Quarantine it with enough context for a small review item:

\`\`\`yaml
status: review_required
reason: event_time falls outside mart correction window
provider: example_exchange
symbol: BTC/USDT
event_time: 2026-02-01T10:00:00Z
ingested_at: 2026-08-02T09:00:00Z
affected_mart: mart_exchange_minute_prices
next_action: confirm provider backfill before historical replay
\`\`\`

Do not silently force it into today's incremental window. Do not discard it because it is inconvenient. The review decides whether to launch a versioned historical backfill, change the contract, or reject a bad record.

## Measure lateness as a distribution

A freshness dashboard that shows only the latest successful run can look healthy while records arrive later and later. Measure the gap between \`event_time\` and \`ingested_at\`.

Useful metrics include:

- p50, p95, and p99 arrival lag by provider and dataset;
- the count of records outside the correction window;
- the number of published buckets revised after their watermark;
- the age of the oldest unresolved late-data review item.

These metrics reveal whether the policy matches reality. If p99 lag is twelve minutes and the watermark is five, the pipeline will continually revise supposedly complete data. If no record has ever arrived after two minutes, a 24-hour rebuild window may be wasting compute.

## Make the contract visible to agents

An agent querying a mart needs the same context as a human analyst. Give it a concise contract:

\`\`\`yaml
mart: mart_exchange_minute_prices
grain: one provider, symbol, and minute
freshness: normally available within 5 minutes
stability: may be revised for 24 hours after event time
historical_policy: reports pin a version; do not treat a current query as historical truth
\`\`\`

That prevents an agent from explaining a fresh query as if it were the number that appeared in an earlier report. It also gives a data-quality agent a clear rule for deciding whether a late record should trigger a recomputation or a review item.

## Start with one mart and one correction window

Pick the mart where a late record creates the most confusion. Add \`event_time\` and \`ingested_at\` if they are missing. Define a publish watermark and a correction window. Recompute only the affected range, and record when a published value changes.

The first version does not need a streaming engine or an elaborate temporal database. It needs an honest statement of what the product knew when it published a number, and how long that number can still move.

## References

- [Point-in-Time Correctness in Crypto Analytics](/posts/point-in-time-correctness-crypto-analytics)
- [Backfills Without Breaking Crypto Reports](/posts/backfills-without-breaking-crypto-reports)
- [Corrections Are Not Deletions](/posts/corrections-are-not-deletions)
- [dbt documentation: incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [Apache Beam programming guide: event time and watermarks](https://beam.apache.org/documentation/programming-guide/#watermarks-and-late-data)
`;export{e as default};