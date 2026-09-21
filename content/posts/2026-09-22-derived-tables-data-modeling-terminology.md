---
title: "Views, materialized views, dynamic tables, and incremental models: a data modeling field guide"
date: 2026-09-22
tags: [data-engineering, data-modeling, materialized-views, dbt, data-warehousing]
series: data-engineering
summary: "A practical guide to the overloaded table terminology that appears in modern data modeling: logical views, materialized and refreshable views, dynamic tables, streaming tables, incremental models, and persisted transformation tables."
---

Data modeling vocabulary has become slippery. Two engineers can say “incremental table” and mean entirely different things: a dbt table built with a `MERGE`, a Snowflake dynamic table with a target lag, a Databricks streaming table with a checkpoint, or a Materialize view that continuously maintains state.

The names are not the design. The maintenance contract is.

Before choosing a vendor feature, answer four questions:

1. Is the result stored, or calculated when someone reads it?
2. Who keeps it current: a human, a scheduler, the database engine, or a streaming runtime?
3. Does an update process all history, or only data that changed?
4. If the source changes an old row, does the result stay correct, and at what cost?

Once those answers are clear, most of the terminology stops being mysterious.

## The four maintenance contracts

![Four ways a derived dataset stays fresh: a logical view, a full-refresh materialized view, an incrementally refreshed materialized view, and a streaming table](/assets/images/data-modeling-derived-table-maintenance.png)

The SQL may look similar. A stored result is still often defined with `SELECT ... FROM ...`. What changes is where the work happens and how the system remembers what it has already processed.

| Term | Is the result stored? | Who maintains it? | Typical refresh behavior | Common platforms |
| --- | --- | --- | --- | --- |
| Logical view | No | The query engine at read time | Re-runs the query for each read | PostgreSQL, Snowflake, BigQuery, Databricks |
| Materialized view | Yes | A user, scheduler, or database engine | Full or incremental, depending on product and query | PostgreSQL, BigQuery, Redshift, Databricks, Materialize |
| Refreshable materialized view | Yes | The database scheduler | Periodic full recomputation is the usual model | ClickHouse |
| Dynamic table | Yes | The warehouse scheduler | Freshness-driven incremental or full refresh | Snowflake |
| Streaming table | Yes, plus streaming state | A streaming runtime | Processes arriving records with checkpoints | Databricks Lakeflow |
| Incremental model | Yes, normally as a table | The transformation tool and its schedule | Developer-controlled append, merge, overwrite, or microbatch | dbt on many warehouses |
| Persisted transformation table | Yes | A job or orchestrator | Usually full rebuild, unless the job implements deltas | Any SQL warehouse or lakehouse |

## A logical view: save the query, not its output

A logical view is a named query. It is useful for an access-controlled projection, a stable interface over a changing physical table, or a small reusable transformation. It does not save the query result by default.

```sql
CREATE VIEW analytics.current_orders AS
SELECT order_id, customer_id, order_total, created_at
FROM raw.orders
WHERE status = 'completed';
```

Every query of `analytics.current_orders` still needs to read and execute the underlying definition. That can be exactly right when the result is small or rarely queried. It is the wrong primitive for a dashboard that runs the same expensive daily aggregation several hundred times each morning.

## Materialized view: store the result, then decide how freshness works

A materialized view persists the output of a query. That gives reads a cheaper path, but it creates a new operational question: when and how is that stored result refreshed?

PostgreSQL exposes the most direct version of the contract. `REFRESH MATERIALIZED VIEW` replaces its contents. `CONCURRENTLY` avoids blocking readers, but requires a suitable unique index and still allows only one refresh at a time.

```sql
CREATE MATERIALIZED VIEW analytics.daily_revenue AS
SELECT
  date_trunc('day', paid_at) AS order_day,
  currency_code,
  sum(amount) AS revenue
FROM payments
WHERE payment_status = 'captured'
GROUP BY 1, 2;

REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.daily_revenue;
```

This is a good fit for a finance report that can be 30 minutes old and whose underlying query is costly. It is not automatically an incremental system. On PostgreSQL, refresh means replacing the stored result from the defining query.

The phrase “materialized table” is often used loosely for this kind of output. Treat it as a description, not a portable SQL type. It might mean a materialized view, a dbt `table` model, or a normal table built with `CREATE TABLE AS SELECT`. Ask what owns refresh and whether the table is safe to write to directly.

## Incrementally maintained materialized views: the engine owns delta logic

Some platforms turn a materialized view into more than a scheduled snapshot. They examine source changes and try to update only the affected output. The important word is *try*. Eligibility depends on query shape, source behavior, and platform rules.

Databricks materialized views in Lakeflow use batch-equivalent semantics: the result must be the same as rerunning the full query. On serverless pipelines, the platform can select an incremental refresh when it is supported and cheaper, or fall back to a full recomputation. The model author declares the result, not the merge procedure.

```sql
CREATE OR REFRESH MATERIALIZED VIEW commerce.customer_lifetime_value
AS
SELECT
  customer_id,
  count(*) AS order_count,
  sum(order_total) AS lifetime_value
FROM commerce.orders_silver
GROUP BY customer_id;
```

BigQuery materialized views also maintain precomputed results in the background. Incremental definitions support a restricted SQL subset. If a source update or deletion invalidates the required cached state, BigQuery may read the base table or refresh rather than applying a simple delta. That is why a materialized view is not a license to stop monitoring bytes scanned and refresh behavior.

Materialize goes further for changing sources: its materialized views persist results and update them incrementally as data arrives. That is a continuously maintained result, not a periodic batch refresh.

```sql
CREATE MATERIALIZED VIEW realtime.orders_by_country AS
SELECT country_code, count(*) AS order_count, sum(order_total) AS revenue
FROM orders
GROUP BY country_code;
```

The trade-off shifts work toward writes and maintained state. It is excellent when fresh joins and aggregates are a product requirement. It is not free compute.

## Refreshable materialized views: scheduled recomputation with a name that sounds more magical than it is

ClickHouse makes this distinction unusually explicit. Its refreshable materialized views rerun a query on an interval and write the result to a target table. They are useful for periodic denormalisation or a complex join that does not fit an insert-time incremental view.

```sql
CREATE TABLE analytics.customer_snapshot
(
  customer_id UInt64,
  country_code LowCardinality(String),
  lifetime_value Decimal(18, 2)
)
ENGINE = MergeTree
ORDER BY customer_id;

CREATE MATERIALIZED VIEW analytics.customer_snapshot_mv
REFRESH EVERY 1 HOUR
TO analytics.customer_snapshot AS
SELECT
  c.customer_id,
  c.country_code,
  sum(o.order_total) AS lifetime_value
FROM raw.customers AS c
LEFT JOIN raw.orders AS o ON o.customer_id = c.customer_id
GROUP BY 1, 2;
```

That is a scheduled full recomputation contract. ClickHouse also has *incremental materialized views*, which react to inserted blocks and are usually better for simple append-heavy rollups. These are different features despite the nearly identical names.

Use a refreshable materialized view when the full query is affordable at the required interval and correctness depends on joins or logic that cannot safely be maintained record-by-record. Watch the refresh duration. A one-hour schedule is not meaningful if the recomputation takes 58 minutes.

## Dynamic tables: declare a freshness target, not a cron expression

Snowflake dynamic tables are stored query results managed around a target lag. The target is a freshness objective, not a promise that a refresh happens exactly every N minutes. Snowflake schedules dependency-aware refreshes and can process changes incrementally when the query supports it.

```sql
CREATE OR REPLACE DYNAMIC TABLE analytics.orders_enriched
  TARGET_LAG = '10 minutes'
  WAREHOUSE = transform_wh
  REFRESH_MODE = INCREMENTAL
AS
SELECT
  o.order_id,
  o.order_total,
  c.segment
FROM raw.orders AS o
JOIN core.customers AS c ON c.customer_id = o.customer_id;
```

This is useful when a team wants to describe the desired state of a transformation graph, rather than operate each refresh itself. It still needs observability: actual lag can exceed the configured target when data volume, query complexity, or warehouse capacity prevents the scheduler from keeping up.

## Incremental model: the engineer owns the delta boundary

In dbt, an incremental model is normally a physical table. The first run builds the full result. Later runs execute only the filter supplied by the author, then append, merge, overwrite partitions, or microbatch according to the adapter and configuration.

```sql
{{
  config(
    materialized='incremental',
    unique_key='order_id',
    incremental_strategy='merge'
  )
}}

SELECT
  order_id,
  customer_id,
  cast(order_total AS decimal(18, 2)) AS order_total,
  updated_at
FROM {{ ref('stg_orders') }}

{% if is_incremental() %}
WHERE updated_at >= (
  SELECT coalesce(max(updated_at), '1900-01-01') FROM {{ this }}
)
{% endif %}
```

This is powerful because the model can express warehouse-specific merge behavior. It also puts correctness on the team. Choose a true grain and `unique_key`; include a lookback window for late-arriving updates; test duplicate keys; and run a full refresh when a logic change means old rows no longer match the new definition.

An incremental dbt model is not a streaming table. It has no continuous checkpoint, watermark, or event-time state machine. A scheduled five-minute dbt run may be perfectly adequate for operations reporting. It is not a replacement for stream processing when the source or latency requirement demands one.

## A decision flow that survives vendor changes

![Decision flow for choosing a logical view, full-refresh materialized view, incrementally maintained view or dynamic table, or streaming table](/assets/images/data-modeling-table-type-decision.png)

Start from the consumer rather than the product name.

- If readers need current data but the query is cheap, a logical view is often enough.
- If they need fast reads and the result can be rebuilt periodically, choose a materialized or persisted table with an explicit refresh job.
- If the dataset must remain current across source updates and the platform can maintain the query as deltas, use an engine-managed materialized view or dynamic table.
- If records arrive continuously and latency matters, choose a streaming table or continuously maintained view, then design checkpoints, ordering, late data, and recovery.

The same customer-lifetime-value data product might use any of these choices. A weekly executive report can tolerate a full refresh. A warehouse dashboard might use a dynamic table with a 10-minute target. A fraud workflow may need a continuously maintained result. The metric is the same; the maintenance contract is not.

## What to put in the data contract

Do not leave the table type as tribal knowledge. For each derived dataset, record:

| Contract field | Example |
| --- | --- |
| Grain | One row per customer and currency |
| Object type | Lakeflow materialized view |
| Freshness objective | Updated within 15 minutes after upstream completion |
| Maintenance mode | Engine-managed incremental refresh, full refresh permitted |
| Source-change assumptions | Orders can be corrected for 30 days; customer segment can change at any time |
| Recovery operation | Full refresh from `orders_silver` after a model logic change |
| Owner and consumers | Revenue analytics; finance dashboard and customer-success health score |

This turns a loose label such as “incremental table” into something an on-call engineer can operate. It also exposes the uncomfortable questions early: who pays for a full rebuild, what happens when a dimension changes, and how will the team prove the output is fresh enough?

## The practical rule

Pick the data product first. Then select the maintenance contract: compute on read, rebuild on a schedule, maintain source deltas, or process an event stream. Only after that should the team choose the platform-specific object that implements it.

## References

- [PostgreSQL: `REFRESH MATERIALIZED VIEW`](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html)
- [ClickHouse refreshable materialized views](https://clickhouse.com/docs/concepts/features/materialized-views/refreshable-materialized-view)
- [Databricks incremental refresh for materialized views](https://docs.databricks.com/gcp/en/ldp/incremental-refresh)
- [Snowflake dynamic-table target lag](https://docs.snowflake.com/en/user-guide/dynamic-tables/target-lag)
- [BigQuery materialized views](https://cloud.google.com/bigquery/docs/materialized-views-intro)
- [dbt incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [Materialize views and materialized views](https://materialize.com/docs/fundamentals/concepts/views/)
