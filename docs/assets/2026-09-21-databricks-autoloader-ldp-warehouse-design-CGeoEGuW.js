var e=`---
title: "Designing a Databricks warehouse with Auto Loader, Lakeflow, and a scalable monorepo"
date: 2026-09-21
tags: [data-engineering, databricks, lakeflow, unity-catalog, medallion-architecture]
series: data-engineering
summary: "A practical Databricks warehouse design for Parquet files landing in S3: Auto Loader ingestion, Lakeflow Declarative Pipelines transformations, Unity Catalog governance, a feature-oriented monorepo, and a SaaS-native delivery workflow."
---

The starting point is ordinary: an application database exports Parquet files to S3. The mistake is treating the next step as a simple file-load job. At production scale, the hard parts are knowing which files were processed, handling schema changes, keeping development away from production data, and making a change to one business entity without untangling a repository organised around \`bronze/\`, \`silver/\`, and \`gold/\` folders.

Databricks gives this setup a useful division of labour. S3 remains the landing zone. Unity Catalog governs who can reach that storage and who can query the resulting data products. Auto Loader discovers arriving files incrementally. Lakeflow Declarative Pipelines (LDP) defines the dependency graph that turns the raw stream into Bronze, Silver, and Gold tables.

That is more than a product diagram. It changes how the team structures code and how it ships changes.

## The warehouse flow

Imagine a commerce platform exporting completed orders every five minutes. The exporter writes immutable Parquet files under a prefix such as \`s3://company-raw-prod/commerce/orders/ingest_date=2026-09-21/\`. It should never overwrite yesterday's files. Reprocessing an immutable landing zone is tractable; reasoning about a silently replaced file is not.

![Databricks warehouse flow from an application database through S3, Auto Loader, Lakeflow Declarative Pipelines, medallion tables, and BI](/assets/images/databricks-autoloader-ldp-data-flow.png)

Unity Catalog is not another storage hop between S3 and Bronze. It is the governance and metadata plane. A storage credential binds an AWS IAM role to Databricks; an external location binds that credential to an allowed S3 path. The pipeline identity receives only the \`READ FILES\` and table privileges it needs. This is what makes an \`s3://\` source a governed source rather than a path every notebook can read.

### 1. Land immutable Parquet files in S3

The application exporter owns the raw contract. Each file should carry enough operational context to trace it later: source system, extraction time, schema version, and batch or transaction range. Put that context in partition paths, a manifest, or both. Do not use the warehouse to guess whether an application dump is complete.

For a high-volume S3 source, enable managed file events where the platform and operating cadence allow it. It is generally a better fit than repeatedly listing a deep prefix. There is still an operational requirement: the ingestion stream needs to run often enough for its discovery state to remain current.

### 2. Use Auto Loader as the incremental file reader

Inside an LDP SQL pipeline, \`STREAM read_files(...)\` uses Auto Loader. It discovers new files and reads them as a streaming source. When used to define an LDP streaming table, Databricks manages the checkpoint and schema locations rather than forcing every developer to invent those paths.

\`\`\`sql
CREATE OR REFRESH STREAMING TABLE commerce.orders_bronze
(
  CONSTRAINT order_id_present EXPECT (order_id IS NOT NULL) ON VIOLATION DROP ROW
)
AS
SELECT
  *,
  _metadata.file_path AS source_file,
  current_timestamp() AS ingested_at
FROM STREAM read_files(
  's3://company-raw-prod/commerce/orders/',
  format => 'parquet'
);
\`\`\`

The source path must sit under a Unity Catalog external location, and the execution identity needs the required file and table permissions. In a real pipeline, preserve source metadata and choose the expectation action deliberately. Dropping an invalid row can be appropriate for a non-critical telemetry feed; for orders or payments, quarantine it with an error reason or fail the update. Losing a bad record quietly is rarely a data-quality policy.

### 3. Keep Bronze boring and recoverable

Bronze is an append-oriented record of what arrived, not a place to perfect the model. Add ingestion metadata, standardise the obvious physical types, and retain fields that let an engineer locate the original file. Avoid joining customer dimensions or applying business definitions here.

This is the layer that gives a team a clean recovery path when a downstream model changes. If the Silver deduplication logic is wrong, rebuild Silver from Bronze. If the application team publishes a breaking schema, keep the raw evidence while the contract is corrected.

### 4. Build Silver around a business entity

Silver is where \`commerce.orders\` becomes a reliable entity: deduplicated on the application key, conformed timestamps and currencies, explicit null handling, and late-arrival rules that the business can understand. In a streaming design, the practical questions are not academic: what makes two order events the same record, how late can a correction arrive, and should a cancellation update yesterday's revenue?

\`\`\`sql
CREATE OR REFRESH STREAMING TABLE commerce.orders_silver
AS
SELECT
  order_id,
  customer_id,
  cast(order_timestamp AS timestamp) AS order_timestamp,
  upper(currency_code) AS currency_code,
  cast(order_total AS decimal(18, 2)) AS order_total,
  ingested_at
FROM STREAM commerce.orders_bronze
QUALIFY row_number() OVER (
  PARTITION BY order_id
  ORDER BY ingested_at DESC
) = 1;
\`\`\`

The exact deduplication implementation depends on the delivery semantics of the exporter. If it emits updates rather than append-only snapshots, model that explicitly; do not hide it behind a generic \`distinct\`.

### 5. Make Gold a small set of declared data products

Gold should answer a named consumer question: daily gross merchandise value, finance reconciliation, active subscribers, or a service-level metric. A materialized view is a sensible default when a result is derived from joins and aggregations and is queried by SQL warehouses or BI tools.

\`\`\`sql
CREATE OR REFRESH MATERIALIZED VIEW commerce.daily_revenue_gold
AS
SELECT
  date(order_timestamp) AS order_date,
  currency_code,
  sum(order_total) AS gross_revenue,
  count(*) AS order_count
FROM commerce.orders_silver
GROUP BY 1, 2;
\`\`\`

Gold is queryable through Databricks SQL and a BI tool, but it still needs ownership. Assign an owner, document the metric definition, and test an invariant that matters to finance or operations. A dashboard can be fast and still be wrong.

## Put business entities at the centre of the monorepo

Do not make the repository root a map of the Medallion layers:

\`\`\`text
# Avoid: a change to orders is split across the whole repository.
pipelines/
  bronze/orders.sql
  silver/orders.sql
  gold/orders.sql
\`\`\`

Layer semantics are still useful in the data model. They are a poor primary navigation system for a codebase that will grow to dozens of domains. An engineer changing \`orders\` has to find code in three unrelated places, coordinate a broad pull request, and remember where every shared rule lives.

Use a modular, entity-oriented layout instead. A domain can contain several related entities; each entity keeps its Bronze, Silver, Gold, quality, and schema definitions close together.

\`\`\`text
databricks-warehouse/
├── databricks.yml                 # Declarative Automation Bundle entry point
├── resources/
│   ├── pipelines.yml              # LDP resource definitions
│   ├── jobs.yml                   # Optional orchestration jobs
│   └── permissions.yml            # Grants and execution identities
├── src/
│   ├── commerce/
│   │   ├── orders/
│   │   │   ├── pipeline.sql       # Bronze -> Silver -> Gold for orders
│   │   │   ├── quality.sql        # Expectations and reconciliation queries
│   │   │   ├── schema.yml         # Source contract and ownership notes
│   │   │   └── README.md
│   │   └── customers/
│   ├── payments/
│   │   └── settlements/
│   └── shared/
│       ├── sql/                   # Small, proven reusable macros/views
│       └── python/                # Pure helpers that can be unit tested locally
├── tests/
│   ├── unit/
│   ├── fixtures/
│   └── integration/
├── conf/
│   ├── dev.yml
│   ├── staging.yml
│   └── prod.yml
└── docs/
    └── data-contracts/
\`\`\`

This is not an argument for a giant \`shared/\` library. Keep shared code small and earned. A standard currency normaliser is a good candidate; a generic framework for every table is usually a future debugging problem. The working unit is the entity module, which makes ownership, tests, documentation, and review boundaries visible.

The same principle applies to Unity Catalog names. A practical target convention is separate catalogs or schemas per environment and domain, such as \`dev_commerce.orders\`, \`staging_commerce.orders\`, and \`prod_commerce.orders\`. Bundle target overrides provide the environment-specific catalog, storage path, and service principal without making developers edit source code for every promotion.

## A SaaS platform changes the developer loop

With a local Docker warehouse, the ideal loop is often: edit locally, run the entire stack locally, then promote the same containers. Databricks is different. The runtime that evaluates LDP, accesses Unity Catalog, uses Auto Loader discovery state, and writes managed tables lives in a Databricks workspace.

Trying to reproduce every service on a laptop creates false confidence. Local development is still valuable, but its job is narrower: edit, lint, type-check, execute pure transformation tests against fixtures, and validate bundle configuration. A workspace-scoped development target verifies the platform-specific behavior.

![Databricks SaaS engineering workflow from local feature branch through validation, personal development, CI, staging, and production](/assets/images/databricks-saas-engineering-workflow.png)

### The day-to-day workflow

1. An engineer creates a feature branch and changes the affected entity module. They update the source contract and fixture data with the code, then run SQL or Python unit tests locally. This is fast feedback, not a simulation of production.

2. The branch runs bundle validation and an LDP dry run where available. These checks catch broken resource references, invalid configuration, and an invalid pipeline graph without writing business tables.

3. The engineer deploys to a personal development target in Databricks. That target has its own pipeline, catalog or schema, checkpoint area, and small representative data. This is where Auto Loader permissions, LDP expectations, streaming semantics, and Unity Catalog grants are actually exercised.

4. A pull request triggers CI. CI reruns unit and bundle checks, validates policy requirements, and reviews the generated plan or pipeline definition. The pull request should show the intended table and schema changes, not merely a successful deployment.

5. After merge, CI deploys the same versioned bundle artifact to staging and runs controlled integration and reconciliation checks. Staging should have an environment-specific source and storage path, never a shared development checkpoint.

6. A protected production promotion deploys from CI using a machine-to-machine service principal. A laptop should not hold production credentials or be able to point a convenient command at the production target.

Databricks recommends bundles for source-controlled deployment of workspace resources, and the common pattern is a personal development pipeline, then staging after merge, then production after the final promotion. The bundle is the promotion unit: source plus declarative resource configuration and environment overrides.

## The failure modes worth designing for

| Failure mode | Design response |
| --- | --- |
| A producer adds or renames a Parquet column | Track the source contract; let Auto Loader capture schema evolution state, then make semantic mapping changes in Silver through review. |
| A source export is incomplete or duplicated | Write immutable batches with an explicit delivery contract; record file metadata in Bronze and make deduplication rules explicit in the entity module. |
| A developer reuses a production checkpoint | Give every bundle target an isolated checkpoint and storage prefix. Treat checkpoint state as environment data, not source code. |
| A Gold metric changes its definition | Version the metric query, add reconciliation tests, name an owner, and communicate the cutover to the dashboard users. |
| A broad repository makes a simple table change risky | Keep all lifecycle code for an entity together. Layer names belong inside the entity module, not at the repository root. |
| A local test passes but the managed pipeline fails | Run the real LDP path against an isolated Databricks development target before review; local tests cannot exercise every managed-platform feature. |

## The design in one sentence

Use S3 as an immutable raw landing zone, Auto Loader and LDP for incremental ingestion and declared transformations, Unity Catalog for storage and table governance, and a business-entity monorepo promoted through isolated Databricks targets.

The Medallion model stays visible in the tables. It simply stops dictating how every engineer has to search through the repository.

## References

- [Load data in Lakeflow Declarative Pipelines](https://docs.databricks.com/aws/en/ldp/load)
- [Using Auto Loader with Unity Catalog](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/unity-catalog)
- [Configure schema inference and evolution in Auto Loader](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/schema)
- [Connect to an AWS S3 external location](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/s3)
- [Lakeflow Declarative Pipelines concepts](https://docs.databricks.com/gcp/en/ldp/concepts)
- [Develop Lakeflow Declarative Pipelines locally](https://docs.databricks.com/gcp/en/ldp/develop-locally)
- [Databricks CI/CD best practices](https://docs.databricks.com/aws/en/dev-tools/ci-cd)
- [Lakeflow pipeline best practices](https://docs.databricks.com/gcp/en/ldp/best-practices)
`;export{e as default};