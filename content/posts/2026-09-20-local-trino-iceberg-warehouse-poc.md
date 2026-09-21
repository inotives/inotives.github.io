---
title: "Building a local Trino and Iceberg warehouse POC with Docker"
date: 2026-09-20
tags: [data-engineering, trino, apache-iceberg, dbt, prefect, docker]
series: data-engineering
summary: "A practical design for a local Docker POC using Trino, Apache Polaris, Iceberg, Prefect, dbt, Prometheus, and Lightdash. The goal is not laptop-scale performance; it is a repeatable engineering workflow that carries the same contracts from local development to dev and production."
---

I am designing a local data-warehouse proof of concept around Trino, Apache Iceberg, Apache Polaris, Prefect, dbt, Prometheus, and Lightdash. The point is not to prove that a MacBook can behave like a production cluster. It cannot. The point is to make the engineering workflow boringly repeatable: the same data contracts, table format, catalog protocol, transformation project, tests, and operational signals should work locally before they are deployed to dev or production.

That is where Docker earns its place. It gives the team a disposable environment where a new engineer can recreate the important system boundaries with one command, test changes against real services, and discard a broken warehouse without a cloud cleanup exercise.

![The local warehouse POC separates data flow, control flow, Iceberg catalog metadata, and monitoring across Prefect, Trino, Polaris, dbt, Lightdash, and Prometheus.](/assets/images/local-trino-iceberg-warehouse-poc.png)

## The POC in one sentence

Application services land immutable Parquet files in S3-compatible object storage. A Prefect flow validates and loads those files into Bronze Iceberg tables, using Trino for SQL execution and Polaris as the Iceberg REST catalog. dbt then builds Silver and Gold models through the same Trino endpoint. Lightdash queries Gold through Trino, while Prometheus collects health, throughput, freshness, and failure signals from the platform.

There are four separate concerns in that sentence. Keeping them separate is the whole design.

| Concern | Component | Responsibility |
| --- | --- | --- |
| Object storage | S3 in deployed environments; an S3-compatible service locally | Hold raw Parquet and Iceberg data files. |
| Table metadata and governance | Apache Polaris | Manage Iceberg catalog metadata, namespaces, access, and table commits through the REST catalog protocol. |
| SQL execution | Trino or a Starburst distribution | Read and write Iceberg tables, run dbt SQL, and serve BI queries. |
| Workflow control | Prefect | Decide when work runs, record state, retry failures, and orchestrate ingestion and transformation steps. |

Polaris is not a database and Trino is not a durable data store. Trino executes queries. Iceberg table files and metadata live in object storage. Polaris tracks the current table metadata and coordinates catalog operations. That distinction prevents a lot of confusing diagrams and broken assumptions later.

## Why build this locally first

The POC should answer engineering questions before cloud infrastructure makes them expensive:

- Can Trino, dbt, and Lightdash all see the same Gold table through the same catalog and SQL endpoint?
- Does the ingestion logic correctly handle duplicate file delivery, late partitions, schema changes, and a failed run halfway through?
- Can a developer modify a dbt model, run tests, inspect the Iceberg result, and verify the BI semantic model without waiting for shared infrastructure?
- Are the component contracts portable enough that dev and production need different credentials and endpoints, rather than different code paths?
- Do alerts fire for stale data and failed workflows, not merely for a container that is running?

The local stack is a contract test for the platform. It should resemble production in interfaces and failure behavior, not in node count or query throughput.

## The data flow, accurately separated

The pipeline has a data path, a control path, a metadata path, and an observability path. Blending them together makes troubleshooting unnecessarily hard.

### Data path

1. An application writes an immutable Parquet object to a landing prefix, such as `s3://landing/orders/load_date=2026-09-20/part-0001.parquet`.
2. The ingestion step reads that file and writes records into a Bronze Iceberg table. The original Parquet object stays unchanged.
3. dbt runs SQL transformations through Trino, producing Silver and Gold Iceberg tables or views.
4. Lightdash connects to Trino and reads the approved Gold models.

### Control path

Prefect owns the sequence. A flow can poll a landing prefix locally, consume an event in a deployed environment, or run on a schedule. It validates the input manifest, records the load identity, triggers the ingest task, waits for dbt tests, and only publishes the dataset as ready when the required checks pass.

### Metadata path

Trino uses its Iceberg connector with a REST catalog configuration. Apache Polaris implements the Iceberg REST catalog protocol, so Trino asks Polaris for table metadata and commits changes through that API. Polaris points the table at its object-storage location; the data files do not travel through Polaris.

### Observability path

Prometheus scrapes metric endpoints or exporters. Prefect flow state, Trino query health, container availability, and data-freshness measurements should become metrics or alerts. Prometheus does not replace logs, data-quality tests, or a workflow UI. It gives the operations layer a time-series view of whether the platform is healthy.

## A Docker Compose boundary that survives promotion

The Compose file should start services, not become the only place where architecture is defined. Keep configuration and business logic in versioned projects that can be deployed by another mechanism later.

```text
warehouse-poc/
  compose.yaml
  .env.example
  config/
    trino/catalog/iceberg.properties
    polaris/
    prometheus/prometheus.yml
    alertmanager/
  ingest/
    flows/
    tests/
    Dockerfile
  dbt/
    models/bronze/
    models/silver/
    models/gold/
    tests/
    dbt_project.yml
  lightdash/
  contracts/
    application-events.json
    load-manifest.schema.json
  scripts/
    seed-data.sh
    smoke-test.sh
```

The exact container images and version pins will change. The durable interface should not:

- object storage always exposes an S3-compatible API;
- Iceberg clients always use a REST catalog endpoint;
- dbt always targets Trino through environment-specific connection settings;
- ingestion and dbt images are built once, then run locally or by the chosen deployment runtime;
- secrets arrive through environment injection or a secret manager, never through a committed `profiles.yml`.

For local work, an S3-compatible service such as MinIO is a practical substitute for AWS S3. Preserve the bucket layout and URI conventions, but expect only the endpoint, credentials, and IAM implementation to change in AWS. That is useful parity. Copying production account IDs or long-lived credentials into Docker is not.

## Ingestion is where the POC becomes real

“Parquet landed in S3” is not yet a warehouse load. The flow needs an explicit intake contract.

At minimum, each file or batch should have a stable load identifier, producer, schema version, event-time range, row count if available, object checksum, and arrival timestamp. A manifest can accompany the files or live in a small operational store. The POC does not need a complex control-plane database on day one, but it does need to answer a simple question: has this exact load already been committed to Bronze?

```yaml
load_id: orders-2026-09-20T091500Z-7f31
source: checkout-api
schema_version: 3
object_uri: s3://landing/orders/load_date=2026-09-20/part-0001.parquet
sha256: "..."
event_time_start: 2026-09-20T09:00:00Z
event_time_end: 2026-09-20T09:15:00Z
```

The Prefect flow should:

1. Discover a candidate file or manifest.
2. Validate its schema, expected partition, and checksum.
3. Check whether `load_id` was already applied.
4. Materialize the Bronze Iceberg write.
5. Record the committed Iceberg snapshot ID and load result.
6. Run the selected dbt models and tests.
7. Emit metrics and publish a readiness event only after success.

There is one implementation choice to make early: how raw Parquet becomes Bronze Iceberg. dbt is not an ingestion tool. The flow can use a dedicated ingestion library such as PyIceberg, or it can use Trino SQL to read a staging representation and write to Iceberg. If Trino performs the write, the project needs a defined staging connector or table mechanism for the raw files. Pick one and test it; do not leave “ingest” as an implied arrow between two containers.

## Trino and Polaris: the interoperability seam

Apache Iceberg separates data files from table metadata. The REST catalog protocol exists so engines can speak one common catalog API instead of implementing a different client for every catalog vendor. Polaris is an Iceberg catalog implementation that uses that protocol and can centrally manage catalog objects and access across compatible engines.

For this POC, Trino's Iceberg catalog should point to Polaris with the REST catalog type and URI. The conceptual shape looks like this:

```properties
connector.name=iceberg
iceberg.catalog.type=rest
iceberg.rest-catalog.uri=${POLARIS_REST_URI}
iceberg.rest-catalog.warehouse=${ICEBERG_WAREHOUSE}
```

The real configuration also needs object-storage access, authentication, and a clear warehouse location. Keep those environment values outside the catalog file where possible.

This seam is what makes Polaris worth testing. A table written by Trino is still an Iceberg table with metadata in object storage, addressed through a standard REST catalog. Later, another compatible engine can be evaluated without first rebuilding the table estate around a proprietary metastore.

That does not mean every engine behaves identically. Test writes, schema evolution, views, concurrent commits, and access-control behavior with the versions you plan to deploy. A local POC is the right place to find connector gaps.

## dbt owns the semantic transformation layers

The Bronze → Silver → Gold shape gives the team a clean place for each concern:

| Layer | Purpose | Typical rules |
| --- | --- | --- |
| Bronze | Faithful, queryable landing in Iceberg | Preserve source columns, load ID, ingest timestamp, source filename, and minimal normalization. |
| Silver | Cleaned and conformed business records | Deduplicate, validate types, apply schema evolution rules, join reference data, and quarantine bad records. |
| Gold | Stable analytics products | Business metrics, dimensions, aggregate models, ownership, documentation, and access boundaries. |

dbt runs these transformations through the `dbt-trino` adapter. It sends SQL to Trino; Trino executes the queries and materializes the Iceberg results. The adapter does not move source data by itself, which is why Prefect and the ingestion boundary remain necessary.

For a POC, start with one narrow business flow, perhaps orders and payments. Define a Bronze source table, one deduplicated Silver fact table, one Gold daily-revenue model, and a few dbt tests. Add a late-arriving event and a duplicate file to the fixture set. If the stack cannot explain those cases, adding more source systems will only hide the problem.

## BI should read Gold through the same query plane

Lightdash should connect to Trino, not directly to Parquet or a private copy of the data. That keeps BI on the same access path as development and makes query behavior visible in one place.

Lightdash is most valuable when it reads the dbt project metadata and treats Gold models as governed analytics assets rather than loose tables. Give every Gold model an owner, a description, a grain, and a freshness expectation. A dashboard can then be tested as part of the data product, not as a spreadsheet someone happens to maintain.

Keep heavy exploratory queries away from the same resource limits used by ingestion. Even in Docker, create separate Trino users, query groups, or resource assumptions early. The local POC will not model production concurrency, but it can expose accidental coupling between a BI query and a pipeline run.

## Monitoring: start with data symptoms, not container uptime

Prometheus can scrape services and exporters, but a green container is weak evidence that a warehouse is serving correct data. The first useful alerts should include both platform and data signals:

| Signal | Example alert | Why it matters |
| --- | --- | --- |
| Ingestion freshness | No successful `orders` load within its expected window | A dashboard can be healthy but stale. |
| Flow failure | Prefect flow run failed or exhausted retries | The task owner needs an actionable failure. |
| dbt tests | A critical Gold model test failed | Bad data must not be silently published. |
| Trino health | Coordinator unreachable, query failures spike, queued work rises | The SQL execution plane is unavailable or saturated. |
| Polaris health | Catalog endpoint is unavailable or metadata commit failures rise | Engines cannot reliably find or commit tables. |
| Object storage | Write failures, permission errors, or capacity threshold | Iceberg cannot create data or metadata files. |

Prometheus needs explicit metrics sources. Some services expose metrics directly; others need an exporter, JMX integration, a small flow metric endpoint, or a bridge into the organization's existing observability system. Make that visible in Compose rather than drawing a line to Prometheus and assuming it knows what to scrape.

## Local parity has limits on a Mac

Docker Desktop on macOS is a virtualized Linux environment. The POC can reproduce container images, environment variables, service DNS names, ports, object-storage semantics, and protocol-level integrations. It cannot reproduce a multi-worker Trino cluster, cloud-network latency, IAM behavior, S3 request characteristics, or production query concurrency.

That is fine if the success criteria are honest:

- a fresh clone can start the stack and load fixture data;
- the same ingestion and dbt images run locally and in dev;
- table contracts, catalog configuration shape, and data tests travel unchanged;
- a failed load is visible and retryable;
- a developer can trace a Gold number back to a Bronze load and Iceberg snapshot;
- production-only differences are explicit configuration values, not forks in the codebase.

Watch image architecture carefully on Apple Silicon. Pin images that support `linux/arm64`, document any required emulation, and give Docker Desktop enough memory for Trino, Polaris, Prefect, Lightdash, and the supporting databases. A stack that technically starts but swaps constantly is not a useful developer experience.

## A practical rollout order

Build this POC in vertical slices instead of bringing up nine containers and calling it done.

1. Start object storage, Polaris, and Trino. Create one Iceberg table and prove that Trino can write then read it.
2. Add a Prefect flow that processes one versioned Parquet fixture exactly once. Capture the resulting snapshot ID.
3. Add dbt Bronze, Silver, and Gold models with a small set of freshness and uniqueness tests.
4. Connect Lightdash to a Gold model and validate a known metric against the fixture data.
5. Add Prometheus plus one service-health metric and one data-freshness metric. Trigger a deliberate failed load and confirm the alert path.
6. Package the flow and dbt runner as images. Deploy the same images to dev with configuration supplied by the target environment.

The final result is more useful than a local demo. It is a developer contract for the warehouse: raw data enters in a known form, Iceberg tables are the durable product, dbt defines business meaning, and every transformation is observable before users make decisions from it.

## References

- [Apache Iceberg REST Catalog specification](https://iceberg.apache.org/rest-catalog-spec/)
- [Apache Polaris documentation](https://polaris.apache.org/releases/1.7.0/)
- [Trino Iceberg REST catalog configuration](https://trino.io/docs/current/object-storage/metastores.html)
- [Prefect self-hosted Docker Compose guide](https://github.com/PrefectHQ/prefect/blob/main/docs/v3/how-to-guides/self-hosted/docker-compose.mdx)
- [dbt-trino adapter](https://github.com/starburstdata/dbt-trino)
- [Lightdash metrics in dbt project YAML](https://docs.lightdash.com/get-started/setup-lightdash/how-to-create-metrics)
- [Prometheus exporters and integrations](https://prometheus.io/docs/instrumenting/exporters/)
