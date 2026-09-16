---
title: "dbt vs Lakeflow Declarative Pipelines for a Databricks Warehouse"
date: 2026-09-16
tags: [data-engineering, databricks, dbt, lakeflow, data-modeling, analytics-engineering]
series: data-engineering
summary: "Choosing dbt, Lakeflow Declarative Pipelines, or both for Databricks transformations depends on whether the hard problem is incremental data movement or analytics-model governance. This compares the trade-offs and shows a practical hybrid boundary with LDP Python, LDP SQL, and dbt examples."
---

When a team builds a Databricks warehouse, the first decision is usually storage and ingestion: S3, Delta tables, Unity Catalog, and a way to get source data into Bronze. The next decision is harder because both options look reasonable: should the transformation layer use dbt, Lakeflow Declarative Pipelines (LDP), or both?

There is no winner in the abstract. LDP is close to the Spark and Databricks execution model. It manages dependency graphs, streaming state, retries, checkpoints, expectations, and incremental processing for a pipeline. dbt is close to analytics engineering. It turns SQL models, tests, documentation, and lineage into a reviewable warehouse-development workflow.

For a small, mostly batch warehouse, dbt may be enough. For a streaming or CDC-heavy platform, LDP often removes a large amount of custom operational code. For many Databricks teams, the stable answer is hybrid: LDP owns the path from raw data through clean conformed tables; dbt owns the business-facing marts built on top of those stable tables.

The boundary matters more than the brand name.

## The decision point in a Databricks warehouse

Imagine an operational system exporting order updates, customer changes, and payments into S3. The warehouse needs a reliable daily revenue model, but updates can arrive late and customers can change attributes after an order has landed.

The flow might look like this:

```text
S3 files / CDC events
  -> Bronze: raw, replayable evidence
  -> Silver: typed, deduplicated, CDC-aware orders and customers
  -> Gold: daily revenue, customer metrics, finance reporting
  -> dashboards, agents, and downstream applications
```

LDP is strongest where the input is changing incrementally. It has native streaming tables, materialized views, expectations, event logs, and AUTO CDC support. dbt is strongest where the team is defining trusted business models: staging conventions, joins, aggregates, tests, documentation, exposures, and a reviewed SQL graph.

Trying to make either tool cover every part of this flow usually creates friction.

## LDP: where it fits

Lakeflow Declarative Pipelines are Databricks-managed declarative pipelines authored in SQL or Python. You define the tables and views you want; the platform infers dependencies and manages the execution graph. LDP adds production features around Spark Declarative Pipelines, including expectations, a queryable event log, continuous mode, and AUTO CDC.

It is a strong choice when the transformation has state.

| LDP is a good fit when | Why |
| --- | --- |
| Files or events arrive continuously | Streaming tables maintain checkpoints and incremental progress |
| Source records change or arrive out of order | AUTO CDC and streaming semantics handle change processing explicitly |
| A Bronze-to-Silver quality gate is required | Expectations can warn, drop invalid rows, or fail an update |
| Spark Python is needed | Python is available beside SQL for custom parsing and libraries |
| The team wants pipeline run observability | The pipeline event log captures progress, quality metrics, and lineage |

LDP also works for batch transformations. A materialized view can join and aggregate upstream tables, refreshing incrementally when the query and sources allow it and recomputing when correctness requires a full refresh. That is useful, but it does not automatically make LDP the best home for every Gold model.

The trade-off is platform specificity. LDP code is closely tied to Databricks pipeline semantics and deployment. That may be exactly what an AWS Databricks platform needs. It is still a decision to take deliberately, especially if analysts already have mature dbt conventions and packages.

## dbt: where it fits

dbt turns a set of SQL `SELECT` statements into a dependency graph of warehouse models. Its core strengths are development ergonomics and shared analytics context: `ref()` relationships, model selection, generic tests, macros, documentation, source definitions, and a familiar pull-request workflow.

For Databricks, the dbt adapter can build Delta-backed incremental models using an atomic `MERGE` strategy with a `unique_key`. dbt models can also use Databricks-specific configurations such as file format and incremental strategy.

| dbt is a good fit when | Why |
| --- | --- |
| Transformations are mostly SQL joins and aggregates | The model stays compact and readable in a pull request |
| Analysts and analytics engineers own the metric definition | dbt's project structure, tests, and docs fit their workflow |
| A model graph must be reviewed independently of streaming runtime concerns | `ref()`, selectors, CI, and generated docs make dependencies explicit |
| The same modelling style runs across more than one warehouse | dbt keeps the modelling interface relatively portable |
| A semantic layer or metric contract already lives in dbt | Moving it only to reproduce it in LDP rarely pays off |

dbt is not a streaming runtime. It can build incremental models, but it does not replace a managed streaming checkpoint, an event-time watermark, or a CDC state machine. Teams can build those pieces around dbt, but that is often the moment when LDP becomes simpler.

## A direct comparison

| Concern | LDP | dbt | Hybrid recommendation |
| --- | --- | --- | --- |
| S3 file ingestion and streaming | Native pipeline pattern | Requires an external ingest path | LDP owns it |
| CDC and SCD processing | AUTO CDC and streaming state | Incremental SQL can merge, but change handling is yours | LDP owns it |
| Bronze/Silver quality gates | Expectations and event-log metrics | Tests usually run after a model builds | LDP gates incoming data; dbt tests business contracts |
| Gold marts and business metrics | Materialized views work well | SQL models, docs, tests, macros, and semantic tooling are mature | Usually dbt owns them |
| Python transformations | First-class Spark Python | Python models exist but are not its primary analytics workflow | LDP for Spark-heavy logic |
| Documentation and analyst collaboration | Unity Catalog lineage and comments | dbt docs, source definitions, tests, exposures, and model graph | Keep business definitions in dbt if that is where users work |
| Operational observability | Managed pipeline event log and update lifecycle | Run artifacts and test results | Monitor both, with one ownership boundary |

The important row is Gold marts. LDP materialized views are technically capable of maintaining an aggregate. dbt can also create an incremental Delta table. Pick one owner for a dataset. Two tools writing the same target table is not hybrid; it is a race condition with competing lineage.

## LDP model example in Python

This Python pipeline takes a Bronze orders stream, removes invalid records at the Silver boundary, then maintains a Gold daily-revenue materialized view. The names are fully qualified so the target catalog is explicit.

```python
from pyspark import pipelines as dp
from pyspark.sql import functions as F


@dp.table(name="main.commerce.silver_orders")
@dp.expect_or_drop(
    "valid_order",
    "order_id IS NOT NULL AND net_amount >= 0 AND order_ts IS NOT NULL",
)
def silver_orders():
    return (
        spark.readStream.table("main.bronze.orders")
        .select(
            "order_id",
            "customer_id",
            "order_ts",
            F.col("amount").cast("decimal(18,2)").alias("net_amount"),
            "source_updated_at",
        )
        .withColumn("order_date", F.to_date("order_ts"))
    )


@dp.materialized_view(name="main.commerce.gold_daily_revenue")
def gold_daily_revenue():
    return (
        spark.read.table("main.commerce.silver_orders")
        .groupBy("order_date")
        .agg(
            F.sum("net_amount").alias("daily_net_revenue"),
            F.countDistinct("order_id").alias("order_count"),
        )
    )
```

`expect_or_drop` is intentionally a strong action. It is suitable only when an invalid row should not reach Silver. If the business needs to investigate every bad order, use an expectation that records metrics while keeping the row, or write rejected records to a separate quarantine dataset.

The materialized view is declarative. The pipeline can use an incremental refresh strategy when it is valid, then fall back to a full recomputation when source changes require it. That is an operational advantage for this kind of model, but it means the team must watch refresh duration and cost rather than assuming every update is incremental.

## The same LDP model in SQL

The SQL version expresses the same boundary. SQL is often the better LDP authoring choice when the transformation is filters, projections, joins, and aggregates.

```sql
CREATE OR REFRESH STREAMING TABLE main.commerce.silver_orders
(
  CONSTRAINT valid_order EXPECT (
    order_id IS NOT NULL
    AND CAST(amount AS DECIMAL(18,2)) >= 0
    AND order_ts IS NOT NULL
  ) ON VIOLATION DROP ROW
)
AS
SELECT
  order_id,
  customer_id,
  order_ts,
  CAST(amount AS DECIMAL(18,2)) AS net_amount,
  TO_DATE(order_ts) AS order_date,
  source_updated_at
FROM STREAM(main.bronze.orders);

CREATE OR REFRESH MATERIALIZED VIEW main.commerce.gold_daily_revenue
AS
SELECT
  order_date,
  SUM(net_amount) AS daily_net_revenue,
  COUNT(DISTINCT order_id) AS order_count
FROM main.commerce.silver_orders
GROUP BY order_date;
```

The Python and SQL versions should not coexist in the same pipeline. They are alternative implementations. Keeping both in a tutorial is useful; keeping both in production creates duplicate datasets and confusing ownership.

## The dbt version of the Gold model

In a hybrid setup, LDP would own `main.commerce.silver_orders`. dbt then owns the Gold model and declares that Silver table as a source. This is a healthy boundary: dbt is not asked to maintain streaming state, and LDP is not asked to become the team's only analytics-development interface.

```sql
-- models/commerce/fct_daily_revenue.sql
{{
  config(
    materialized='incremental',
    file_format='delta',
    unique_key='daily_revenue_key',
    incremental_strategy='merge'
  )
}}

with orders as (
  select
    order_date,
    order_id,
    net_amount
  from {{ source('commerce', 'silver_orders') }}
  {% if is_incremental() %}
    -- Rebuild a small late-arrival window. Set this from observed source behaviour.
    where order_date >= date_sub(current_date(), 3)
  {% endif %}
)

select
  concat(cast(order_date as string), '|daily_revenue') as daily_revenue_key,
  order_date,
  sum(net_amount) as daily_net_revenue,
  count(distinct order_id) as order_count,
  max(current_timestamp()) as modeled_at
from orders
group by 1, 2
```

The corresponding dbt properties file can make the contract visible in CI:

```yaml
version: 2

models:
  - name: fct_daily_revenue
    columns:
      - name: daily_revenue_key
        data_tests: [unique, not_null]
      - name: order_date
        data_tests: [not_null]
      - name: daily_net_revenue
        data_tests: [not_null]
```

The three-day lookback is an example, not a universal setting. If source updates arrive thirty days late, it is wrong. If the source is immutable after one day, it wastes compute. The correct window comes from observed lateness and a reconciliation process, not a template copied from another warehouse.

## Why many teams choose hybrid

Hybrid is attractive because it lets each layer use the abstraction that matches its problem.

LDP handles the operational path where data is arriving, changing, retrying, and being validated. It can write a clean, governed Silver contract from streaming files, API data, Kafka events, or CDC feeds. Its event log helps an on-call engineer answer whether a run processed data and whether quality expectations passed.

dbt handles the semantic path where business questions are debated. An analytics engineer can change how revenue is recognised, add a source freshness test, document a metric, run the affected model selection in CI, and ask a finance reviewer to approve the pull request. This work is usually batch-oriented and benefits from dbt's conventions.

The hybrid structure can be as small as this:

```text
LDP pipeline: raw files -> bronze_orders -> silver_orders
dbt project:  silver_orders -> fct_daily_revenue -> finance dashboard
```

The two systems need an explicit handoff contract. Define the Silver table's owner, primary key, update semantics, timezone, late-arrival policy, schema-change policy, and freshness expectation. Without that, the dbt model will quietly inherit unknown streaming behaviour.

## The costs of hybrid

Hybrid is not free. It creates two deployment mechanisms, two sets of run metadata, and two places where a failure can happen. The team must decide how a dbt run waits for the LDP pipeline, how it detects a stale Silver source, and where the combined alert appears.

Avoid hybrid when the workflow does not need it. A small batch-only warehouse with a few transformations can use dbt plus Databricks Jobs. A streaming platform whose Gold tables are operational projections rather than analyst-owned marts can stay inside LDP. Splitting responsibility before a real difference in workflow exists only increases coordination.

For a 10 TB Databricks lakehouse with file-based CDC, a sensible first version is LDP for Bronze and Silver, then dbt for stable Gold marts. Keep the code in the `lakehouse-data-products` repository, deploy each tool through its own reviewed CI job, and make the table boundary visible in Unity Catalog and dbt documentation.

## The rule that prevents most trouble

One dataset has one owner. LDP or dbt may read another team's table, but only one transformation system should create and refresh a given target. Put that rule in code review and in the repository structure.

That rule gives a team the practical benefits of a hybrid setup without turning the warehouse into two competing DAGs.

## References

- [Lakeflow pipelines: how to use pipelines](https://docs.databricks.com/aws/en/ldp/concepts/how-to-use-pipelines)
- [Lakeflow pipeline developer reference](https://docs.databricks.com/aws/en/ldp/developer)
- [Lakeflow pipeline expectations](https://docs.databricks.com/aws/en/ldp/expectation-patterns)
- [Lakeflow materialized views](https://docs.databricks.com/aws/en/ldp/materialized-views)
- [dbt incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [dbt Databricks configurations](https://docs.getdbt.com/reference/resource-configs/databricks-configs)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
