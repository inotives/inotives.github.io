---
title: "Building a MotherDuck warehouse: the local-first POC and dev scaffold"
date: 2026-09-26
tags: [data-engineering, motherduck, duckdb, dbt, prefect, aws, data-warehouse]
summary: "The first article in a practical MotherDuck warehouse series: why start local-first, how S3, Prefect, dbt, and MotherDuck fit together, what the POC account actually includes, and how to scaffold a Mac development environment."
series: building-motherduck-warehouse
---

Most data warehouse POCs fail for a dull reason: the first useful change takes too much machinery. A developer has to wait for a remote environment, a shared scheduler, an IAM update, and a cloud deployment before they can check whether one model is correct. The result is a warehouse that is technically cloud-native but painfully slow to develop.

This series starts with a different shape. DuckDB is the local SQL engine. MotherDuck is the shared managed warehouse when a team needs the same data and a durable place for it to live. AWS S3 remains the landing and archival layer. Prefect coordinates the work, while dbt owns transformations and tests. Rill or QuickSight reads the finished marts.

The first goal is modest: take a batch of Parquet files through a guarded path into trustworthy Gold tables, while keeping the normal development loop on a Mac short enough to use every day.

![Data moves from S3 through a Prefect quality gate and MotherDuck Bronze, Silver, and Gold layers, while local Mac development connects to a separate MotherDuck development database.](/assets/images/motherduck-local-first-warehouse-architecture.png)

## Why this setup is worth trying

This is not a claim that DuckDB and MotherDuck replace every warehouse. They are a strong fit when a small team has analytical data already arriving as files, wants SQL and Python tooling without operating a database cluster, and expects the POC to become a shared service if it proves useful.

The local part matters. A developer can point dbt at a local DuckDB file and run models against a small, representative Parquet fixture. There is no cloud cost for that loop and no risk of writing to a shared database. When the model is ready to exercise against current shared data, the target changes to a dedicated MotherDuck development database. The SQL stays DuckDB-compatible.

MotherDuck supplies the shared layer that a laptop cannot: a managed place for curated tables, team access, and BI readers. The production flow can run in AWS, while the developer still uses the same driver and SQL dialect locally. That reduces the most common source of POC friction: a local stack that behaves nothing like production.

There are limits. MotherDuck is a managed service, so it is not an on-premises answer. A local DuckDB file is also a development and small-data tool, not a multi-user production warehouse. S3, object lifecycle policies, IAM, and failure handling still need deliberate design. The stack is simple because each part has one job, not because the hard operational work disappears.

## The first architecture

Start with batch ingestion. An application exports Parquet to an S3 landing prefix. Prefect sees the batch, checks it before any load, and routes bad files to quarantine. A passing batch lands in a Bronze table with `_ingested_at` and `_source_file` recorded. dbt then builds Silver tables for type fixes and deduplication, followed by Gold marts for BI.

```text
application export
  → s3://warehouse/landing/*.parquet
  → Prefect: size, schema, type, and row-count checks
  → failed: s3://warehouse/quarantine/ + alert
  → passed: MotherDuck Bronze
  → dbt-duckdb: Silver
  → dbt test + business logic: Gold
  → Rill or QuickSight
```

The gatekeeper should fail closed. A file with zero rows, a missing required column, or a type change should not quietly join an analytics table. Move it to a quarantine prefix, retain the original path and failure reason, and alert the operator. This is much cheaper than explaining a broken executive dashboard after the fact.

Bronze stays close to what arrived. Silver is where duplicate records, timestamp conventions, null handling, and schema drift become explicit. For this POC, Gold can start with a daily coin market-data mart: open, high, low, close, volume, market cap, and circulating supply at a declared time grain. A dashboard should read Gold, not a raw landing table.

## Start with the free POC account, not a production contract

As of September 2026, MotherDuck offers a Lite plan with 10 GB of storage and 10 Pulse compute hours each month. A seven-day Business-plan trial is also available. MotherDuck says neither requires a credit card. That is enough for a controlled POC if the team uses small representative data, limits exploratory scans, and cleans up test databases.

Use the Lite plan for the first loop: create databases, test the connection, load a few Parquet batches, build the first dbt models, and let one or two people review the BI output. Track compute from the first week. An apparently small POC can burn through its allowance when every change triggers full scans over copied data.

Do not choose a paid production tier because a diagram says so. Move when you have observed ingestion frequency, concurrent users, data retained in MotherDuck, expected dashboard demand, and the service-account pattern that Prefect will use. The supplied design anticipates a Business plan for sustained tens-of-GB-per-day ingestion, but confirm current limits and pricing with MotherDuck before approving spend.

The first accounts and access boundaries are straightforward:

- A MotherDuck organisation and a named developer account. Create a development access token, give it an expiry, and keep it out of the repository.
- An AWS account with a deliberately scoped IAM role for the S3 landing, archive, and quarantine prefixes. Do not begin with broad bucket access.
- A Prefect Cloud workspace or local Prefect server for the POC. The first flow can run locally; a production worker comes later.
- A GitHub repository for dbt models, Prefect flows, Terraform, and CI. MotherDuck tokens belong in local environment configuration or a secrets manager, never in source control.

MotherDuck documents `motherduck_token` as the environment variable for an access token. Store it in a local `.env` file that is ignored by Git or inject it through a secrets manager. A developer should be able to run `duckdb "md:warehouse_dev"` without pasting a token into a command history.

## Separate local, development, and production before there is data to protect

Use three places, even in a POC:

| Environment | Purpose | Typical data |
| --- | --- | --- |
| Local DuckDB | Fast model work and tests | Synthetic or scrubbed fixtures |
| MotherDuck development | Shared integration checks | Small approved extracts or cloned structures |
| MotherDuck production | Scheduled loads and BI | Governed production data |

Do not treat a MotherDuck development database as a developer's personal sandbox. Give it a clear owner, use a predictable name such as `warehouse_dev`, and let CI rebuild a known schema when feasible. For production-like debugging, clone structures or use a tightly controlled sample. PII does not become safe merely because it is in a database called `dev`.

MotherDuck can be used from DuckDB through an `md:` connection string. That makes a local test and a shared integration run feel similar, but they are not the same risk boundary. Local fixtures should remain small and non-sensitive. Shared database access needs named tokens, least privilege, and an audit trail.

## Scaffold the repository before building flows

Make this decision before the second data source arrives: organise the repository by feature, never by Bronze, Silver, and Gold folders. Here, “feature” means a cohesive unit of code and models that changes, runs, and is tested together. This POC's first feature is market data: a `coins` reference dataset plus time-varying `market_data` observations. Bronze, Silver, and Gold remain warehouse schemas and dbt materialisation targets; they are not the top-level map of the codebase.

This matters when the warehouse grows beyond one application. You may add on-chain data, an exchange feed, or a second market-data provider. A layer-based tree splits one change across `bronze/`, `silver/`, `gold/`, and a generic flows directory. An engineer investigating a missing BTC candle then has to reconstruct the feature from scattered files. Put the feature first, then place source-specific configuration beneath it.

![Source-oriented feature folders keep the CoinGecko, internal application, and blockchain-data implementations separate while sharing reusable S3 and quality-gate code, then loading MotherDuck Bronze, Silver, and Gold schemas.](/assets/images/motherduck-feature-based-repository-structure.png)

```text
motherduck-warehouse/
├── .env.example
├── docker-compose.yml
├── pyproject.toml
├── dbt/
│   ├── dbt_project.yml
│   ├── profiles.yml.example
│   └── packages.yml
├── features/
│   └── market_data/
│       ├── contracts/
│       │   ├── coins.md
│       │   └── market_data.md
│       ├── sources/
│       │   └── market_data_export.yml
│       ├── ingestion.py
│       ├── models/
│       │   ├── sources.yml
│       │   ├── stg_coins.sql
│       │   ├── stg_market_data.sql
│       │   ├── int_market_data_deduplicated.sql
│       │   └── mart_daily_market_data.sql
│       └── tests/
│           ├── fixtures/coins.parquet
│           └── fixtures/market_data.parquet
├── shared/
│   ├── s3.py
│   └── quality_gate.py
├── infra/
│   └── terraform/
└── deployments/
    └── prefect.yaml
```

The names `stg`, `int`, and `mart` describe the model's job, not a separate deployment layer. dbt still materialises the tables in the appropriate Bronze, Silver, or Gold schema. Configure dbt's `model-paths` to include `../features`, then keep every feature's model lineage beside its operational code.

`sources/market_data_export.yml` should contain configuration such as landing prefixes, quote currency, and the source identifier. It should not fork the whole market-data model by default. Add a narrowly scoped source override only when its business rules genuinely differ. This keeps shared logic shared while retaining a single obvious place to inspect what varies by provider.

The first contracts are deliberately small. `coins` has `id` (int), `uniq_key` (string), and `name` (string). `market_data` has `coin_uniq_key` (string); `time_open`, `time_close`, `time_high`, `time_low`, and `timestamp` (timestamp); `name` (string); and `open`, `high`, `low`, `close`, `volume`, `market_cap`, and `circulating_supply` (decimal). The next article will state which timestamp defines the observation grain and enforce that `coin_uniq_key` resolves to `coins.uniq_key`.

When a new source arrives, copy the smallest source-folder template, then change the contract, credentials reference, ingestion adapter, models, and fixtures for that source. That is intentionally mechanical. It gives every source the same operational shape without forcing unrelated sources into one oversized pipeline. Promote genuinely repeated code, such as S3 handling, retry policy, or the health gate, into `shared/`; leave source-specific logic with the source.

## Bootstrap the local Mac environment

Install DuckDB, Docker Desktop, Python 3.12 or later, and `uv`. Then create the project environment and add only the first runtime dependencies:

```bash
uv init motherduck-warehouse
cd motherduck-warehouse
uv add duckdb dbt-duckdb prefect boto3 python-dotenv
mkdir -p features/market_data/{contracts,sources,models,tests/fixtures} shared infra/terraform deployments
```

Create `.env` from `.env.example` and keep real values local:

```bash
motherduck_token=replace-with-a-short-lived-dev-token
AWS_REGION=ap-southeast-1
S3_LANDING_PREFIX=s3://example-warehouse/landing/
S3_QUARANTINE_PREFIX=s3://example-warehouse/quarantine/
```

For the first dbt profile, use a local file target and a MotherDuck development target. Run the former by default. The second exists for an explicit integration check.

```yaml
warehouse:
  target: local
  outputs:
    local:
      type: duckdb
      path: .local/warehouse.duckdb
      threads: 4
    motherduck_dev:
      type: duckdb
      path: "md:warehouse_dev"
      threads: 4
```

With `motherduck_token` in the environment, the DuckDB client authenticates the `md:warehouse_dev` connection. Do not put the token inside `profiles.yml`. Add the project-specific `.local/` directory and `.env` to `.gitignore`.

The first useful local command sequence is boring on purpose:

```bash
uv run dbt deps --project-dir dbt
uv run dbt build --project-dir dbt --profiles-dir dbt --target local
uv run python features/market_data/ingestion.py --batch 2026-09-26T090000Z --target local
```

Make that work against one fixture before Dockerising a worker, provisioning ECS Fargate, or building a dashboard. The flow should validate the paired `coins` and `market_data` dump, load both Bronze tables, run dbt, and leave evidence of what it processed. If that loop is flaky on a Mac, it will be harder to diagnose in AWS.

## How this grows without a rewrite

The intended evolution is gradual, not a forklift migration.

![A three-stage roadmap moves from local DuckDB development to a shared MotherDuck warehouse, then shows a BYOB deployment using DuckLake with data and compute kept within the controlled boundary.](/assets/images/motherduck-warehouse-scaling-roadmap.png)

Stage one is local fixtures plus a small MotherDuck database. Stage two moves scheduled Prefect flows into ECS Fargate, uses a production MotherDuck database for curated marts, and puts secrets in AWS Secrets Manager. S3 becomes the durable source and archive. Terraform then owns the bucket policies, IAM roles, task definitions, and alarms.

Some data policies require data to stay in an AWS account or other infrastructure the team controls. For this series' BYOB setup, we will keep the Parquet files in our own S3 bucket and use DuckLake to manage table metadata, snapshots, and schema changes. S3 is the storage layer; DuckLake is the table format.

BYOB describes where the bucket lives, not where every part of the system lives. A DuckLake deployment also has a catalog database; an Iceberg deployment has catalog and metadata services. Compute may be managed separately too. If policy requires all data and metadata to stay within the controlled boundary, place the catalog and compute there as well, and verify network paths, logs, backups, encryption keys, and support access against the policy. Keeping Parquet in your S3 bucket alone does not prove that the whole control plane is in your account.

### DuckLake

DuckLake stores table data as Parquet in object storage and keeps table metadata in a transactional SQL catalog. A DuckDB extension reads and writes the format, so it fits the local-first SQL workflow in this POC. This is the format we will use for the series' BYOB path.

Pros:

- Direct fit with DuckDB and familiar SQL for creating and querying tables.
- Data files can live in your own S3 bucket while the catalog runs on a SQL database you choose.
- Catalog transactions, snapshots, schema evolution, and partitioning are part of the format.

Cons:

- The SQL catalog is another stateful service to secure, back up, monitor, and recover. Its location must meet the same data policy as the Parquet files.
- The engine ecosystem is narrower than Iceberg's today. Check that every required reader and writer supports the DuckLake features and versions you plan to use.
- The catalog can become a throughput constraint, so test your write concurrency and metadata workload rather than assuming S3 scale alone determines capacity.

### Apache Iceberg

Iceberg is an open table format designed for use across analytic engines. It stores table metadata alongside data files and uses a catalog to locate and update table state. Your bucket can remain in your account, with a catalog such as AWS Glue or a self-managed catalog deployed inside the boundary.

Pros:

- Broad engine support, including Spark, Trino, Flink, Hive, and Impala, gives teams more choice about how they read and write the same tables.
- A widely adopted specification and catalog integrations make it easier to connect existing lakehouse tools and services.
- Snapshots, schema and partition evolution, and time travel support long-lived analytical tables without tying the data to one query engine.

Cons:

- The ecosystem brings more components and configuration: choose and operate a catalog, align engine versions, and manage permissions across writers and readers.
- File cleanup, snapshot expiration, compaction, and catalog health become regular operational work.
- "Iceberg support" varies by engine and catalog. Validate the particular operations you need, such as deletes, schema changes, and snapshot reads, across every engine in the design.

For this series, the BYOB setup uses DuckLake because DuckDB is the main engine in this workflow. Iceberg remains a reasonable alternative when several engines must share the tables or the platform already operates an Iceberg catalog, but we will not build that setup here. Whichever format a team chooses, test access boundaries and recovery before moving sensitive data.

The SQL models, data contracts, quality gate, and S3 layout are the assets that should survive every stage. If they are clear, the compute and catalog choice can change without rewriting the business logic.

## What comes next

The next article will turn this scaffold into a working ingestion path: S3 prefixes, a Prefect health-check task, quarantine behaviour, and a Bronze load that records batch provenance. It will also define the first data contract, because a schema check is only as useful as the agreement behind it.

## References

- [MotherDuck pricing](https://motherduck.com/pricing/)
- [MotherDuck authentication and access tokens](https://motherduck.com/docs/key-tasks/authenticating-to-motherduck/)
- [DuckDB documentation](https://duckdb.org/docs/)
- [DuckDB lakehouse format support](https://duckdb.org/docs/current/lakehouse_formats)
- [dbt-duckdb adapter](https://github.com/duckdb/dbt-duckdb)
- [Prefect documentation](https://docs.prefect.io/)
- [DuckLake documentation](https://ducklake.select/)
- [DuckLake storage choices](https://ducklake.select/docs/stable/duckdb/usage/choosing_storage.html)
- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)
