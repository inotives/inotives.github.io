var e=`---
title: "Partitioning, Indexing, and Caching for Faster Crypto Queries"
date: 2026-07-28
tags: [data-engineering, bigquery, clickhouse, partitioning, indexing, caching, crypto]
series: data-engineering
summary: "Fast analytical queries usually come from scanning less data, reading it in a better order, and reusing expensive results. BigQuery and ClickHouse solve this differently, so partitioning, indexing, and caching choices need to match the query shape."
---

# Partitioning, Indexing, and Caching for Faster Crypto Queries

Query speed is mostly about reading less data.

That sounds too simple, but it explains most warehouse tuning work:

\`\`\`text
partitioning   skip whole chunks of data
indexing       find the right rows or blocks faster
caching        avoid recomputing repeated work
\`\`\`

In crypto analytics, bad physical design gets expensive quickly. A table of price ticks, exchange balances, token transfers, or order book snapshots can grow from useful to painful in a few weeks.

The query usually looks innocent:

\`\`\`sql
select *
from prices
where canonical_asset_id = 'btc'
  and observed_at >= timestamp '2026-07-01';
\`\`\`

If the table is not partitioned, sorted, clustered, or cached correctly, that query may scan far more than BTC prices for July.

The best practice is not "add indexes." BigQuery and ClickHouse do not work like a small Postgres app table. You need to design around how each engine reads data.

## Start with query shapes

Do not start with table names. Start with the questions users ask.

For a crypto project:

\`\`\`text
latest price for one asset
daily prices for 500 assets
portfolio exposure for one report date
wallet transfers for one address
all ERC-20 transfers for one contract
order book depth for one exchange pair
failed pipeline runs in the last hour
\`\`\`

Those queries have different access patterns.

\`\`\`text
time range only          partition by date or month
asset plus time          partition by date, cluster or sort by asset
contract plus event      sort by contract and event topic
latest state             cache or materialize latest rows
repeated dashboard       materialized view or serving table
\`\`\`

A table design should make the common query cheap. It will not make every query cheap.

That tradeoff is normal.

## Partitioning: skip whole sections

Partitioning divides a table into larger physical or logical chunks.

Use it when queries usually filter by a natural boundary:

\`\`\`text
report_date
observed_date
block_date
ingested_date
exchange_snapshot_date
\`\`\`

For BigQuery, partitioning reduces bytes scanned when the query filters on the partition column.

For ClickHouse, partitioning is mostly a data management boundary. It helps with pruning in some cases, but the main performance lever is usually \`ORDER BY\`.

Good crypto partition keys:

\`\`\`text
daily prices             report_date or observed_date
hourly price ticks       observed_date, sometimes monthly for huge tables
exchange balances        snapshot_date
chain logs               block_date or block_month
pipeline run logs        started_date
report snapshots         report_date
\`\`\`

Bad partition keys:

\`\`\`text
asset symbol             too many uneven partitions
wallet address           too many tiny partitions
transaction hash         almost always useless
provider_asset_id        high churn and uneven distribution
\`\`\`

The rule: partition by time or lifecycle boundary, not by every filter column.

## BigQuery partitioning

BigQuery supports partitioned tables by ingestion time, time-unit columns, and integer ranges.

For crypto marts, time-unit column partitioning is usually the cleanest.

Example:

\`\`\`sql
create table mart_crypto.daily_asset_prices (
  report_date date,
  canonical_asset_id string,
  provider string,
  price_usd numeric,
  run_id string,
  built_at timestamp
)
partition by report_date
cluster by canonical_asset_id, provider;
\`\`\`

This query is cheap because it filters by partition:

\`\`\`sql
select canonical_asset_id, price_usd
from mart_crypto.daily_asset_prices
where report_date = date '2026-07-28'
  and canonical_asset_id in ('btc', 'eth', 'sol');
\`\`\`

This query is risky because it does not filter by partition:

\`\`\`sql
select canonical_asset_id, avg(price_usd)
from mart_crypto.daily_asset_prices
where canonical_asset_id = 'btc'
group by canonical_asset_id;
\`\`\`

For large BigQuery tables, require partition filters where possible:

\`\`\`sql
create table mart_crypto.daily_asset_prices (
  report_date date,
  canonical_asset_id string,
  price_usd numeric
)
partition by report_date
options (
  require_partition_filter = true
);
\`\`\`

This one setting prevents many accidental full-table scans.

## BigQuery clustering

Clustering sorts table storage blocks by selected columns. BigQuery can then skip blocks that do not match a filter.

Good clustering columns are common filters or joins:

\`\`\`text
canonical_asset_id
provider
exchange_id
account_id
chain_id
contract_address
event_signature
\`\`\`

Column order matters. Put the most selective and commonly filtered columns first.

For asset prices:

\`\`\`sql
partition by report_date
cluster by canonical_asset_id, provider
\`\`\`

For exchange balances:

\`\`\`sql
partition by snapshot_date
cluster by exchange_id, account_id, canonical_asset_id
\`\`\`

For token transfers:

\`\`\`sql
partition by block_date
cluster by chain_id, contract_address, from_address
\`\`\`

Clustering is not free magic. It helps when queries filter or aggregate on clustered columns. It does little for random \`select *\` exploration.

## BigQuery caching

BigQuery has several caching patterns, and they are easy to confuse.

Query result cache:

\`\`\`text
same query text
same underlying table state
temporary cached result
fast and usually free when cache is hit
not a durable dependency for pipelines
\`\`\`

Materialized view:

\`\`\`text
stored precomputed result
automatically or manually refreshed
good for repeated aggregations
managed as a real object
\`\`\`

Derived table:

\`\`\`text
normal table created by dbt or SQL
best for report-critical marts
explicit refresh and audit metadata
\`\`\`

For financial data, do not depend on anonymous query result cache for report production. Use materialized views or explicit mart tables when the result matters.

Example materialized view candidate:

\`\`\`sql
create materialized view mart_crypto.mv_daily_volume_by_asset
partition by report_date
cluster by canonical_asset_id
as
select
  report_date,
  canonical_asset_id,
  sum(volume_usd) as volume_usd
from mart_crypto.exchange_trades
group by report_date, canonical_asset_id;
\`\`\`

Use this when dashboards repeatedly ask for the same daily volume aggregation.

## ClickHouse partitioning

ClickHouse partitioning should stay coarse.

For time-series crypto data, monthly partitions are often a good first choice:

\`\`\`sql
partition by toYYYYMM(observed_at)
\`\`\`

For daily report snapshots:

\`\`\`sql
partition by toYYYYMM(report_date)
\`\`\`

For huge chain logs:

\`\`\`sql
partition by (chain_id, toYYYYMM(block_date))
\`\`\`

Do not create one partition per asset, wallet, or transaction. Too many partitions create metadata and merge overhead.

Partitioning is useful for:

\`\`\`text
dropping old data
moving cold data
backfilling one month
pruning broad time ranges
keeping merges manageable
\`\`\`

It is not the same as a primary index.

## ClickHouse ORDER BY is the real index

In ClickHouse MergeTree tables, \`ORDER BY\` defines the physical sort order. That sort order drives the sparse primary index and has the biggest impact on query speed.

Design \`ORDER BY\` from your queries.

For price history queried by asset and time:

\`\`\`sql
create table prices_tick
(
    observed_at DateTime64(3),
    canonical_asset_id LowCardinality(String),
    provider LowCardinality(String),
    price_usd Decimal(38, 18),
    run_id String
)
engine = MergeTree
partition by toYYYYMM(observed_at)
order by (canonical_asset_id, provider, observed_at);
\`\`\`

This is good for:

\`\`\`sql
select observed_at, price_usd
from prices_tick
where canonical_asset_id = 'btc'
  and provider = 'coingecko'
  and observed_at >= now() - interval 7 day;
\`\`\`

For a dashboard that mostly asks for recent prices across all assets, a different table may be better:

\`\`\`sql
order by (observed_at, canonical_asset_id, provider)
\`\`\`

One table cannot be physically sorted two ways. If both query patterns are important, use a projection, materialized view, or second serving table.

## ClickHouse skipping indexes

Skipping indexes help ClickHouse skip data granules when filters do not align with the primary sort key.

Use them after the main \`ORDER BY\` is right.

Examples:

\`\`\`sql
alter table ethereum_logs
add index idx_topic0 topic0 type bloom_filter(0.01) granularity 4;
\`\`\`

Good candidates:

\`\`\`text
event topic searches
contract address filters not covered by ORDER BY
status codes in run logs
sparse account IDs
\`\`\`

Weak candidates:

\`\`\`text
columns with random distribution across all parts
filters already covered by ORDER BY
columns rarely used in WHERE clauses
low-value indexes added because they feel safe
\`\`\`

The test is simple: run \`EXPLAIN\`, compare marks read, and keep the index only if it reduces real query work.

## ClickHouse materialized views and projections

ClickHouse materialized views are useful for ingest-time rollups.

For example, raw trade ticks can feed a daily volume table:

\`\`\`sql
create table daily_asset_volume
(
    report_date Date,
    canonical_asset_id LowCardinality(String),
    volume_usd Decimal(38, 8)
)
engine = SummingMergeTree
partition by toYYYYMM(report_date)
order by (canonical_asset_id, report_date);
\`\`\`

\`\`\`sql
create materialized view mv_daily_asset_volume
to daily_asset_volume
as
select
    toDate(observed_at) as report_date,
    canonical_asset_id,
    sum(volume_usd) as volume_usd
from trades_tick
group by report_date, canonical_asset_id;
\`\`\`

This makes dashboards cheap because they query pre-aggregated data.

Projections are useful when one table needs another physical layout for common queries. They are heavier than "just add an index", but they can avoid maintaining a separate table manually.

Use materialized views when you need a derived table. Use projections when you need another query path over the same table.

## Caching strategy by workload

Use different caching layers for different jobs:

\`\`\`text
ad hoc analyst query       BigQuery result cache is fine
dashboard aggregation      materialized view or serving table
latest asset price lookup  ClickHouse hot table
report output              versioned mart table, not anonymous cache
agent query endpoint       curated cached view with freshness metadata
\`\`\`

For crypto dashboards:

\`\`\`text
latest prices              ClickHouse table refreshed every minute
daily volume               materialized aggregation
portfolio report           BigQuery or warehouse mart by report_date
long historical replay     lakehouse files queried only when needed
\`\`\`

Caching should not hide staleness. Every cached table or view should expose:

\`\`\`text
data_cutoff_at
refreshed_at
run_id
source_count
freshness_status
\`\`\`

An agent or analyst should be able to see whether the result is current enough for the question.

## Cost controls that actually work

For BigQuery:

\`\`\`text
require partition filters on large tables
partition by report or observed date
cluster by common filter keys
avoid select * on raw JSON-heavy tables
materialize repeated aggregations
use dry runs for expensive query changes
separate exploration datasets from report marts
\`\`\`

For ClickHouse:

\`\`\`text
choose ORDER BY before loading large data
keep partitions coarse
avoid too many skipping indexes
pre-aggregate dashboard queries
use TTL for hot data retention if raw evidence lives elsewhere
measure marks read before and after changes
\`\`\`

For both:

\`\`\`text
design for the top 5 queries
record query cost and latency by route
make stale caches visible
prefer one good table layout over many speculative ones
\`\`\`

Do not tune imaginary workloads. Query logs tell you what is actually expensive.

## A practical design example

Suppose the project has:

\`\`\`text
price ticks every minute
daily portfolio reports
exchange balances every hour
Ethereum transfer logs
\`\`\`

BigQuery tables:

\`\`\`text
mart_crypto.daily_asset_prices
  partition: report_date
  cluster: canonical_asset_id, provider

mart_crypto.hourly_exchange_balances
  partition: snapshot_date
  cluster: exchange_id, account_id, canonical_asset_id

mart_crypto.daily_portfolio_exposure
  partition: report_date
  cluster: portfolio_id, canonical_asset_id
\`\`\`

ClickHouse tables:

\`\`\`text
prices_tick
  partition: toYYYYMM(observed_at)
  order by: canonical_asset_id, provider, observed_at

ethereum_logs
  partition: chain_id, toYYYYMM(block_date)
  order by: contract_address, topic0, block_number, log_index

pipeline_run_events
  partition: toYYYYMM(started_at)
  order by: pipeline_name, status, started_at
\`\`\`

Cached or materialized outputs:

\`\`\`text
daily volume by asset
latest price per asset
latest freshness status
portfolio exposure by report date
\`\`\`

This design keeps common queries cheap without pretending every possible query needs a custom table.

## How to apply this

Use this process:

\`\`\`text
1. Pull the top slow or expensive queries from logs.
2. Group them by access pattern.
3. Pick one partition key per large table.
4. Pick clustering or ORDER BY keys from the most common filters.
5. Add materialized views only for repeated expensive aggregations.
6. Add skipping indexes only after measuring ClickHouse marks read.
7. Add freshness metadata to every cached output.
8. Recheck cost and latency after the change.
\`\`\`

This is enough. Most teams do not need a tuning framework. They need to stop scanning a year of data to answer a one-day question.

## The rule

Partition by the boundary users always filter on.

Cluster or sort by the keys users use inside that boundary.

Cache the results users ask for repeatedly.

For crypto data, that usually means:

\`\`\`text
date partitions
asset, provider, exchange, account, contract, or chain clustering
ClickHouse ORDER BY aligned to dashboard filters
materialized daily or latest-state tables
freshness metadata on every cached result
\`\`\`

Good architecture is not the one with the most indexes. It is the one that makes the normal query cheap and the expensive query obvious.

## References

- [BigQuery partitioned tables](https://docs.cloud.google.com/bigquery/docs/partitioned-tables)
- [BigQuery clustered tables](https://docs.cloud.google.com/bigquery/docs/clustered-tables)
- [BigQuery cached query results](https://docs.cloud.google.com/bigquery/docs/cached-results)
- [BigQuery materialized views](https://docs.cloud.google.com/bigquery/docs/materialized-views-manage)
- [ClickHouse query optimization guide](https://clickhouse.com/resources/engineering/clickhouse-query-optimisation-definitive-guide)
- [ClickHouse best practice tips](https://clickhouse.com/blog/10-best-practice-tips)
- [ClickHouse projections as secondary indexes](https://clickhouse.com/blog/projections-secondary-indices)
- [Lakehouse and Warehouse Architectures with Snowflake, BigQuery, and ClickHouse](/posts/2026-07-28-lakehouse-warehouse-architectures-snowflake-bigquery-clickhouse)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
`;export{e as default};