---
title: "A local-first OLAP pipeline with DuckDB, dlt, dbt, Prefect, and Rill"
date: 2026-09-23
tags: [data-engineering, duckdb, local-first, dbt, orchestration]
series: data-engineering
summary: "A practical design for syncing cloud data into a local DuckDB warehouse with dlt, dbt-duckdb, Prefect, Rill, uv, and feature-based project modules."
---

Most local data stacks stop at a few exploratory SQL queries. This one should behave more like a small analytical product: pull a reproducible slice of cloud data onto a developer machine, transform it on a schedule, and publish useful marts to a local dashboard.

The starting point is familiar. [agent-pipe](https://github.com/inotives/agent-pipe) explores a local pipeline around SQLite. DuckDB changes the centre of gravity. SQLite is excellent application state; DuckDB is built for analytical scans, columnar data, and SQL over files such as Parquet. That makes it a better fit when the local machine needs to work through several months of orders, usage events, or product telemetry.

This is not an argument to put the company warehouse on every laptop. It is a way to make a bounded, rebuildable analytical environment feel like a normal software project.

## The proposed stack

- DuckDB is the local OLAP database. It holds the raw landing tables and the transformed models.
- dlt extracts from each source and loads a controlled snapshot into raw tables.
- dbt-core with dbt-duckdb turns those raw tables into staging, intermediary, and mart models.
- Prefect runs the jobs, records their state, and retries the parts that fail.
- Rill is the local BI layer. It reads published mart files into its own embedded DuckDB engine and serves dashboards.
- uv locks the Python environment so a flow behaves the same way on another developer machine or a small runner.

![Data sources flow through Prefect, dlt, DuckDB, dbt-duckdb, published Parquet marts, and Rill.](/assets/images/duckdb-local-first-olap-pipeline.png)

There are deliberately two DuckDB boundaries in this picture. The project warehouse is written by dlt and dbt. Rill has its own embedded DuckDB engine for dashboarding. Publishing mart Parquet files between them is a boring but useful contract: Rill does not need to contend with an active writer, and the dashboard has a clear data version to consume.

## What "sync to local" should mean

The word sync can hide a lot of risk. A local database should not silently copy an entire production bucket, repeatedly download the same partitions, or contain production secrets in a checked-in file.

Make every source explicit about its boundary:

| Source | Local ingestion contract | State to persist |
| --- | --- | --- |
| S3 Parquet export | Select approved prefixes and partitions, then load only new or changed files. | Object key, ETag or version, partition date, load run ID. |
| REST API | Use a cursor, `updated_at` watermark, or page token. Capture the raw response shape before modelling it. | Cursor or watermark, request window, response count, run ID. |
| WebSocket | Receive events for a short window, write a durable micro-batch, then load it. | Event ID or sequence, received timestamp, last checkpoint, batch ID. |

S3 is usually the cleanest place to start. DuckDB can query Parquet directly from S3-compatible storage, but that does not mean every dashboard query should reach over the network. The local warehouse should own a repeatable snapshot. A manifest of loaded files gives a developer a way to answer a basic but often missing question: "What exactly was in this run?"

REST data needs the same discipline. A nightly CRM sync should pull only records changed since the last successful watermark, then retain the cursor only after the load has committed. If the job dies halfway through, rerunning the same window must be safe.

WebSockets are different. A persistent socket is not a free replacement for a streaming platform. For this architecture, use a collector that runs for a bounded interval, writes an append-only batch with event IDs, and checkpoints only after dlt has landed it. That is enough for local product analytics, market monitoring, or operational investigations. High-volume, always-on event processing still belongs behind a durable broker and a production streaming system.

## The pipeline, as an executable contract

Prefect should orchestrate a small number of idempotent steps rather than hide all logic inside one large flow:

```python
from prefect import flow, task

@task(retries=2, retry_delay_seconds=30)
def load_orders_snapshot(run_window: str) -> None:
    # dlt source: API pagination or approved S3 partitions
    # destination: the raw schema in data/warehouse.duckdb
    ...

@task
def transform_orders() -> None:
    # uv run dbt build --select path:features/commerce/orders
    ...

@task
def publish_orders_mart() -> None:
    # export the mart to data/publish/orders/ as versioned Parquet
    ...

@flow(name="refresh-commerce-orders")
def refresh_orders(run_window: str) -> None:
    load_orders_snapshot(run_window)
    transform_orders()
    publish_orders_mart()
```

The code is intentionally unremarkable. Prefect adds schedules, parameters, state tracking, logs, and retries around normal Python functions. It should also enforce one writer for a given DuckDB database file. Let source extraction run concurrently if it is independent, but serialize commits and dbt runs that modify the shared warehouse.

dlt owns the extraction and raw load boundary. A source module should return records close to what the source produced, with a few ingestion fields such as `_ingested_at`, `_source_cursor`, and `_batch_id`. Do not turn dlt code into a business-modelling layer. The raw table is where an engineer can inspect a bad API payload or a malformed event without reverse-engineering a mart.

dbt then makes the semantics visible:

```sql
-- features/commerce/orders/models/stg_orders.sql
select
  cast(order_id as varchar) as order_id,
  cast(customer_id as varchar) as customer_id,
  cast(created_at as timestamp) as created_at,
  cast(total_amount as decimal(18, 2)) as total_amount,
  _ingested_at
from {{ source('raw', 'orders') }}
where order_id is not null
```

```sql
-- features/commerce/orders/models/int_orders_deduplicated.sql
select *
from (
  select
    *,
    row_number() over (
      partition by order_id
      order by _ingested_at desc
    ) as row_number
  from {{ ref('stg_orders') }}
)
where row_number = 1
```

```sql
-- features/commerce/orders/models/mart_daily_revenue.sql
select
  date_trunc('day', created_at) as order_date,
  count(*) as order_count,
  sum(total_amount) as revenue
from {{ ref('int_orders_deduplicated') }}
group by 1
```

The physical schemas can still be `raw`, `staging`, `intermediate`, and `mart`. The point is not to pretend those responsibilities do not exist. The point is to avoid making the repository itself a set of ever-growing layer folders where the customer, order, payment, and usage logic is scattered across four distant paths.

## A feature-based repository

An entity or product feature should own its ingestion code, dbt models, tests, and flow entry point. Cross-domain models get their own explicit feature instead of becoming a dumping ground called `intermediate`.

```text
local-olap/
├── pyproject.toml
├── uv.lock
├── dbt_project.yml
├── profiles.yml                 # local path only; credentials stay in env/secrets
├── features/
│   ├── commerce/
│   │   ├── orders/
│   │   │   ├── ingestion.py      # dlt source and load configuration
│   │   │   ├── flow.py           # Prefect flow and tasks
│   │   │   ├── models/
│   │   │   │   ├── sources.yml
│   │   │   │   ├── stg_orders.sql
│   │   │   │   ├── int_orders_deduplicated.sql
│   │   │   │   ├── mart_daily_revenue.sql
│   │   │   │   └── schema.yml
│   │   │   └── tests/
│   │   └── payments/
│   ├── product/
│   │   └── usage_events/
│   └── finance/
│       └── revenue_reporting/    # cross-domain business feature
├── shared/
│   ├── settings.py
│   ├── duckdb.py                 # one connection and writer policy
│   └── publishing.py             # Parquet version + atomic publish helpers
├── data/                         # gitignored, rebuildable local state
│   ├── warehouse.duckdb
│   ├── manifests/
│   └── publish/
└── rill/
    ├── sources/
    ├── models/
    └── dashboards/
```

This layout ages better when a new source arrives. A `payments` feature can add its own REST connector, models, quality tests, and schedule without changing a central `models/staging` directory full of unrelated SQL. The cost is a little more navigation at the start. The gain appears six months later, when a failed revenue number needs an owner and a trace from source to dashboard.

## A day in the life of the project

Use uv to make the commands boring and repeatable:

```bash
uv sync
uv run prefect server start
uv run python -m features.commerce.orders.flow --run-window 2026-09-22
uv run dbt build --select path:features/commerce/orders
rill start rill
```

`uv` owns the Python environment for dlt, dbt, and Prefect. Rill is typically installed and run through its own CLI, so keep its version explicit in the project's development setup rather than implying it is a Python dependency.

For a real team, the default development loop is:

1. Select a small, approved source window and run the feature flow locally.
2. Inspect the raw table and manifest. Fix extraction before changing SQL if the input is wrong.
3. Run `dbt build` for the feature. This executes models and tests together.
4. Publish a versioned mart Parquet directory only after the feature passes its tests.
5. Refresh the Rill dashboard and compare a known metric with the upstream system.

The database file, downloaded data, Rill caches, and secrets should stay out of Git. Commit source definitions, dbt tests, `uv.lock`, dashboard definitions, and a tiny public fixture instead. A new developer can rebuild local state; they do not need someone else's warehouse file.

## Where this works well

Consider a regional ecommerce team. Orders arrive as hourly Parquet exports in S3, customer support data comes from a REST API, and a WebSocket provides a short-lived stream of checkout errors during a release. An engineer needs to investigate whether a payment-provider rollout changed conversion by country.

They run a two-week source window into DuckDB, deduplicate orders in dbt, join the support data in a `revenue_reporting` feature, and publish a daily conversion mart. Rill gives product and operations a local dashboard during the investigation. Nobody has to wait for a central warehouse change to test the question. Nobody should mistake the result for a centrally governed production report either.

This pattern also works well for sales operations prototypes, analyst sandboxes built from approved exports, and CI checks against a compact fixture dataset. It becomes a poor fit when many people need the same live dataset, the source volume exceeds a workstation's practical limits, or the WebSocket is business-critical and never stops. Those cases need a shared warehouse, durable streaming infrastructure, and stronger access controls.

## A privacy-restricted development workflow

Consider a health-benefits platform building a new claims turnaround dashboard. The production source has member names, email addresses, dates of birth, claim notes, provider identifiers, and payment amounts. The team needs realistic distribution, join behaviour, late-arriving records, and refund cases to build the mart locally. It does not need a member's real identity.

The feature exposes a deliberately small development extract. dlt pulls an approved date window and column allowlist, then replaces direct identifiers with synthetic values or deterministic tokens before the rows reach `raw`. The local DuckDB database contains a stable `member_token`, claim dates, plan category, status, amount, and ingestion metadata. The token-to-member mapping never leaves the controlled source system.

![A privacy-restricted claims workflow: approved masked extracts support local DuckDB development, while code and contracts move to a separately governed cloud test dataset.](/assets/images/privacy-restricted-duckdb-development.png)

This changes what "push to cloud" means. The team promotes the dlt source definition, dbt models, tests, Prefect deployment, and dashboard definition. It does not upload a developer's `warehouse.duckdb` file. The cloud development environment runs the same code against its own governed test data, and production runs against production-authorized data under cloud IAM and audit controls.

The controls should be visible in the project, not left to a policy document:

- A source-level column allowlist rejects new sensitive fields until a data owner approves them.
- A dbt test fails if a model intended for Rill or MotherDuck contains an unapproved PII column.
- Local extracts are encrypted, time-limited, excluded from Git, and deleted or rebuilt after the retention period.
- Credentials are short-lived and can read only the development extract, never the unrestricted production source.
- Pseudonymised tokens still receive personal-data controls when someone could re-identify them with additional information.

This is an engineering pattern, not a legal classification. Security, privacy, and data-governance owners still need to approve the masking method, retention, permitted locations, and cloud environment before real personal data is used.

## Promote tested marts to MotherDuck when the work becomes shared

The same stack can grow beyond one laptop without abandoning DuckDB. MotherDuck provides managed cloud storage and compute built on DuckDB, and a local DuckDB client can attach to a MotherDuck database with the `md:` connection protocol. That makes it a sensible optional deployment target for the marts that a team needs to query together.

The important word is *promote*, not *mirror*. Do not make every local raw table, dlt state table, scratch query, and intermediate model a cloud asset by default. Promote the small set of tested, documented marts that have a real audience.

![A local DuckDB warehouse promotes tested marts to a shared MotherDuck analytics database after validation checks.](/assets/images/duckdb-motherduck-mart-promotion.png)

The flow becomes a final Prefect task after the local `dbt build` and Parquet publish steps:

```python
import duckdb
import os

def promote_daily_revenue() -> None:
    cloud = duckdb.connect(
        f"md:team_analytics?motherduck_token={os.environ['MOTHERDUCK_TOKEN']}"
    )
    cloud.execute("ATTACH 'data/warehouse.duckdb' AS local (READ_ONLY)")
    cloud.execute("CREATE SCHEMA IF NOT EXISTS mart")
    cloud.execute("""
        CREATE OR REPLACE TABLE mart.daily_revenue AS
        SELECT * FROM local.mart.daily_revenue
    """)
```

Treat this as deployment-shaped code, not as a convenient one-liner hidden in a notebook. For a replacement-style mart, run the local dbt tests first, record a versioned run ID, validate row counts and freshness, then replace the cloud table. For an append-only fact table, publish a named partition or batch ID and enforce a unique key rather than blindly appending on every retry.

There are two practical paths:

| Need | Promotion method | Why |
| --- | --- | --- |
| A small set of shared dashboards | Copy selected mart tables from the attached local database into a MotherDuck database. | Team BI can query a governed cloud table while local development stays quick. |
| Large published marts already written as Parquet | Let the cloud-side workflow read the approved Parquet release from object storage. | It avoids uploading a large local database file and gives the cloud a durable release artifact. |

MotherDuck can also upload a complete local DuckDB database. That is useful for a short-lived demo or a reproducible handoff, but it is usually the wrong default for this project. A complete database includes local raw data and implementation detail that most consumers do not need. A selective mart promotion provides a much cleaner ownership boundary.

The direction can also reverse for development: a developer can attach a read-only cloud database, pull a small approved slice into their local DuckDB file, and iterate on a feature. Keep that read path separate from the publication path. Otherwise an experiment on a laptop can become an accidental production write.

## The scaling boundary: local DuckDB, MotherDuck, then DuckLake

DuckDB is not limited to toy data, but a local `.duckdb` file has physical limits: one machine's SSD, memory, network, and writer concurrency. It is the right default for a developer's representative slice, a repeatable CI fixture, or a single analyst's bounded investigation. Once every developer needs the full history, many people need concurrent writes, or a refresh runs longer than a reasonable local job, the local file has become the wrong system of record.

MotherDuck moves the DuckDB experience into managed cloud storage and compute. It is a good next step for shared datasets from gigabytes through many terabytes, where teams want the same SQL and a collaborative database without operating a cluster. I would not describe a standalone MotherDuck database as the petabyte tier. MotherDuck's own material positions DuckLake as the extension for petabyte-scale lakehouse workloads; its DuckLake product is currently marked as public preview.

| Stage | Data and operating shape | Where data lives | Main constraint |
| --- | --- | --- | --- |
| Local DuckDB | Development slices, local BI, incident analysis, CI fixtures. | A developer-managed database file and local published Parquet. | One machine and a single coordinated writer. |
| MotherDuck | Shared marts and team analytics from gigabytes into the terabyte range. | Managed MotherDuck database. | A warehouse database is still not a cheap substitute for an unbounded data lake. |
| DuckLake | Large historical fact tables, multi-client access, and object-store-scale data. | Parquet files in object storage plus a transactional SQL catalog. | Storage, IAM, catalog operations, and file maintenance now need platform ownership. |

DuckLake changes the physical layout, not the analytical intent. Instead of putting all table data into one DuckDB file, it stores table files as Parquet in S3 or another supported object store. A catalog database holds the table metadata, snapshots, schema changes, and file list. For a real multi-user deployment, DuckLake recommends PostgreSQL as the catalog rather than a local DuckDB file, which remains single-client.

![DuckLake separates compute clients, a transactional SQL catalog, and Parquet data files in object storage.](/assets/images/ducklake-object-storage-architecture.png)

```sql
-- Self-managed DuckLake: PostgreSQL stores metadata; S3 stores Parquet files.
INSTALL ducklake;
INSTALL postgres;

ATTACH 'ducklake:postgres:dbname=ducklake_catalog host=catalog.internal' AS lake
  (DATA_PATH 's3://company-analytics/ducklake/');
USE lake;
```

On MotherDuck, the managed path is shorter when the service and its preview status fit the team's risk tolerance:

```sql
CREATE DATABASE company_lake (
  TYPE DUCKLAKE,
  DATA_PATH 's3://company-analytics/ducklake/'
);
```

This is not a rewrite of every dlt source or dbt model. The source contracts, feature ownership, and mart definitions can remain. The migration work is operational: provision the bucket and IAM roles, choose and back up the catalog, decide retention and compaction policy, migrate a bounded set of tables, then dual-run and reconcile before changing consumers. DuckLake also does not magically make a laptop a distributed compute cluster. It separates data storage and metadata so the data can grow; query concurrency and compute still need a suitable engine and deployment plan.

For this project, the simplest growth path is practical: keep local DuckDB for development, promote shared marts to MotherDuck, and introduce DuckLake only when the shared historical data or multi-client write pattern makes an object-store table format necessary. Do not start with DuckLake merely because the name sounds more scalable.

## The controls that keep it useful

The architecture is simple enough to become sloppy quickly. A few rules prevent that:

- Treat `warehouse.duckdb` as a cacheable build artifact. Keep the source manifests and model code that can recreate it.
- Use stable source IDs and deterministic dbt deduplication. Retries otherwise create quiet double counts.
- Write Parquet to a temporary versioned directory, validate it, then atomically switch the published pointer or latest manifest.
- Keep the warehouse single-writer. A shared local file is not a concurrency strategy.
- Put source credentials in environment variables, a local secret store, or Prefect blocks. Do not place them in `profiles.yml` or a dlt configuration committed to Git.
- Put a freshness expectation and a row-count or reconciliation test on each mart that powers a dashboard.

The attractive part of this stack is not that it removes engineering work. It makes the engineering loop tight: source boundary, raw evidence, tested transformation, published artifact, dashboard. DuckDB gives that loop a serious local analytical engine without requiring a cluster to answer every question.

## References

- [DuckDB: data sources](https://duckdb.org/docs/current/data/data_sources)
- [DuckDB: S3 API support](https://duckdb.org/docs/current/core_extensions/httpfs/s3api)
- [dlt: load REST API data into DuckDB](https://dlthub.com/docs/pipelines/rest_api/load-data-with-python-from-rest_api-to-duckdb)
- [dbt-duckdb adapter](https://github.com/duckdb/dbt-duckdb)
- [Prefect: introduction](https://docs.prefect.io/v3/api-ref/python/prefect-cli-deploy)
- [Rill: DuckDB connector](https://docs.rilldata.com/developers/build/connectors/olap/duckdb)
- [uv: working on projects](https://docs.astral.sh/uv/guides/projects/)
- [MotherDuck: DuckDB in the cloud](https://motherduck.com/product/duckdb-users/)
- [MotherDuck: local dbt development and cloud sharing](https://motherduck.com/videos/take-flight-with-dbt-and-duckdb-dropping-dev-warehouse-costs-to-zero/)
- [MotherDuck: managed DuckLake](https://motherduck.com/product/ducklake/)
- [DuckLake: choosing a catalog database](https://ducklake.select/docs/stable/duckdb/usage/choosing_a_catalog_database)
- [DuckLake: connecting a PostgreSQL catalog to S3 storage](https://ducklake.select/docs/stable/duckdb/usage/connecting)
- [ICO: pseudonymisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/pseudonymisation/)
- [NIST: guide to protecting PII confidentiality](https://www.nist.gov/publications/guide-protecting-confidentiality-personally-identifiable-information-pii)
- [agent-pipe](https://github.com/inotives/agent-pipe)
