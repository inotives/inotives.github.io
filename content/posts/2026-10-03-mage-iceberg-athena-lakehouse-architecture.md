---
title: "Designing an S3 Iceberg lakehouse with Mage, Athena, dbt, and Terraform"
date: 2026-10-03
tags: [data-engineering, mage-ai, apache-iceberg, aws-athena, dbt, terraform, data-lakehouse]
summary: "A high-level design for an S3 lakehouse where Mage ingests and validates Parquet, Iceberg provides the Raw-to-Gold table layers, dbt-athena transforms the data, and Terraform with GitHub Actions promotes the same infrastructure from dev to prod."
series: data-engineering
---

The next data stack I want to evaluate is not another warehouse deployment. It is a lakehouse assembled from smaller pieces: Mage for orchestration, S3 for storage, Apache Iceberg for tables, Glue for the catalog, Athena for SQL, dbt for transformations, and Terraform for the environment.

This article is a reference design, not a report of a completed AWS deployment. The goal is to make the seams visible before investing in a proof of concept. Where the design depends on a provider choice or an operational test, I call that out instead of pretending the diagram has already been run.

![Proposed Mage, Iceberg, Athena, and Terraform lakehouse architecture](/assets/images/mage-iceberg-lakehouse-architecture.svg)

## Start with the boundaries

The stack has four different jobs:

- Mage moves batches and decides when a batch may advance.
- S3 stores the files and Iceberg table data.
- Glue names the tables and stores catalog metadata.
- Athena executes SQL over the Iceberg tables.
- dbt-athena turns Bronze tables into Silver and Gold models.
- Terraform creates the surrounding AWS resources and their access policies.

Those responsibilities overlap in an architecture diagram, but they should not be collapsed into one service. Mage is not the table format. dbt is not the query engine. Glue is not the data lake itself.

## The proposed layer model

The data path has an explicit safety boundary.

![Data flow from source Parquet to trusted Iceberg tables](/assets/images/mage-iceberg-data-flow.svg)

### Raw: keep the source intact

Raw is the replay point. Mage copies or registers the incoming Parquet batch without changing its business meaning. Each batch should have a manifest with its source location, arrival time, schema fingerprint, row count, and processing status.

Raw does not need to be a query-friendly table. Its job is to preserve what arrived. That makes it possible to re-run a corrected validator or rebuild Bronze after a pipeline change.

### Quarantine: make failure inspectable

A failed health check should produce more than a red task in Mage. Keep the batch, its manifest, and the validation errors in a quarantine prefix. A schema drift, an empty file, or an orphaned reference should be something an operator can inspect and reprocess.

Quarantine is not a second production dataset. It is an evidence area with a clear retention policy.

### Bronze: the first trusted Iceberg table

Bronze is the first safe landing zone. Only a batch that passes the health gate is written or promoted into an Iceberg table registered in Glue.

The Bronze model should retain source columns and operational fields such as `_source_file`, `_batch_id`, and `_ingested_at`. It can normalize physical types, but it should not quietly invent business rules that belong in Silver.

### Silver and Gold: transformations with a contract

dbt-athena reads Bronze and creates the analytical layers. Silver is where keys are conformed, duplicates are handled, and joins become useful. Gold contains the smaller models that BI users actually need.

Athena is the engine executing the SQL. dbt supplies model dependencies, tests, documentation, and materialization decisions. That distinction matters when debugging a slow model or an unexpected Iceberg write.

## Mage should own the promotion decision

The Mage pipeline can be shaped as four steps:

1. Discover a new source batch and write its manifest.
2. Land the original files in Raw.
3. Run health checks against schema, types, row counts, null rates, keys, and freshness.
4. Move an accepted batch into Bronze and trigger the dbt-athena run.

The failed path should be just as deliberate: record the errors, mark the batch rejected, and leave the source files available for inspection. Do not let a later task infer success from the absence of an exception. The manifest needs an explicit state transition.

The health check is also where schema drift becomes a controlled event. An added nullable column might be compatible. A renamed key or a changed timestamp type probably is not. Those decisions belong in a versioned contract, not in a hidden conditional inside the ingestion code.

## Iceberg and Glue provide the table layer

S3 gives the system durable object storage. Iceberg adds snapshots, schema evolution, partition-aware metadata, and table-level commit behavior. Glue gives Athena and other AWS-aware tools a catalog name for those tables.

The proposed catalog path is simple:

```text
Glue database
  └── Iceberg table name
       ├── table metadata
       └── S3 data and manifest objects
```

The catalog should not be mistaken for authorization. A user who can read the underlying S3 prefix may bypass the query path entirely. Access policies need to cover both the catalog/query APIs and the data locations.

## Athena and BI access

Athena is the shared SQL boundary for the analytical layers. Give each workload an explicit workgroup and result location so query history, cost controls, and permissions are easier to reason about.

Metabase and QuickSight can sit above Athena, but they should not receive broad access to every S3 prefix. BI identities should query approved databases or views and write query results to controlled locations. Direct object access is a separate permission decision.

This design also leaves room for another Iceberg-compatible engine later. That is useful, but it is not a reason to hide engine-specific behavior. Validate timestamp handling, merges, deletes, and schema evolution with the engine that will run production transformations.

## Keep credentials in separate lanes

The identity design is more important than the arrows between boxes.

![Identity, network, and CI/CD boundaries](/assets/images/mage-iceberg-security-cicd.svg)

The preferred path is short-lived IAM role assumption:

- GitHub Actions uses OIDC to assume a tightly scoped Terraform role.
- The Mage runtime uses a task role for S3, Glue, Athena, and logging.
- dbt-athena uses a transformation role that can read Bronze and write Silver/Gold.
- BI tools use a read role restricted to approved Athena databases and result locations.
- Secrets Manager stores only credentials that cannot be replaced by role-based access.

Avoid putting AWS access keys in GitHub secrets, container images, `profiles.yml`, or Mage pipeline code. If a service token is unavoidable, inject it from Secrets Manager at runtime and scope it to the smallest operation.

Mage itself still needs a deployment decision. It could run on ECS, Kubernetes, or another managed runtime. That choice changes the networking and metadata-store details, so it should be a parameter of the proof of concept rather than hidden in this reference diagram.

## The VPC is for the runtime, not the whole lake

The Mage workers and supporting runtime belong in private subnets. S3, Glue, and Athena are AWS-managed services; they are not machines that need to be placed inside those subnets.

The runtime needs a private route to the AWS APIs it uses. S3 Gateway Endpoints are a natural starting point for object access. Other endpoints or controlled outbound routing may be needed for the remaining APIs, image pulls, logs, and any external service that Mage calls.

This is where a diagram can mislead. A line from Mage to S3 does not prove that the network path, IAM policy, and bucket policy agree. The deployment should test those three boundaries separately.

## Terraform and GitHub Actions promotion

The repository should contain the Terraform modules, Mage pipeline definitions, dbt project, and environment configuration. The deployment flow can then stay boring:

```text
feature branch
  → pull request checks
  → dev plan and apply
  → data contract and smoke checks
  → merge to main
  → reviewed production plan
  → production apply
```

Dev and prod should have separate state, buckets, Glue databases, IAM roles, and query-result locations. Reusing a bucket and changing only a Terraform variable is how a test pipeline eventually writes into the wrong environment.

Terraform should own infrastructure and access policy. Mage should own runtime scheduling and pipeline execution. dbt should own transformation definitions. GitHub Actions should coordinate promotion, not become a second orchestration system for data.

## What this design still needs to prove

Before calling the architecture production-ready, the proof of concept should test:

- an accepted batch from Raw into Bronze;
- a schema drift that reaches Quarantine without corrupting Bronze;
- a retry that does not duplicate a batch;
- an Iceberg schema change read by Athena;
- a dbt-athena run that produces Silver and Gold tables;
- a BI identity that can query Gold but cannot read arbitrary Raw objects;
- a dev deployment that cannot write to prod;
- a production deployment using GitHub OIDC without static AWS keys.

Those checks will tell us whether the seams are sound. A successful Terraform apply alone will not.

## References

- [Mage AI](https://mage.ai/)
- [Apache Iceberg](https://iceberg.apache.org/)
- [AWS Glue Data Catalog](https://docs.aws.amazon.com/glue/latest/dg/catalog-and-crawler.html)
- [Querying Iceberg tables with Athena](https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg.html)
- [dbt-athena](https://github.com/dbt-athena/dbt-athena)
- [Terraform](https://developer.hashicorp.com/terraform)
- [GitHub Actions OpenID Connect for cloud providers](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-cloud-providers)
- [Metabase Athena connection](https://www.metabase.com/docs/latest/databases/connections/athena)
- [Using Athena with Amazon QuickSight](https://docs.aws.amazon.com/quicksight/latest/user/athena.html)
