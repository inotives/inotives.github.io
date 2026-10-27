var e=`---
title: "One Parquet ELT pipeline from a laptop to AWS with DuckDB, dlt, and dbt"
date: 2026-10-27
tags: [data-engineering, duckdb, parquet, dlt, dbt, aws]
series: data-engineering
summary: "A practical local-to-S3 ELT design: dlt lands market data, a health gate checks drift before Bronze, dbt builds Parquet Silver and Gold models through DuckDB, and an API serves only published Gold data."
---

I want the same market-data pipeline to run on my laptop and on an AWS job runner. A developer should be able to replay a batch without provisioning a warehouse, then deploy the same transformation logic against S3. DuckDB makes that possible because it can query Parquet files in both places. dlt handles ingestion; dbt owns the SQL models and their tests.

There is a naming trap here. DuckDB is the query engine, not the table format. Parquet is the file format. A directory of Parquet files can behave like a table for reads, but it does not give us transactions, a catalog, or permissions by itself. This design fits a small pipeline with one controlled publisher. If concurrent writers or cross-engine table transactions become requirements, I would evaluate a table format such as DuckLake or Iceberg instead.

![A market-data batch moves from Raw through a health gate and Parquet Bronze, Silver, and Gold layers. The same jobs use local files or S3.](/assets/images/duckdb-parquet-elt-flow.svg)

## One batch, two storage locations

Suppose an exchange API returns observations with \`symbol\`, \`observed_at\`, \`price_usd\`, and \`volume_24h_usd\`. The daily UI needs the latest price and volume per symbol. It should never have to interpret source records or decide whether a batch was healthy.

The project has one logical layout:

\`\`\`text
lake/
  raw/           dlt loads and a retained source snapshot
  quarantine/    rejected batches and check results
  bronze/        accepted, typed observations
  silver/        deduplicated observations
  gold/          versioned UI-ready files and current.json
\`\`\`

On a laptop, \`lake/\` is an absolute local path. On AWS, it is a private S3 prefix. The ingestion job, gate, and dbt models keep the same order and SQL. Storage URLs, credentials, and job scheduling change. That is a useful kind of portability; it does not mean local file operations and S3 publishing have identical failure modes.

| Concern | Laptop | AWS |
| --- | --- | --- |
| Data root | \`file:///absolute/path/lake\` | \`s3://private-bucket/lake\` |
| Compute | Python process with DuckDB and dbt | Container job with the same locked dependencies |
| Credentials | Local profile or environment | Job role scoped to the required S3 prefixes |
| Schedule | Manual run or local scheduler | EventBridge schedule to a container task, for example |

The UI is a separate service. It receives neither S3 credentials nor the DuckDB file from the pipeline job.

## Ingest into Raw with dlt

dlt's filesystem destination supports local paths and S3, with Parquet as a loader format. The source function can stay the same in both environments:

\`\`\`python
import os
import dlt
from dlt.destinations import filesystem

@dlt.resource(write_disposition="append")
def market_prices():
    for row in fetch_exchange_prices():  # your API client
        yield row

pipeline = dlt.pipeline(
    pipeline_name="market_prices",
    destination=filesystem(bucket_url=os.environ["LAKE_ROOT"]),
    dataset_name="raw",
)
pipeline.run(market_prices(), loader_file_format="parquet")
\`\`\`

Set \`LAKE_ROOT\` to the local \`file:///.../lake\` URL or the S3 URL. dlt manages its own state and schema files in that destination, so the diagram's folders are logical zones, not a promise about every object name dlt writes. Keep the original response or source file with a batch ID as well if exact replay matters: dlt's normalized Parquet output is not a byte-for-byte copy of an API response. [dlt filesystem destination](https://dlthub.com/docs/dlt-ecosystem/destinations/filesystem)

dlt coordinates extract, normalize, and load within a run. A local command or an AWS scheduler starts that run; dlt is not the clock that starts it.

Raw is durable evidence, not trusted data. A successful load says the records arrived. It says nothing about whether the producer changed the meaning of \`price_usd\`.

## Put the health gate before Bronze

The gate evaluates a complete Raw batch against a versioned contract. For this feed, it checks that required fields still exist with compatible types, \`price_usd\` is positive, timestamps parse, \`(symbol, observed_at)\` is usable as a key, and the newest observation is within the agreed freshness window. Row count and null-rate changes are checked against recent accepted batches. An unexpected new field is recorded and reviewed; a missing required field or unusable timestamp blocks promotion.

![The health gate keeps each Raw batch immutable, sends failed batches to quarantine, and promotes only accepted batches to Bronze.](/assets/images/duckdb-parquet-elt-health-gate.svg)

Each run writes a small manifest: batch ID, source URI, contract version, schema fingerprint, row count, check results, and status. A rejected batch stays in Raw, gets a quarantine record, and does not change Bronze. After the source is fixed or the contract is deliberately updated, replay that batch by ID. This is the same boundary described in [Before Bronze: Designing a Reusable Data Health Gate for Safe Ingestion](/notes/2026-10-04-data-health-gate-safe-ingestion).

Only after acceptance does DuckDB cast fields and write a new Bronze Parquet file. Keep the batch ID, source timestamp, and ingestion timestamp in the rows. Write to a new batch path rather than overwriting yesterday's accepted file; a retry can then detect an already-promoted batch instead of duplicating it. The gate's decision and the Bronze write need one controlled publisher. Plain Parquet directories have no multi-file commit to make that pair atomic.

## Transform Silver and Gold with dbt

dbt-duckdb can read Parquet and materialize models as external Parquet files. A Silver model removes repeated observations and standardizes types. Its SQL is the same when \`bronze_path\` points at a local directory or an S3 prefix:

\`\`\`sql
{{ config(
    materialized='external',
    location=var('silver_path') ~ '/market_prices.parquet'
) }}

with ranked as (
    select
        symbol,
        observed_at,
        price_usd,
        volume_24h_usd,
        row_number() over (
            partition by symbol, observed_at
            order by ingested_at desc, batch_id desc
        ) as row_number_in_batch
    from read_parquet('{{ var("bronze_path") }}/market_prices/*.parquet')
)
select symbol, observed_at, price_usd, volume_24h_usd
from ranked
where row_number_in_batch = 1
\`\`\`

Gold then selects the latest accepted observation per symbol and writes a small \`latest_market_prices.parquet\` file. dbt tests check its key is unique, the expected fields are present and non-null, and prices remain positive. DuckDB's Parquet reader and \`COPY\` support the same file format locally and over S3; S3 access uses DuckDB's \`httpfs\` and AWS credential chain. [DuckDB Parquet documentation](https://duckdb.org/docs/2.0/data/parquet/overview.html), [DuckDB S3 authentication](https://duckdb.org/docs/2.0/core_extensions/httpfs/s3api.html), [dbt-duckdb external models](https://github.com/duckdb/dbt-duckdb#writing-to-external-files)

For example, the Gold model can use \`row_number() over (partition by symbol order by observed_at desc)\` on \`{{ ref('silver_market_prices') }}\` and keep row 1. Run \`dbt build\` with \`bronze_path\`, \`silver_path\`, and the run-specific \`gold_path\` supplied as vars. On AWS the dbt profile also needs DuckDB's S3 extensions and role-based credentials; on a laptop it can use a local DuckDB working file. The model SQL does not need an AWS branch.

Do not let the UI glob a Gold directory while dbt is writing it. Materialize each run under an immutable run ID, test it, then publish a small \`current.json\` pointer to the accepted Gold file. The API reads that pointer before opening Parquet. A failed run leaves the previous accepted version serving traffic. Use one publisher for the pointer, and retain old versions long enough for active requests and rollback.

## Put permission checks in the serving layer

DuckDB is embedded in the process using it. It is not a server that authenticates each UI user and grants them row-level access. The browser must call an authenticated API. The API authorizes the user, chooses an allowed Gold dataset or applies the necessary row filter, and returns only the requested fields. It should use a read-only role scoped to the published Gold prefix. The ingestion and transformation roles can read Raw, Bronze, and Silver; the UI role cannot.

![The browser reaches Gold only through an authenticated API. Its read-only storage role is limited to published Gold; pipeline roles access the earlier layers.](/assets/images/duckdb-parquet-elt-access.svg)

That API check is the main application permission boundary. A button hidden in the browser is not access control. S3 IAM protects the underlying objects from direct reads, and the API enforces user-specific rules. If different users need different rows from the same Gold file, test that filtering at the API boundary and keep the raw S3 URL private. A leaked broad S3 credential would bypass the UI's rules.

This is the tradeoff to acknowledge before adopting the stack. DuckDB and Parquet keep the local workflow light and make cloud storage straightforward, but they do not supply warehouse-style identity, grants, row policies, and concurrent table commits. Those controls become work for the API, IAM, the publish protocol, and operations. If many teams need direct governed SQL access, use a platform with those controls instead of pretending the UI can cover every access path.

## What I would ship first

Start with one feed and one daily Gold file. Prove that a malformed batch remains in quarantine, a dbt test failure leaves \`current.json\` unchanged, and an unauthorized API request cannot read Gold. Run that exact sequence against a local fixture and a private S3 test prefix. Only then add more feeds or a richer catalog.

The useful result is a pipeline whose transformations travel with the code. The trust and publication boundaries need just as much attention as the SQL.

## References

- [dlt filesystem destination and file formats](https://dlthub.com/docs/dlt-ecosystem/destinations/filesystem)
- [DuckDB: reading and writing Parquet](https://duckdb.org/docs/2.0/data/parquet/overview.html)
- [DuckDB: S3 API and credential chain](https://duckdb.org/docs/2.0/core_extensions/httpfs/s3api.html)
- [dbt-duckdb: external files and models](https://github.com/duckdb/dbt-duckdb#reading-and-writing-external-files)
- [DuckDB security model](https://duckdb.org/security)
- [DuckLake, Delta Lake, or Iceberg for S3?](/notes/2026-10-02-s3-table-formats-ducklake-delta-iceberg)
`;export{e as default};