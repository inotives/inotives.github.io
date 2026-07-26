---
title: "What Is CDC Streaming, and Why Financial Pipelines Need It"
date: 2026-07-26
tags: [cdc, streaming, financial-data, crypto, data-engineering, postgres]
series: data-engineering
summary: "Change data capture streams database changes from logs instead of polling tables. For financial and crypto systems, CDC keeps replicas, lakes, marts, and audit workflows current without overloading production databases."
---

# What Is CDC Streaming, and Why Financial Pipelines Need It

CDC means change data capture.

The simple version: CDC watches a database for inserts, updates, and deletes, then emits those changes as a stream of events.

Instead of asking every minute:

```sql
select *
from transactions
where updated_at > last_seen_at;
```

CDC reads the database's change log and says:

```text
row inserted
row updated
row deleted
transaction committed
```

That difference matters.

Polling asks the table what changed. CDC watches the database record of what changed.

For financial data, that is a cleaner boundary. You get lower-latency updates, fewer expensive table scans, better ordering, and a stronger audit story.

## What CDC solves

CDC solves a few boring problems that become painful at scale.

First, it avoids heavy polling.

If a pipeline keeps scanning a production `transactions` table looking for new rows, the analytics workload competes with the product. That is the wrong tradeoff. Product databases should serve product traffic first.

Second, CDC captures updates and deletes more reliably.

Polling often depends on `updated_at`. That works until a table misses the column, a batch job forgets to update it, clocks drift, or a delete removes the row before the poller sees it.

CDC can capture row-level changes from the database log. For Postgres, this usually means logical replication. For MySQL, it often means the binlog. Tools like Debezium build on those database-native logs.

Third, CDC preserves order.

Financial systems care about ordering. A deposit, trade, transfer, correction, and reversal may all touch related rows. If the downstream pipeline sees them out of order, it can produce temporary nonsense.

CDC streams are usually consumed with offsets or log positions, so the pipeline can resume from a known place.

Fourth, CDC gives a cleaner path into replicas, lakes, and marts.

The production database emits changes. A CDC pipeline lands them somewhere safer. Analytics, reporting, and agents use the downstream copy.

## A crypto example

Imagine a crypto portfolio app with operational tables:

```text
accounts
wallets
exchange_connections
transactions
balances
asset_mappings
manual_overrides
```

The product needs these tables to serve users.

The data pipeline needs them for reporting:

```text
daily NAV
portfolio exposure
wallet reconciliation
regulatory line items
data quality review
agent-safe marts
```

Without CDC, the pipeline might run scheduled queries against production:

```text
every 5 minutes, scan transactions where updated_at changed
every 15 minutes, scan balances
every hour, scan asset mappings
nightly, dump large tables
```

That can work for a while. Then the tables grow, backfills arrive, and reporting jobs become production risk.

With CDC:

```text
production Postgres
  -> logical replication stream
  -> CDC connector
  -> event topics or files
  -> data lake raw change log
  -> staging tables
  -> marts and report snapshots
```

Now the pipeline sees changes as they happen without repeatedly scanning production.

## CDC is not the same as a data lake

CDC is a movement pattern.

A data lake is a storage layer.

They work well together:

```text
CDC stream captures database changes
data lake stores those changes durably
raw tables make them queryable
staging models interpret them
marts serve reports and agents
```

For financial data, I like landing CDC events into an append-only raw area:

```text
lake/raw_cdc/prod_postgres/transactions/2026/07/26/*.json
lake/raw_cdc/prod_postgres/asset_mappings/2026/07/26/*.json
lake/raw_cdc/prod_postgres/manual_overrides/2026/07/26/*.json
```

Each event should carry metadata:

```text
source_database
schema_name
table_name
operation
primary_key
before
after
transaction_id
commit_timestamp
log_position
captured_at
connector_name
```

That metadata is what makes replay possible.

## Common CDC event shape

A CDC event usually needs old state, new state, and source metadata.

Example balance update:

```json
{
  "source": {
    "database": "prod",
    "schema": "public",
    "table": "balances",
    "lsn": "0/16B6C50",
    "transaction_id": "812391",
    "commit_timestamp": "2026-07-26T02:15:03Z"
  },
  "operation": "update",
  "primary_key": {
    "balance_id": "bal_123"
  },
  "before": {
    "asset_id": "eth",
    "quantity": "12.0",
    "updated_at": "2026-07-26T02:10:00Z"
  },
  "after": {
    "asset_id": "eth",
    "quantity": "12.5",
    "updated_at": "2026-07-26T02:15:00Z"
  },
  "captured_at": "2026-07-26T02:15:04Z"
}
```

The downstream system can now answer:

```text
What changed?
When did production commit it?
Which row changed?
What was the previous value?
Where should the consumer resume if it crashes?
```

That is stronger than a polling job that only sees the latest row.

## Design pattern: snapshot plus stream

Most CDC pipelines start with two phases:

```text
initial snapshot
ongoing change stream
```

The snapshot copies the current state of the source tables. The stream captures changes after that point.

Example:

```text
1. Snapshot all active accounts, wallets, balances, and mappings.
2. Record the source log position.
3. Start streaming changes from that position.
4. Apply changes to the downstream replica or raw CDC tables.
```

This pattern avoids missing changes during setup.

It also gives you a recovery model. If the downstream system is rebuilt, start from a fresh snapshot plus the retained change stream.

## Design pattern: immutable CDC log

For financial data, do not treat CDC only as a way to keep a replica current.

Also keep the raw change events.

An immutable CDC log lets you replay downstream models:

```text
rebuild account state as of report time
replay mapping changes into a historical mart
compare filed report inputs to current state
investigate who changed a manual override
```

You may still maintain a current-state table:

```text
replica.accounts_current
replica.balances_current
```

But the raw CDC log is the evidence:

```text
raw_cdc.accounts_events
raw_cdc.balances_events
raw_cdc.asset_mapping_events
```

Current state is convenient. Event history is explainable.

## Design pattern: outbox for application events

CDC captures table changes. Sometimes the business event is clearer than the row change.

For that, use an outbox table.

The application writes the business event inside the same transaction as the operational update:

```sql
insert into outbox_events (
  event_id,
  event_type,
  aggregate_type,
  aggregate_id,
  payload,
  created_at
) values (
  gen_random_uuid(),
  'portfolio_balance_corrected',
  'portfolio',
  'portfolio_123',
  '{"asset_id":"eth","old_quantity":"12.0","new_quantity":"12.5"}',
  now()
);
```

CDC streams the outbox row.

This gives downstream systems a stable business event without requiring them to infer meaning from low-level table changes.

For crypto workflows, outbox events can be useful for:

```text
wallet_connected
exchange_sync_completed
balance_corrected
asset_mapping_replaced
report_filed
manual_override_approved
```

Use CDC for facts. Use outbox events when downstream consumers need business meaning.

## Tooling options

The common tools fall into a few groups.

Debezium is a widely used open-source CDC platform. It captures row-level changes from databases and commonly runs through Kafka Connect. Its connectors use database-native change logs, such as PostgreSQL logical replication or MySQL binlogs.

Kafka Connect is the connector runtime often used with Debezium. Source connectors publish changes into Kafka topics. Sink connectors move those events into storage systems, search systems, warehouses, or lakes.

Postgres logical replication is the database-native foundation for many Postgres CDC setups. It streams logical changes from the write-ahead log through replication slots and publications.

AWS DMS can run full-load and CDC migrations. It is useful when you want managed replication into AWS targets such as S3, Redshift, RDS, or other supported endpoints.

There are also managed ELT and replication vendors such as Fivetran, Airbyte, Estuary, Striim, and others. The design question is the same regardless of vendor:

```text
Can it capture inserts, updates, and deletes?
Can it preserve ordering enough for your use case?
Can it resume from a known offset?
Can it expose lag?
Can it land immutable raw events?
Can it handle schema changes safely?
Can it protect production?
```

Do not choose CDC tooling only by connector list. Choose it by failure behavior.

## What can go wrong

CDC does not remove operational work.

Watch these issues:

```text
replication lag
schema drift
large transactions
connector downtime
lost replication slots
retention limits on database logs
out-of-order downstream processing
delete handling
PII leakage into raw streams
```

For financial data, lag and delete handling are the big ones.

If a replica is behind, reports may use stale product state. If delete events are dropped or mishandled, downstream marts may keep rows that production removed.

Every CDC pipeline should expose health metadata:

```text
source_lsn
last_committed_at
last_captured_at
replication_lag_seconds
events_processed
events_failed
connector_status
```

Agents and dashboards should read that before trusting downstream data.

## Agent-safe CDC workflows

Agents should not consume raw CDC streams directly by default.

CDC events can contain sensitive operational fields, deleted values, internal account metadata, and noisy implementation details.

Instead, expose safe tools:

```text
get_cdc_lag(source_name)
trace_record_changes(table_name, primary_key)
list_recent_schema_changes(source_name)
explain_report_input_from_cdc(report_run_id)
open_cdc_replay_request(dataset, start_lsn, end_lsn)
```

For a crypto report investigation, an agent might ask:

```text
Why did ETH exposure change after the 02:15 run?
```

The safe workflow:

```text
1. Check mart freshness.
2. Trace the report line to portfolio balance records.
3. Query CDC metadata for those balance IDs.
4. Find the update event that changed quantity from 12.0 to 12.5.
5. Link the change to the source transaction and run ID.
6. Propose a report impact review if the report was already filed.
```

The agent explains the change. It does not mutate the source tables.

## The practical rule

Use CDC when downstream systems need reliable, ordered, low-latency copies of database changes without scanning production tables.

For crypto financial systems, CDC is useful for:

```text
replicating product database state into the lake
keeping account and portfolio dimensions current
tracking manual override changes
capturing asset mapping edits
feeding report snapshots
building audit trails
triggering review queues and backfills
```

Keep the raw CDC events. Expose lag. Handle deletes deliberately. Land sensitive streams behind proper access boundaries.

CDC is more than faster ingestion.

It is replayable change history for the financial pipeline.

## References

- [Debezium documentation](https://debezium.io/documentation/reference/3.5/index.html)
- [Debezium features](https://debezium.io/documentation/reference/features.html)
- [Debezium architecture](https://debezium.io/documentation/reference/architecture.html)
- [PostgreSQL logical replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [Apache Kafka Connect documentation](https://kafka.apache.org/documentation/#connect)
- [AWS DMS ongoing replication and CDC](https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Task.CDC.html)
- [What Is a Data Lake, and Why Financial Pipelines Need One](/posts/2026-07-26-what-is-a-data-lake-financial-data)
- [Why Agents Should Propose Changes, Not Apply Them](/posts/2026-07-26-why-agents-should-propose-changes-not-apply-them)
