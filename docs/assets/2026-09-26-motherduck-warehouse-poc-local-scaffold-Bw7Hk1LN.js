var e=`---
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

Start with batch ingestion. An application exports Parquet to an S3 landing prefix. Prefect sees the batch, checks it before any load, and routes bad files to quarantine. A passing batch lands in a Bronze table with \`_ingested_at\` and \`_source_file\` recorded. dbt then builds Silver tables for type fixes and deduplication, followed by Gold marts for BI.

\`\`\`text
application export
  → s3://warehouse/landing/*.parquet
  → Prefect: size, schema, type, and row-count checks
  → failed: s3://warehouse/quarantine/ + alert
  → passed: MotherDuck Bronze
  → dbt-duckdb: Silver
  → dbt test + business logic: Gold
  → Rill or QuickSight
\`\`\`

The gatekeeper should fail closed. A file with zero rows, a missing required column, or a type change should not quietly join an analytics table. Move it to a quarantine prefix, retain the original path and failure reason, and alert the operator. This is much cheaper than explaining a broken executive dashboard after the fact.

Bronze stays close to what arrived. Silver is where duplicate records, timestamp conventions, null handling, and schema drift become explicit. Gold is where business questions get stable names: daily revenue, active customer, order volume, or a finance-ready fact table with dimensions. A dashboard should read Gold, not a raw landing table.

## Start with the free POC account, not a production contract

As of September 2026, MotherDuck offers a Lite plan with 10 GB of storage and 10 Pulse compute hours each month. A seven-day Business-plan trial is also available. MotherDuck says neither requires a credit card. That is enough for a controlled POC if the team uses small representative data, limits exploratory scans, and cleans up test databases.

Use the Lite plan for the first loop: create databases, test the connection, load a few Parquet batches, build the first dbt models, and let one or two people review the BI output. Track compute from the first week. An apparently small POC can burn through its allowance when every change triggers full scans over copied data.

Do not choose a paid production tier because a diagram says so. Move when you have observed ingestion frequency, concurrent users, data retained in MotherDuck, expected dashboard demand, and the service-account pattern that Prefect will use. The supplied design anticipates a Business plan for sustained tens-of-GB-per-day ingestion, but confirm current limits and pricing with MotherDuck before approving spend.

The first accounts and access boundaries are straightforward:

- A MotherDuck organisation and a named developer account. Create a development access token, give it an expiry, and keep it out of the repository.
- An AWS account with a deliberately scoped IAM role for the S3 landing, archive, and quarantine prefixes. Do not begin with broad bucket access.
- A Prefect Cloud workspace or local Prefect server for the POC. The first flow can run locally; a production worker comes later.
- A GitHub repository for dbt models, Prefect flows, Terraform, and CI. MotherDuck tokens belong in local environment configuration or a secrets manager, never in source control.

MotherDuck documents \`motherduck_token\` as the environment variable for an access token. Store it in a local \`.env\` file that is ignored by Git or inject it through a secrets manager. A developer should be able to run \`duckdb "md:warehouse_dev"\` without pasting a token into a command history.

## Separate local, development, and production before there is data to protect

Use three places, even in a POC:

| Environment | Purpose | Typical data |
| --- | --- | --- |
| Local DuckDB | Fast model work and tests | Synthetic or scrubbed fixtures |
| MotherDuck development | Shared integration checks | Small approved extracts or cloned structures |
| MotherDuck production | Scheduled loads and BI | Governed production data |

Do not treat a MotherDuck development database as a developer's personal sandbox. Give it a clear owner, use a predictable name such as \`warehouse_dev\`, and let CI rebuild a known schema when feasible. For production-like debugging, clone structures or use a tightly controlled sample. PII does not become safe merely because it is in a database called \`dev\`.

MotherDuck can be used from DuckDB through an \`md:\` connection string. That makes a local test and a shared integration run feel similar, but they are not the same risk boundary. Local fixtures should remain small and non-sensitive. Shared database access needs named tokens, least privilege, and an audit trail.

## Scaffold the repository before building flows

Make this decision before the second department arrives: organise the repository by feature, never by Bronze, Silver, and Gold folders. Here, “feature” means a cohesive unit of code and models that changes, runs, and is tested together. That unit can be a business domain such as orders, or it can be a data source such as CoinGecko, an internal company application, or blockchain data. Bronze, Silver, and Gold remain warehouse schemas and dbt materialisation targets; they are not the top-level map of the codebase.

This matters when the warehouse grows beyond one application. Finance may add an ERP extract, product may add event streams, and a client-facing platform may need separate source mappings or policies for each tenant. A layer-based tree splits one change across \`bronze/\`, \`silver/\`, \`gold/\`, and a generic flows directory. An engineer investigating an Acme order-volume issue then has to reconstruct the feature from scattered files. Put the feature first, then place sources and tenant-specific configuration beneath it.

![Source-oriented feature folders keep the CoinGecko, internal application, and blockchain-data implementations separate while sharing reusable S3 and quality-gate code, then loading MotherDuck Bronze, Silver, and Gold schemas.](/assets/images/motherduck-feature-based-repository-structure.png)

\`\`\`text
motherduck-warehouse/
├── .env.example
├── docker-compose.yml
├── pyproject.toml
├── dbt/
│   ├── dbt_project.yml
│   ├── profiles.yml.example
│   └── packages.yml
├── features/
│   └── orders/
│       ├── contracts/
│       │   └── orders.md
│       ├── sources/
│       │   ├── application_export.yml
│       │   └── partner_sftp.yml
│       ├── tenants/
│       │   └── acme.yml
│       ├── ingestion.py
│       ├── models/
│       │   ├── sources.yml
│       │   ├── stg_orders.sql
│       │   ├── int_orders_deduplicated.sql
│       │   └── mart_order_volume.sql
│       └── tests/
│           └── fixtures/orders.parquet
│   ├── coingecko/
│   │   ├── ingestion.py
│   │   ├── models/
│   │   └── tests/
│   ├── internal-company-app/
│   │   ├── ingestion.py
│   │   ├── models/
│   │   └── tests/
│   └── blockchain-data/
│       ├── ingestion.py
│       ├── models/
│       └── tests/
├── shared/
│   ├── s3.py
│   └── quality_gate.py
├── infra/
│   └── terraform/
└── deployments/
    └── prefect.yaml
\`\`\`

The names \`stg\`, \`int\`, and \`mart\` describe the model's job, not a separate deployment layer. dbt still materialises the tables in the appropriate Bronze, Silver, or Gold schema. Configure dbt's \`model-paths\` to include \`../features\`, then keep every feature's model lineage beside its operational code.

\`tenants/acme.yml\` should contain configuration such as source prefixes, allowed regions, or a client identifier. It should not fork the whole orders model by default. Add a narrowly scoped tenant override only when its business rules genuinely differ. This keeps shared logic shared while retaining a single obvious place to inspect what varies by customer or source.

When a new source arrives, copy the smallest source-folder template, then change the contract, credentials reference, ingestion adapter, models, and fixtures for that source. That is intentionally mechanical. It gives every source the same operational shape without forcing unrelated sources into one oversized pipeline. Promote genuinely repeated code, such as S3 handling, retry policy, or the health gate, into \`shared/\`; leave source-specific logic with the source.

## Bootstrap the local Mac environment

Install DuckDB, Docker Desktop, Python 3.12 or later, and \`uv\`. Then create the project environment and add only the first runtime dependencies:

\`\`\`bash
uv init motherduck-warehouse
cd motherduck-warehouse
uv add duckdb dbt-duckdb prefect boto3 python-dotenv
mkdir -p features/orders/{contracts,sources,tenants,models,tests/fixtures} shared infra/terraform deployments
\`\`\`

Create \`.env\` from \`.env.example\` and keep real values local:

\`\`\`bash
motherduck_token=replace-with-a-short-lived-dev-token
AWS_REGION=ap-southeast-1
S3_LANDING_PREFIX=s3://example-warehouse/landing/
S3_QUARANTINE_PREFIX=s3://example-warehouse/quarantine/
\`\`\`

For the first dbt profile, use a local file target and a MotherDuck development target. Run the former by default. The second exists for an explicit integration check.

\`\`\`yaml
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
\`\`\`

With \`motherduck_token\` in the environment, the DuckDB client authenticates the \`md:warehouse_dev\` connection. Do not put the token inside \`profiles.yml\`. Add the project-specific \`.local/\` directory and \`.env\` to \`.gitignore\`.

The first useful local command sequence is boring on purpose:

\`\`\`bash
uv run dbt deps --project-dir dbt
uv run dbt build --project-dir dbt --target local
uv run python prefect/flows/orders_ingestion.py
\`\`\`

Make that work against one fixture before Dockerising a worker, provisioning ECS Fargate, or building a dashboard. The flow should validate one file, load a Bronze table, run dbt, and leave evidence of what it processed. If that loop is flaky on a Mac, it will be harder to diagnose in AWS.

## How this grows without a rewrite

The intended evolution is gradual, not a forklift migration.

![A three-stage roadmap moves from local DuckDB development to a shared MotherDuck warehouse and then to DuckLake only when larger-scale storage and multi-engine needs justify it.](/assets/images/motherduck-warehouse-scaling-roadmap.png)

Stage one is local fixtures plus a small MotherDuck database. Stage two moves scheduled Prefect flows into ECS Fargate, uses a production MotherDuck database for curated marts, and puts secrets in AWS Secrets Manager. S3 becomes the durable source and archive. Terraform then owns the bucket policies, IAM roles, task definitions, and alarms.

DuckLake is a later architectural option when retained data, partition management, concurrency, or the need for multiple compute engines outgrows the simple shared-warehouse model. Its value is an open lakehouse layout: Parquet files remain in object storage while transactional metadata coordinates tables. Do not introduce it because the name sounds more scalable. Introduce it after measuring an actual constraint, then validate catalog compatibility, maintenance operations, recovery procedures, and the effect on every reader.

The SQL models, data contracts, quality gate, and S3 layout are the assets that should survive every stage. If they are clear, the compute and catalog choice can change without rewriting the business logic.

## What comes next

The next article will turn this scaffold into a working ingestion path: S3 prefixes, a Prefect health-check task, quarantine behaviour, and a Bronze load that records batch provenance. It will also define the first data contract, because a schema check is only as useful as the agreement behind it.

## References

- [MotherDuck pricing](https://motherduck.com/pricing/)
- [MotherDuck authentication and access tokens](https://motherduck.com/docs/key-tasks/authenticating-to-motherduck/)
- [DuckDB documentation](https://duckdb.org/docs/)
- [dbt-duckdb adapter](https://github.com/duckdb/dbt-duckdb)
- [Prefect documentation](https://docs.prefect.io/)
- [DuckLake documentation](https://ducklake.select/)
`;export{e as default};