---
title: "What Is a Data Lake, and Why Financial Pipelines Need One"
date: 2026-07-26
tags: [data-lake, financial-data, crypto, data-engineering, pipelines, compliance]
series: data-engineering
summary: "A data lake is a durable raw storage layer for files, payloads, snapshots, and replicated operational data. For financial and crypto pipelines, it preserves evidence, supports replay, and keeps analytics workloads away from production databases."
---

# What Is a Data Lake, and Why Financial Pipelines Need One

A data lake is where you store source data before you decide exactly how it should be modeled.

That definition is plain, but it matters.

In a financial pipeline, the first job is not to make the data pretty. The first job is to preserve evidence. Prices, balances, trades, exchange exports, wallet snapshots, token metadata, provider payloads, operational database snapshots, and report inputs all need somewhere durable to land.

That place is the data lake.

A warehouse or mart answers consumer questions:

```text
What is current BTC exposure?
What was NAV yesterday?
Which assets are stale?
Which report line changed?
```

A lake answers a different question:

```text
What did we receive, and can we replay from it?
```

For financial data, that second question is not optional.

## The data lake is the evidence layer

Think of a data lake as raw storage with history.

It can hold:

```text
API responses
CSV exports
JSON payloads
Parquet files
database snapshots
change data capture files
pipeline run outputs
quarantine samples
report input snapshots
```

For a crypto project, that might look like:

```text
lake/
  raw/
    coingecko/
      coins_markets/2026/07/26/run_0200/*.json
      asset_platforms/2026/07/26/run_0300/*.json
    exchanges/
      coinbase/balances/2026/07/26/*.csv
      binance/trades/2026/07/26/*.json
    onchain/
      ethereum/wallet_balances/block_25000000/*.json
  replicated/
    prod_postgres/
      public_accounts/2026/07/26/*.parquet
      transactions/2026/07/26/*.parquet
  curated/
    staging/
    marts/
```

The exact file format matters less than the principle: keep the original source shape and enough metadata to prove where it came from.

That means run IDs, source timestamps, ingestion timestamps, payload hashes, provider names, request parameters, and snapshot dates.

## Why not load everything straight into the warehouse?

You can load raw data straight into Postgres, BigQuery, Snowflake, DuckDB, or another warehouse. For small systems, that can work.

The problem is that warehouses tend to encourage interpretation.

Columns get renamed. Types get cleaned. Rows get deduplicated. Provider fields get mapped to canonical IDs. Someone drops a field because no mart uses it. A retry overwrites a row because it has the same key.

That may produce a nicer table.

It may also destroy evidence.

A data lake gives you a storage layer before interpretation. You can still load warehouse raw tables from the lake. You can still build staging models and marts. The difference is that the original input survives outside the modeled database.

That is useful when:

```text
a parser bug needs replay
a provider revises a payload
a token mapping changes
a report must be reconstructed
a regulator asks what data was available at filing time
a warehouse migration goes wrong
```

The lake is not a replacement for a warehouse. It is the input evidence the warehouse can rebuild from.

## A concrete crypto example

Say a daily crypto NAV report uses:

```text
CoinGecko prices
exchange balances
on-chain wallet balances
asset mappings
portfolio ownership from the product database
```

Without a lake, the pipeline may only keep the latest cleaned tables:

```text
stg_prices
stg_balances
mart_portfolio_nav
```

That works until a report changes.

With a lake, each input has a durable landing area:

```text
raw CoinGecko response for each run
raw exchange CSV file
raw on-chain balance response by block
replicated product database snapshot
asset mapping version table
report snapshot and line items
```

Now the team can answer:

```text
Did CoinGecko send the old price, or did our parser change it?
Did the exchange export include the duplicate balance?
Did the product database show the account as active at report time?
Which raw files fed the filed report?
Can we replay the report with the corrected mapping?
```

That is the difference between a lake and a pile of current tables.

## Why ingest from a replicated production database?

Some data comes from external providers. Some data comes from your own product database.

For example:

```text
accounts
portfolios
wallet ownership
exchange connection metadata
customer risk settings
transaction labels
manual classifications
```

A tempting design is to let the analytics pipeline query the production database directly.

That is usually a bad default.

Instead, many systems replicate production data into a read replica, CDC stream, or analytical copy, then ingest from that replica into the data lake or warehouse.

The flow looks like this:

```text
production database
  -> read replica or CDC stream
  -> data lake raw snapshots
  -> staging
  -> marts
  -> reports and agents
```

The replica acts as a buffer between production workloads and analytical workloads.

## What issues does replication solve?

First, it protects production performance.

Analytics queries are often large. They scan many rows, join wide tables, and run on schedules. A reporting job should not compete with checkout, trading, wallet sync, user login, or API traffic.

If the pipeline reads from a replica, a bad analytics query can hurt the replica without taking down the product.

Second, it reduces operational risk.

Production databases have sensitive permissions. The analytics pipeline does not need write access to production. It should not hold credentials that can mutate operational tables. A read replica gives the pipeline a narrower surface.

Third, it gives a more stable extraction point.

Production schemas change. Long-running reads can conflict with operational needs. Backfills may need to scan historical records. A replica or CDC export gives analytics a place to read without disturbing production.

Fourth, it improves auditability.

If the replica snapshots are landed into the lake with run IDs and timestamps, the pipeline can say:

```text
This report used the product database snapshot from 2026-07-26T00:00:00Z.
The source replication lag was 12 seconds.
The lake file hash was ...
The report was generated from that snapshot.
```

That is stronger than "we queried prod around midnight."

## Replica lag must be visible

Replicas are safer, but they introduce one important problem: lag.

The replica may be seconds or minutes behind production. For some workflows, that is fine. For others, it is not.

The lake ingestion should record replication metadata:

```text
replica_source
snapshot_at
replication_lag_seconds
source_database_lsn
extracted_at
source_run_id
```

Then downstream marts can expose freshness:

```text
latest_product_snapshot_at
replication_lag_seconds
freshness_status
```

If an agent answers a current financial question, it should know whether the product database input was fresh enough.

For a monthly regulatory report, a 30-second replica lag at midnight may be acceptable if the snapshot boundary is documented. For real-time risk, it may not be.

The pipeline should not hide that distinction.

## Data lake, raw tables, and marts

A useful financial pipeline usually has all three:

```text
data lake      durable raw files and snapshots
raw tables     queryable raw records loaded from the lake
staging        typed and interpreted source records
marts          consumer-ready datasets
```

The lake is cheap durable storage. Raw tables make the lake queryable. Staging applies parsing and contracts. Marts serve reports, dashboards, and agents.

For example:

```text
lake raw file:
  coingecko/coins_markets/2026/07/26/run_0200/page_001.json

raw table:
  raw_coingecko__coins_markets

staging model:
  stg_coingecko__coins_markets

mart:
  mart__asset_prices

agent-safe mart:
  agent__asset_prices
```

Each layer has a job. Do not ask the lake to be a mart. Do not ask the mart to preserve source evidence.

## What agents should use

Agents should not browse the whole lake by default.

The lake can contain sensitive operational snapshots, raw provider quirks, private account metadata, and large payloads. It is evidence, not a chat interface.

Agents should usually use:

```text
catalog metadata
run logs
freshness marts
lineage tables
agent-safe marts
specific evidence lookup tools
```

When an investigation needs raw evidence, expose a narrow tool:

```text
get_lake_object_metadata(object_id)
verify_lake_payload_hash(object_id)
get_raw_record_sample(source_run_id, limit)
trace_report_input_to_lake_file(report_run_id, line_number)
```

That lets the agent trace evidence without turning the lake into an unbounded file browser.

## The practical rule

Use a data lake when the input data is worth preserving beyond today's model.

For financial and crypto pipelines, that is almost always true.

Store:

```text
external provider payloads
exchange files
on-chain snapshots
replicated production database snapshots
CDC exports
payload hashes
run IDs
snapshot timestamps
replication lag metadata
report input evidence
```

Then build raw tables, staging models, marts, and agent-safe views from that evidence.

Production databases run the product.

Data lakes preserve the evidence.

Reports should depend on the second without endangering the first.

## References

- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [Immutable Raw Tables for Financial Pipelines](/posts/2026-07-25-immutable-raw-tables-financial-pipelines)
- [Auditable Database Design for Financial Data](/posts/2026-07-25-auditable-database-design-financial-data)
- [Data Lineage for Small Crypto Pipelines](/posts/2026-07-24-data-lineage-small-crypto-pipelines)
- [AI Agents Are Only as Good as Their Data Marts](/posts/2026-07-24-ai-agents-only-as-good-as-data-marts)
- [Why Agents Should Propose Changes, Not Apply Them](/posts/2026-07-26-why-agents-should-propose-changes-not-apply-them)
