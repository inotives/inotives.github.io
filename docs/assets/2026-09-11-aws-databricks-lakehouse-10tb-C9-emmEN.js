var e=`---
title: "Building an AWS and Databricks Lakehouse for 10 TB of Data"
date: 2026-09-11
tags: [data-engineering, aws, databricks, lakehouse, delta-lake, cost-optimization]
series: data-engineering
summary: "A practical AWS and Databricks lakehouse design for a 10 TB operational dataset: S3 landing, Auto Loader, Delta Lake, Unity Catalog, Lakeflow, SQL serving, and a cost model whose assumptions are explicit enough to change."
---

Databricks on AWS is most useful when the problem is larger than moving CSV files into dashboards. You have a source system that keeps changing, data consumers who need reliable tables, and enough history that rebuilds and governance matter. The platform can remove a lot of glue code, but only if the AWS account and the lakehouse boundaries are simple.

This is a reference design for a 10 TB data estate. Think of an Oracle or Postgres application database exported as Parquet snapshots plus daily CDC files, although the same pattern works for exchange trades, blockchain events, CRM history, or product telemetry. The goal is a dependable analytics platform, not a maximal collection of services.

## The stack: AWS owns the account boundary; Databricks owns the data workflow

The dividing line is straightforward:

| Layer | Service | Responsibility |
| --- | --- | --- |
| Landing and durable storage | Amazon S3 | Receive source exports, retain Delta files, apply lifecycle rules |
| Compute and data format | Databricks with Delta Lake | Ingest, transform, optimise, and query tables |
| Incremental ingestion | Auto Loader | Detect new files and record ingestion progress |
| Orchestration | Lakeflow Jobs and pipelines | Schedule dependencies, retries, and operational runs |
| Governance | Unity Catalog | Catalogs, grants, lineage, auditability, row/column controls |
| Consumption | Databricks SQL warehouse and AI/BI dashboards | Serve analysts and operational reporting |
| AWS plumbing | IAM, VPC endpoints, KMS, SQS, CloudWatch | Limit access, encrypt, deliver file events, and observe failures |

There is no separate Airflow cluster, Spark cluster manager, Hive metastore, or self-hosted notebook service in this version. Those can be valid additions, but each creates another thing to patch and operate. Start with the managed path. Add an external orchestrator only when it must coordinate systems that Databricks cannot own.

## A practical data path

Create one raw landing bucket and one governed storage location for managed Delta tables. Do not point analysts at the landing bucket.

\`\`\`text
Source database / application events
  -> Parquet snapshots + CDC files
  -> S3 raw landing prefix
  -> S3 event notification + SQS
  -> Auto Loader
  -> Bronze Delta tables (append-only evidence)
  -> Silver Delta tables (typed, deduplicated, reconciled)
  -> Gold Delta tables (business metrics and serving models)
  -> Serverless SQL warehouse / dashboards / approved APIs
\`\`\`

For a crypto example, Bronze keeps the provider payload, block height, ingestion timestamp, and source file identity. Silver resolves chain, contract, token decimal, and reorganisation handling. Gold holds daily protocol volume, treasury balances, or customer-facing portfolio metrics. An analyst should never have to reconstruct those rules from a raw JSON field at query time.

Bronze is deliberately boring. Append every file, carry the source metadata, and make reprocessing possible. Silver is where the team establishes keys, late-arriving rules, data-quality expectations, and CDC merge semantics. Gold is a contract for a dashboard, finance report, or downstream application. Keeping those responsibilities separate makes failures local: a bad new source field should stop a Silver expectation instead of quietly corrupting an executive KPI.

Auto Loader fits this boundary well because it incrementally discovers arriving cloud files and supports schema evolution. On AWS, use file notifications for a sustained workload rather than repeatedly listing a large prefix. Pair it with SQS and alert on queue age or backlog; an empty Databricks job history does not prove that files are arriving.

## AWS setup that is worth doing early

The infrastructure is small, but it needs clear ownership.

**S3 layout and lifecycle.** Keep \`raw/\`, \`checkpoints/\`, and governed table storage separate. A 7- to 30-day retention policy on raw source files is often enough after Bronze has been reconciled, but do not make it shorter than the time needed to investigate a source incident. Move long-lived raw evidence and old extracts to an archival class only after confirming retrieval requirements.

**Identity.** Give Databricks storage credentials access only to the expected bucket prefixes and KMS keys. Use Unity Catalog external locations rather than embedding cloud credentials in notebooks. Human access belongs in Unity Catalog groups, not IAM keys pasted into SQL scripts.

**Network.** Use private connectivity where company policy or source systems require it. NAT gateways and cross-AZ traffic can become a surprisingly visible line item, so measure them before treating every workload as a private-network problem. The first architecture decision should be the data path, including where the source exports, Databricks workspace, S3 bucket, and consumers run.

**Observability.** Capture job run status, input files, rows written, expectation failures, queue backlog, and query spend. CloudWatch is sufficient to begin. Datadog can be useful where it already operates across the business, but its log volume needs a budget and filters. Shipping every successful Spark executor log is a fast way to create an observability bill with little operational value.

## The operating model

Use jobs compute for scheduled ingestion and transformations. It starts for a run and terminates afterwards, which is a better default than leaving an all-purpose cluster available because somebody might need it. Put exploratory notebooks in a separate workspace policy with shorter auto-termination and a restricted instance menu.

For a daily batch, a Lakeflow workflow might be:

1. Wait for the expected source manifest or a minimum file count.
2. Ingest new files to Bronze and persist the file identifier.
3. Apply Silver CDC merges and quality expectations.
4. Build the affected Gold tables.
5. Compare source, Bronze, Silver, and Gold control totals.
6. Refresh the dashboard only when the control totals pass.

Retries should be safe by construction. File ingestion needs a durable checkpoint. Merge keys need to be stable. A rerun of a Gold model should replace the intended partition or use a deterministic merge, not add a second copy of yesterday's revenue. This is where Delta tables earn their keep: transactions and table history make a controlled rollback possible, but they do not replace idempotent pipeline design.

## What 10 TB actually means for storage

Ten terabytes of source data is not automatically ten terabytes on the bill. Parquet compression can lower the stored size, while Bronze, Silver, Gold, table history, temporary compaction files, and retained landing files increase it. The only honest estimate states its retention model.

This model assumes 10 TiB of active logical data and a 2.5x physical S3 footprint. That is 25 TiB, or 25,600 GiB, across active Delta layers and retained versions. At an assumed S3 Standard price of $0.023 per GiB-month in US East (N. Virginia), storage is:

\`\`\`text
25,600 GiB x $0.023 = $588.80 per month
\`\`\`

The raw S3 line by itself is only about $235.52 per month at 10 TiB. The 2.5x planning multiplier is the more useful number during design. Replace it with measured S3 Storage Lens or billing data after the first month. A table that keeps 30 days of Delta history and a raw landing copy has a different footprint from one that retains only current Gold outputs.

## A transparent monthly cost model

The following is a planning example, not a Databricks quote. Prices vary by AWS region, Databricks edition and contract, node family, serverless availability, data transfer, and how long jobs actually run. It excludes tax, support plans, and outbound internet egress.

Assumptions:

- Region: \`us-east-1\`.
- Data: 10 TiB active logical data; 2.5x physical S3 footprint.
- Transformation cluster: one driver plus two workers, equivalent to three \`r6i.2xlarge\` nodes, four hours a day for 30 days.
- EC2 planning rate: $0.504 per node-hour.
- Jobs consumption: 2 DBUs per node-hour at an assumed $0.30 per DBU. Use your Databricks price list in the final calculator.
- SQL: a small serverless warehouse, two DBUs per hour for 60 hours a month at an assumed $0.35 per DBU-hour.
- Platform overhead: $75 for SQS, CloudWatch, KMS, S3 requests, and a modest allowance for network services.

| Cost area | Calculation | Monthly estimate |
| --- | --- | ---: |
| S3 storage | 25,600 GiB x $0.023 | $589 |
| AWS job compute | 3 nodes x 120 hours x $0.504 | $181 |
| Databricks jobs DBUs | 3 nodes x 120 hours x 2 DBUs x $0.30 | $216 |
| SQL warehouse DBUs | 2 DBUs x 60 hours x $0.35 | $42 |
| AWS request, security, and monitoring allowance | Assumption | $75 |
| **Core platform total** |  | **$1,103/month** |
| Optional external observability | Example allowance for filtered Datadog telemetry | **+$150/month** |
| **Planning total with external observability** |  | **about $1,250/month** |

The estimates are deliberately formula-based. If daily jobs run eight hours instead of four, both the EC2 and job-DBU lines double. If an analyst leaves a warehouse active for 240 hours rather than 60, the SQL line becomes $168 under the same assumed rate. Storage is fairly predictable; unbounded compute is usually the real cost risk.

For a one-time initial 10 TiB migration, reserve $250 to $500 for a short-lived, larger jobs cluster, DBUs, S3 requests, validation reruns, and a safety margin. Do a representative 250 GiB migration first, record elapsed time and DBU consumption, then scale the estimate. A 100 TB migration is not simply ten times the 10 TB price if source export throughput, file counts, or data skew become bottlenecks.

## Controls that keep the estimate true

Cost controls need to be part of the pipeline, not a quarterly spreadsheet review.

- Enforce a cluster policy that selects jobs compute and caps the largest instance family.
- Set SQL warehouse auto-stop to ten minutes, then review actual restart friction with the users.
- Tag jobs, warehouses, and storage prefixes by product or data domain so a team can own its spend.
- Alert on daily DBU consumption, S3 growth, NAT gateway processing, SQS age, and failed quality expectations.
- Compact small files during a scheduled maintenance window. Hundreds of thousands of tiny Parquet files cost more in listing, task scheduling, and query latency than their storage size suggests.
- Make the retention period a table-level decision. Gold metrics often need less historical file retention than raw evidence and Silver CDC tables.

## When this design is the wrong fit

Do not choose Databricks merely because the source has 10 TB. A small, stable reporting dataset with a few models may be cheaper and easier in an AWS-native warehouse and dbt. Databricks earns the operational cost when you need incremental ingestion, changing schemas, large Spark transformations, shared notebooks and SQL, governed access to the same tables, or a path from analytics into ML and agent workloads.

For the teams that do need those capabilities, the sensible first deployment is not a sprawling multi-tool platform. It is an S3 landing zone, a governed Delta lakehouse, short-lived jobs compute, a small SQL serving layer, and cost telemetry from day one. The architecture is allowed to grow after it has earned the extra moving parts.

## References

- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/)
- [Databricks pricing](https://docs.databricks.com/aws/en/resources/pricing)
- [Databricks Auto Loader on AWS](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/)
- [Unity Catalog on Databricks AWS](https://docs.databricks.com/aws/en/data-governance/unity-catalog/)
- [AWS Pricing Calculator](https://calculator.aws/)
`;export{e as default};