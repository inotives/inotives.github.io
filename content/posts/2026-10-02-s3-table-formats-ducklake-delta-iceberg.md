---
title: "DuckLake, Delta Lake, or Iceberg for S3?"
date: 2026-10-02
tags: [ducklake, delta-lake, iceberg, s3, data-engineering]
summary: "A practical comparison of DuckLake, Delta Lake, and Apache Iceberg: how their metadata works, what they cost to operate, how engines open them, and where database, table, row, and column permissions actually live."
series: building-ai-systems
---

Parquet files in S3 do not make a table. They are just files until something records which files belong to the current version, which schema to use, and what changed during a write. DuckLake, Delta Lake, and Iceberg each provide that table layer.

They solve a similar problem with different metadata layouts and ecosystems. None of the three, by itself, is a complete identity or permission system. That distinction matters as much as the file format when more than one team or query engine will use the data.

![DuckLake, Delta Lake, and Iceberg organize table metadata differently above Parquet objects in S3. Catalogs, query engines, and AWS controls provide authorization.](/assets/images/s3-table-formats-structure.svg)

## First separate the format from the rest of the stack

A table format describes how to find a table's current data and interpret changes. A catalog maps names such as `analytics.market_data` to table metadata. A query engine reads and writes the table. Cloud storage holds the Parquet and metadata objects.

Those pieces can be one managed service or several separate systems. The diagram below shows where access checks tend to live. If a user can read the raw S3 objects directly, a row filter enforced only by a query engine cannot protect those objects.

![Identity, catalog grants, query-time filters, and S3 permissions work at separate layers. Direct object access can bypass query-time row and column rules.](/assets/images/s3-table-formats-rbac.svg)

## What each format writes

| Format | Where table state lives | What the S3 layout looks like | Main tradeoff |
| --- | --- | --- | --- |
| DuckLake | A SQL metadata catalog, separate from the data files | Parquet files under the table data path; catalog rows track schemas, snapshots, and files | A compact SQL-first design, with a younger and more DuckDB-centered client ecosystem |
| Delta Lake | A transaction log alongside the table data | `_delta_log/` JSON commits and checkpoints, plus Parquet data files | Strong Spark and Databricks fit; writers must use a compatible commit mechanism for the storage system |
| Apache Iceberg | Catalog pointer plus metadata files and manifests | Metadata JSON → manifest lists → Avro manifests → Parquet data and delete files | Broad engine choice and explicit snapshot metadata, with more catalog and metadata maintenance to plan |

### DuckLake

DuckLake separates a SQL metadata catalog from the columnar data files. The catalog tracks table definitions and snapshots; Parquet files live at a data path that can point to S3. A local DuckDB file is the simplest catalog. For shared use, the project documents SQL catalogs such as PostgreSQL, and managed services can host the catalog for you. DuckDB's `ducklake` extension is the reference implementation; the documentation lists other clients at different maturity levels. [DuckLake documentation](https://ducklake.select/docs/stable/), [DuckLake access-control guide](https://ducklake.select/docs/stable/duckdb/guides/access_control.html)

That split keeps the data in ordinary files while moving the table's current state into a database. It can make DuckLake straightforward in a DuckDB-first stack. The flip side is that the catalog is a real dependency: it needs a backup, a connection path, and an access policy of its own. A local metadata file is useful for a demo; it is not a shared catalog design for multiple independent writers.

MotherDuck offers a managed DuckLake catalog with either MotherDuck-managed storage or a customer S3 bucket. Its current BYOB documentation has bucket-region and secret setup requirements, so check those against your organization before choosing that route. [MotherDuck DuckLake integration](https://motherduck.com/docs/integrations/file-formats/ducklake/)

### Delta Lake

Delta Lake keeps an ordered transaction log in `_delta_log/`. Each commit records changes such as adding or removing data files and updating the schema. Checkpoint files let readers reconstruct table state without replaying every JSON commit. The directory also contains the Parquet data files referenced by the log. The Delta protocol records reader and writer feature requirements, so a client that does not understand a table's enabled features should not be treated as a compatible reader or writer. [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md), [Delta Lake version compatibility](https://docs.delta.io/versioning/)

Delta is a natural fit when Spark or Databricks is already the center of the data platform. The operational detail to get right on S3 is concurrent commit handling. Delta's documentation describes single-cluster writes as the default mode and a separate multi-cluster configuration with extra coordination requirements. That choice belongs in the design before two independent jobs write the same table. [Delta storage configuration](https://docs.delta.io/delta-storage/)

### Apache Iceberg

Iceberg stores snapshots and table schemas in metadata JSON. A snapshot points to manifest lists; those list files point to manifests, which describe data and delete files with partition values and statistics. A catalog holds the current metadata location, so a reader can load one consistent snapshot while a writer commits a newer one. The specification describes atomic metadata replacement and snapshot isolation. [Apache Iceberg specification](https://iceberg.apache.org/spec/)

Iceberg's catalog boundary gives different engines a shared table name and a consistent way to find the current snapshot. That flexibility is useful across Spark, Flink, Trino, and other supported engines. It also means you must select and operate a catalog, and check that every engine supports the Iceberg features your tables use. The metadata and manifests need maintenance too; a large number of small files or stale snapshots can make planning and storage less efficient.

## How the cost shows up

There is no universal cheapest format. The table format does not set S3's storage and request rates, and the full bill includes compute, catalog service, data transfer, and housekeeping. Compare the amount you store and scan, the number of objects and metadata requests, and who runs compaction and snapshot cleanup. AWS lists the storage and request components in its [S3 pricing](https://aws.amazon.com/s3/pricing/) documentation.

| Cost driver | DuckLake | Delta Lake | Iceberg |
| --- | --- | --- | --- |
| Metadata service | SQL catalog capacity and backups; a managed catalog shifts that work into a service plan | Log and checkpoint objects in S3; some multi-cluster write modes add a coordination service | Catalog API calls plus metadata JSON, manifests, and manifest lists |
| S3 footprint | Data files and retained snapshots; rewrites and cleanup still matter | Data files, log/checkpoint history, and any retained versions | Data and delete files plus retained snapshots and manifests |
| Write coordination | Depends on the selected shared catalog and client | Requires a compatible LogStore/commit mode; S3 multi-cluster writes need extra setup | Depends on the catalog's atomic commit support and engine integration |
| Housekeeping | Expire old snapshots and compact small files when the workload needs it | Compact small files and vacuum obsolete files with retention rules | Expire snapshots, remove orphan files, and rewrite data or manifests as needed |

The largest avoidable cost in all three is often a bad file layout: many tiny objects raise request and planning overhead, while oversized files can make pruning less useful. Compaction costs compute and rewrites bytes, so tune it to query patterns and retention needs instead of running it on a fixed schedule by habit.

## How you open a table

Use an engine that understands the format and its catalog. Do not point a generic Parquet reader at a table folder and assume it will see the same current rows. Updates and deletes may be represented by metadata or delete files rather than by editing each Parquet object in place.

For a local DuckDB demonstration, DuckLake can attach a metadata file and an S3 data path:

```sql
INSTALL ducklake;
LOAD ducklake;

ATTACH 'ducklake:metadata.ducklake' AS lake
  (DATA_PATH 's3://example-bucket/warehouse/market_data/');

SELECT * FROM lake.main.market_data LIMIT 5;
```

Configure DuckDB's S3 credentials before querying. This local catalog example shows the format; shared workloads should attach through a shared catalog such as a supported SQL catalog or a managed service. [DuckLake with DuckDB](https://ducklake.select/docs/stable/duckdb/introduction.html)

Delta readers use the transaction log, for example with Spark:

```python
market_data = spark.read.format("delta").load(
    "s3a://example-bucket/warehouse/market_data"
)
```

The Spark session needs a compatible Delta library and S3 commit configuration. A managed catalog can provide a stable table name instead of a path. [Delta Lake storage configuration](https://docs.delta.io/delta-storage/)

Iceberg is normally addressed through its catalog rather than a bare S3 path:

```sql
SELECT *
FROM glue_catalog.analytics.market_data
LIMIT 5;
```

The Spark or Athena environment must be configured for that catalog and must have access to the registered S3 location. A different catalog changes the identifier and setup, not the general pattern. [Iceberg catalog configuration](https://iceberg.apache.org/docs/latest/catalog-properties/)

## What RBAC each one gives you

The formats do not define users, database grants, row policies, or column masks. A catalog or service usually handles object discovery and table-level grants. A query engine can filter rows or mask columns at read time. IAM or credential vending controls the actual S3 objects. These controls must agree.

| Permission scope | DuckLake | Delta Lake | Iceberg |
| --- | --- | --- | --- |
| Database, namespace, schema | Use the catalog's own grants. DuckLake documents schema access through SQL catalog permissions. | Use the catalog's grants, such as Unity Catalog catalog and schema privileges. | Use the catalog's namespace and database grants, such as AWS Glue/Lake Formation permissions. |
| Table | Catalog grants can provide table-level access; S3 permissions must still protect the files. | Catalog grants can provide table-level `SELECT` and modification permissions. | Catalog grants can provide table-level access; S3 permissions must still protect the files. |
| Row | No row policy in the format; enforce it in an engine or view. | Unity Catalog supports row filters for supported tables. | No row policy in the format; an integrated service such as Lake Formation can filter query results. |
| Column | No column mask in the format; enforce it in an engine or view. | Unity Catalog supports column masks for supported tables. | No column mask in the format; Lake Formation data filters can restrict columns for integrated services. |

Those are stack examples, not guarantees of the file format. Databricks documents catalog/schema/table privileges along with Unity Catalog row filters and column masks. AWS Lake Formation documents database and table grants and row, column, and cell filters for integrated analytical services. Its open-table-format tutorial has separate integration steps for Iceberg and Delta Lake, so verify the exact engine and table path you plan to use. [Unity Catalog privileges](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/privileges-reference), [Unity Catalog row filters and column masks](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/), [Lake Formation data filtering](https://docs.aws.amazon.com/lake-formation/latest/dg/data-filtering.html), [Lake Formation open table formats](https://docs.aws.amazon.com/lake-formation/latest/dg/otf-tutorial.html)

For the MotherDuck side of this series, organization roles and data shares are platform controls around the catalog. The current MotherDuck table-level Share filter exposes selected tables and views, but the docs say it is not supported for Shares of DuckLake or Iceberg databases. That filter also selects whole tables or views; it does not implement row filters or column masks. [MotherDuck security model](https://motherduck.com/docs/concepts/security/), [MotherDuck table-level Share security](https://motherduck.com/docs/key-tasks/sharing-data/table-level-security/)

One rule holds across all three: if a user can fetch the Parquet files directly from S3, query-time row or column rules can be bypassed. Keep the bucket private, restrict principals to the right prefixes, and use a service such as Lake Formation credential vending when the engine's policies must govern S3 access.

## Which one fits this market-data project?

For the current DuckDB and MotherDuck pipeline, I would start with DuckLake. It keeps the query path close to the code we already have and can put the data files in our S3 bucket. I would keep the original landing Parquet immutable and use a separate DuckLake prefix for modeled tables.

That choice assumes the project is happy to stay DuckDB/MotherDuck-centered and to manage access through that catalog and its storage credentials. If several engines need to share the same tables, evaluate Iceberg first and test the actual catalog/engine combinations. If the platform is already Spark and Databricks, Delta Lake with Unity Catalog is likely the least disruptive path. For any option, settle row and column policy requirements before loading sensitive fields; a table format will not supply those controls on its own.

## References

- [DuckLake documentation](https://ducklake.select/docs/stable/)
- [DuckLake access-control guide](https://ducklake.select/docs/stable/duckdb/guides/access_control.html)
- [MotherDuck DuckLake integration and BYOB](https://motherduck.com/docs/integrations/file-formats/ducklake/)
- [MotherDuck security model](https://motherduck.com/docs/concepts/security/)
- [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)
- [Delta Lake version compatibility](https://docs.delta.io/versioning/)
- [Delta Lake storage configuration](https://docs.delta.io/delta-storage/)
- [Apache Iceberg specification](https://iceberg.apache.org/spec/)
- [Apache Iceberg catalog configuration](https://iceberg.apache.org/docs/latest/catalog-properties/)
- [Unity Catalog privileges](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/privileges-reference)
- [Unity Catalog row filters and column masks](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/)
- [Lake Formation data filtering](https://docs.aws.amazon.com/lake-formation/latest/dg/data-filtering.html)
- [Lake Formation support for open table formats](https://docs.aws.amazon.com/lake-formation/latest/dg/otf-tutorial.html)
- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/)
