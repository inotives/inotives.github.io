var e=`---
title: "Lakehouse and Warehouse Architectures with Snowflake, BigQuery, and ClickHouse"
date: 2026-07-28
tags: [data-engineering, lakehouse, warehouse, snowflake, bigquery, clickhouse, crypto]
series: data-engineering
summary: "Snowflake, BigQuery, and ClickHouse can all support serious analytical systems, but they optimize for different shapes of work. A crypto data platform should choose storage, compute, partitioning, clustering, and serving layers based on freshness, cost, latency, and audit needs."
---

# Lakehouse and Warehouse Architectures with Snowflake, BigQuery, and ClickHouse

The warehouse question is rarely "which database is best?"

The better question is:

\`\`\`text
what data are we storing
who queries it
how fresh it must be
how often it changes
how much audit history we need
how expensive wrong answers are
\`\`\`

Crypto data makes this decision sharper. A project may need hourly prices, exchange balances, wallet transfers, chain events, provider mappings, risk marts, and report snapshots. Some tables are tiny and important. Some are huge and cheap. Some need sub-second dashboards. Some need point-in-time correctness for filing evidence.

Snowflake, BigQuery, and ClickHouse can all fit into this world, but they are not the same tool.

## Lakehouse vs warehouse

A data warehouse stores structured analytical data behind a managed SQL engine. It is usually where curated marts, BI dashboards, finance reports, and governed data products live.

A lakehouse keeps data in open files, usually on object storage, and adds table metadata on top. Formats like Apache Iceberg, Delta Lake, and Apache Hudi turn Parquet files into tables with schema evolution, snapshots, and safer concurrent writes.

The practical split:

\`\`\`text
warehouse   fast governed SQL over curated tables
lakehouse   open storage, long retention, multi-engine access
\`\`\`

In crypto, the lakehouse is useful for:

\`\`\`text
raw exchange payloads
historical API responses
chain event archives
large Parquet backfills
immutable filing evidence
data shared across engines
\`\`\`

The warehouse is useful for:

\`\`\`text
staging models
asset mappings
portfolio exposure marts
daily NAV reports
analyst queries
agent-safe marts
\`\`\`

Many real systems use both. Raw and historical data stay in open storage. Curated marts move into the warehouse or a fast serving engine.

## The reference crypto architecture

A practical crypto architecture can look like this:

\`\`\`text
providers and exchanges
-> object storage raw zone
-> lakehouse tables for raw and historical data
-> warehouse staging and marts
-> low-latency serving tables
-> reports, dashboards, agents
\`\`\`

For example:

\`\`\`text
CoinGecko payloads       -> S3/GCS Parquet + Iceberg
Binance balances         -> raw warehouse table + archived payloads
Ethereum logs            -> object storage partitioned by chain/date/block
asset mappings           -> governed warehouse table with valid_from/valid_to
daily portfolio marts    -> Snowflake or BigQuery
real-time price board    -> ClickHouse
regulatory report output -> versioned report table and immutable files
\`\`\`

The design choice is not whether everything goes into one system. The choice is which system owns which workload.

## Snowflake: governed warehouse with lakehouse options

Snowflake is a managed data platform with separated storage, compute, and cloud services.

The main building blocks:

\`\`\`text
databases and schemas       logical organization
tables                      managed warehouse storage
virtual warehouses          independent compute clusters
micro-partitions            automatic storage layout units
stages                      access to external files
external tables             query files outside Snowflake
Iceberg tables              open table format with external storage options
streams and tasks           change capture and scheduled SQL work
dynamic tables              automatically refreshed transformation tables
\`\`\`

Snowflake is strong when governance, role-based access, operational simplicity, and SQL workloads matter.

For a crypto project, Snowflake fits:

\`\`\`text
finance marts
daily NAV tables
regulatory report snapshots
canonical asset mappings
provider mapping history
audited correction tables
analyst workspaces
\`\`\`

A simple Snowflake layout:

\`\`\`text
RAW
  raw_coingecko_prices
  raw_exchange_balances

STAGING
  stg_coingecko__prices
  stg_binance__balances

CORE
  dim_assets
  dim_platforms
  asset_provider_mappings

MART
  mart__daily_asset_prices
  mart__portfolio_exposure
  mart__daily_nav

REPORTING
  report__daily_nav_versions
\`\`\`

For optimization, start boring:

\`\`\`text
separate compute warehouses for ingest, dbt, analysts, and reports
cluster only large tables with repeated filter patterns
use transient tables for rebuildable intermediate data
keep report-critical tables permanent
use zero-copy clones for testing risky changes
use Time Travel for recovery windows
use Iceberg tables when open storage is the source of truth
\`\`\`

Snowflake's big advantage is operational neatness. Teams can isolate compute so a heavy analyst query does not starve a dbt build. They can clone schemas before a migration. They can keep controlled report outputs in governed tables.

The trap is cost drift. If every workload gets a large always-on warehouse, the bill becomes the architecture review.

## BigQuery: serverless warehouse and lakehouse analytics

BigQuery is a fully managed, serverless analytical platform. Storage and compute are separate, and users do not manage warehouse clusters in the Snowflake sense.

The main building blocks:

\`\`\`text
projects                billing and IAM boundary
datasets                table namespace
tables                  managed storage
external tables         query data outside BigQuery
BigLake                 governed access to lake data
partitioned tables      prune by date, timestamp, ingestion time, or integer range
clustered tables        colocate similar values in storage blocks
materialized views      precomputed query results
reservations and slots  capacity management for predictable workloads
\`\`\`

BigQuery is strong when the team wants low infrastructure management, large-scale SQL, good integration with Google Cloud, and easy querying over managed and external data.

For a crypto project, BigQuery fits:

\`\`\`text
large historical price tables
wallet transaction analysis
partitioned daily balance snapshots
chain event aggregations
ad hoc analyst queries
ML-style feature exploration
\`\`\`

A simple BigQuery layout:

\`\`\`text
raw_crypto
  coingecko_prices
  exchange_balances
  ethereum_logs

staging_crypto
  stg_coingecko_prices
  stg_exchange_balances
  stg_ethereum_transfers

mart_crypto
  daily_asset_prices
  wallet_activity
  portfolio_exposure
\`\`\`

Optimization usually starts with partitioning:

\`\`\`sql
create table mart_crypto.daily_asset_prices (
  report_date date,
  canonical_asset_id string,
  price_usd numeric,
  provider string,
  run_id string
)
partition by report_date
cluster by canonical_asset_id, provider;
\`\`\`

That layout helps a query like:

\`\`\`sql
select canonical_asset_id, price_usd
from mart_crypto.daily_asset_prices
where report_date = date '2026-07-28'
  and canonical_asset_id in ('btc', 'eth', 'sol');
\`\`\`

BigQuery can prune date partitions and use clustering to reduce the scanned blocks.

The main BigQuery discipline is cost-aware modeling:

\`\`\`text
require partition filters on large fact tables
cluster on common filter and join keys
avoid select * on wide raw tables
materialize repeated expensive aggregations
separate raw exploration from report-grade marts
use reservations when workload predictability matters
\`\`\`

BigQuery is easy to start with because there is little infrastructure to manage. The trap is invisible waste: scans that look simple but read far more data than needed.

## ClickHouse: fast analytical serving and lakehouse acceleration

ClickHouse is a columnar analytical database built for high-speed aggregation and filtering. It is often used when dashboards, observability, event analytics, or user-facing analytics need low latency.

The main building blocks:

\`\`\`text
MergeTree tables         primary storage engine family
ORDER BY                 physical sort key
PARTITION BY             coarse data management boundary
primary index            sparse index based on sort order
materialized views       ingest-time derived tables
projections              alternate physical layouts for query patterns
skip indexes             secondary pruning tools for specific cases
distributed tables       multi-node querying
S3 and lake integrations query external object storage and open formats
\`\`\`

For crypto, ClickHouse fits:

\`\`\`text
real-time price dashboards
exchange order book snapshots
on-chain event analytics
wallet activity timelines
high-cardinality API metrics
agent query logs
fast operational drilldowns
\`\`\`

A ClickHouse table for price ticks might look like:

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

That \`ORDER BY\` is the real design decision. If most queries ask for one asset over time, put asset and time near the front. If most queries ask for one provider over a recent window, choose accordingly.

For blockchain logs:

\`\`\`sql
create table ethereum_logs
(
    block_date Date,
    block_number UInt64,
    transaction_hash String,
    log_index UInt32,
    contract_address String,
    topic0 String,
    decoded_event String,
    amount Decimal(38, 18)
)
engine = MergeTree
partition by toYYYYMM(block_date)
order by (contract_address, topic0, block_number, log_index);
\`\`\`

ClickHouse rewards knowing the query pattern. It is less forgiving when tables are dumped in with no thought about sort keys.

The trap is treating ClickHouse as the only system of record. For financial reporting, I would usually keep immutable raw evidence and report snapshots in the lakehouse or warehouse, then use ClickHouse for hot analytical serving.

## A side-by-side view

\`\`\`text
Snowflake
Best for: governed warehouse marts, finance reporting, SQL teams, controlled access.
Use lakehouse mode when: open Iceberg storage must remain the source of truth.
Optimize with: right-sized warehouses, clustering on large hot tables, clones, Time Travel.
Watch out for: idle compute and too many oversized warehouses.

BigQuery
Best for: serverless analytics, large scans, Google Cloud data, low ops overhead.
Use lakehouse mode when: BigLake or external tables need governed access to files.
Optimize with: partitions, clustering, materialized views, slot/reservation planning.
Watch out for: careless scans and missing partition filters.

ClickHouse
Best for: low-latency analytics, high-cardinality events, dashboards, operational drilldowns.
Use lakehouse mode when: open lake data needs fast query acceleration or hot/cold serving.
Optimize with: MergeTree ORDER BY, partitioning, materialized views, projections.
Watch out for: poor sort keys and using it as an audit store without a retention design.
\`\`\`

## Hot, warm, and cold crypto data

A useful architecture is to divide data by temperature.

Hot data:

\`\`\`text
latest prices
order book snapshots
recent wallet activity
pipeline health metrics
\`\`\`

This belongs in ClickHouse if users need fast interactive queries.

Warm data:

\`\`\`text
daily asset prices
portfolio exposure
account balances
report-ready marts
\`\`\`

This belongs in Snowflake or BigQuery.

Cold data:

\`\`\`text
raw provider payload history
old chain logs
replay files
published report evidence
large backfill outputs
\`\`\`

This belongs in object storage with a lakehouse table format.

The same dataset can move through all three:

\`\`\`text
raw CoinGecko payloads in object storage
daily price mart in BigQuery or Snowflake
latest price dashboard in ClickHouse
report snapshot archived back to object storage
\`\`\`

That is not duplication for its own sake. It is serving the same fact at different speeds and governance levels.

## Designing for dbt

dbt works well with Snowflake and BigQuery as primary transformation warehouses. It can also work with ClickHouse through adapters, but the modeling style should respect ClickHouse's storage model.

For Snowflake and BigQuery:

\`\`\`text
use dbt sources for raw tables
use staging models for type cleanup
use marts for business entities
put tests near report-critical models
document canonical IDs and freshness rules
\`\`\`

For ClickHouse:

\`\`\`text
materialize serving tables intentionally
choose ORDER BY based on query patterns
avoid making every dbt model a physical table
keep raw audit history somewhere durable
use ClickHouse marts for speed-sensitive access
\`\`\`

The warehouse should not be a random pile of transformed tables. The model graph should explain how raw data becomes a report.

## Design rules for crypto pipelines

Start with these rules:

\`\`\`text
1. Keep raw provider truth immutable.
2. Use canonical asset IDs in marts.
3. Use temporal mappings for provider IDs, chains, platforms, and contracts.
4. Partition large fact tables by report date, observed date, block date, or ingest date.
5. Cluster or sort by the keys users actually filter on.
6. Keep report versions and run IDs tied to every published output.
7. Put low-latency serving data in ClickHouse only when latency needs justify it.
8. Keep long-term replay data in open storage.
\`\`\`

These rules matter more than the vendor choice.

A bad Snowflake design is still bad. A bad BigQuery design is still expensive. A bad ClickHouse sort key is still slow.

## When I would choose each one

I would choose Snowflake when the project is finance-heavy and needs governed marts, role separation, cloning, recovery windows, and clean SQL operations.

I would choose BigQuery when the project already lives on Google Cloud, wants serverless operations, and handles large analytical scans where partition and clustering discipline can control cost.

I would choose ClickHouse when the project needs fast event analytics: chain logs, order books, price ticks, API telemetry, or user-facing dashboards.

For a serious crypto reporting platform, I would not be surprised to see all three patterns:

\`\`\`text
lakehouse storage for raw and historical evidence
Snowflake or BigQuery for governed transformation and reporting
ClickHouse for real-time serving and operational analytics
\`\`\`

The architecture is good when each layer has a job.

## The rule

Do not pick a warehouse because it is popular.

Pick the architecture based on failure, cost, and query shape:

\`\`\`text
Need governed reporting?     Snowflake or BigQuery.
Need serverless scale?       BigQuery.
Need fast dashboards?        ClickHouse.
Need open historical truth?  Lakehouse storage.
\`\`\`

For crypto data, the best architecture keeps raw evidence cheap, marts governed, reports reproducible, and hot queries fast.

Everything else is vendor preference.

## References

- [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)
- [Snowflake databases, tables, and views overview](https://docs.snowflake.com/en/en/guides-overview-db)
- [BigQuery overview](https://docs.cloud.google.com/bigquery/docs/introduction)
- [BigQuery partitioned tables](https://docs.cloud.google.com/bigquery/docs/partitioned-tables)
- [BigQuery clustered tables](https://docs.cloud.google.com/bigquery/docs/clustered-tables)
- [BigQuery materialized views](https://docs.cloud.google.com/bigquery/docs/materialized-views-intro)
- [ClickHouse: What is a data lakehouse?](https://clickhouse.com/resources/engineering/data-lakehouse)
- [ClickHouse is data lake ready](https://clickhouse.com/blog/clickhouse-is-data-lake-ready)
- [ClickHouse query optimization guide](https://clickhouse.com/resources/engineering/clickhouse-query-optimisation-definitive-guide)
- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [Point-in-Time Correctness in Crypto Analytics](/posts/2026-07-24-point-in-time-correctness-crypto-analytics)
- [Immutable Raw Tables for Financial Pipelines](/posts/2026-07-25-immutable-raw-tables-financial-pipelines)
`;export{e as default};