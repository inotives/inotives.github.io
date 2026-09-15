---
title: "How to Structure Repositories for an AWS Databricks Lakehouse"
date: 2026-09-15
tags: [data-engineering, databricks, aws, terraform, ci-cd, lakehouse]
series: data-engineering
summary: "A practical repository strategy for an AWS and Databricks lakehouse: separate privileged infrastructure from deployable data products, use a product monorepo first, and split repositories only when team ownership or release cadence demands it."
---

The first AWS and Databricks lakehouse architecture is usually drawn as S3, Delta tables, Unity Catalog, Lakeflow pipelines, and a SQL warehouse. The next problem is less glamorous: where does the code live, who can deploy it, and how do you avoid turning one workspace into an unreviewed pile of notebooks?

For a 10 TB lakehouse with a small platform team, I would start with two repositories:

1. A tightly controlled infrastructure repository for AWS, Databricks account and workspace foundations, and Unity Catalog setup.
2. A data-products monorepo for ingestion, transformations, tests, jobs, and dashboards.

This is not a universal rule. It is a useful default because the two repositories have different owners, permissions, state, and failure modes. An IAM role change is not the same kind of change as a new `silver_trades` transformation.

## Do not start with one repository per notebook

There are two common mistakes.

The first is the mega-repository: Terraform, every pipeline, dashboards, API services, experimental notebooks, shared Python packages, and operational runbooks all have the same release pipeline and the same reviewers. A data analyst changing a SQL model now has to understand an AWS network plan. An infrastructure engineer can accidentally block a revenue report because the entire repository shares one deployment path.

The second is the opposite extreme: a repository for every table, notebook, or workflow. The number of pull requests, duplicated CI definitions, package versions, and dependency updates becomes the main work. No business problem required that complexity.

A bounded data-products monorepo gives a team one place to find related source contracts, Bronze ingestion, Silver rules, Gold models, and tests. The infrastructure plane stays outside it because production AWS and Databricks account changes need a narrower approval path.

## The two-plane layout

```text
github.com/company/lakehouse-infra
  -> AWS account and network foundation
  -> Databricks account/workspace configuration
  -> Unity Catalog, storage credentials, external locations
  -> Terraform state and privileged CI identity

github.com/company/lakehouse-data-products
  -> domain pipelines, jobs, tests, dashboards
  -> Declarative Automation Bundle definitions
  -> data contracts and runbooks
  -> developer CI identity
```

The boundary is authority, not technology. Both repositories can use Terraform or YAML. The infrastructure repository owns resources whose mistake can expose data, break every workspace, or create an unbounded bill. The product repository owns resources that turn already-authorised data into a domain dataset.

For example, the infrastructure repository creates the S3 bucket, KMS key, IAM role, Unity Catalog metastore, storage credential, external location, workspace groups, and workspace-level cluster policies. The product repository defines the Auto Loader pipeline that reads from the approved location, its Lakeflow job, tables, expectations, and dashboard.

Do not let every product team create arbitrary buckets, IAM roles, or external locations. That route makes data lineage and least-privilege access a spreadsheet exercise.

## Repository one: `lakehouse-infra`

Keep this repository small and boring. It should describe the foundation, not every daily data transformation.

```text
lakehouse-infra/
├── modules/
│   ├── aws-lake-storage/          # S3, KMS, lifecycle, bucket policies
│   ├── databricks-workspace/      # workspace and account configuration
│   └── unity-catalog/             # metastore, locations, grants
├── environments/
│   ├── dev/
│   │   ├── aws/
│   │   └── databricks/
│   ├── staging/
│   └── prod/
├── policies/                      # approved cluster and workspace policies
├── docs/
│   ├── access-model.md
│   ├── break-glass.md
│   └── state-recovery.md
└── .github/workflows/
    ├── terraform-plan.yml
    └── terraform-apply.yml
```

Use separate Terraform state per environment and scope it so a workspace resource change cannot also replace account-level storage. A common split is AWS foundation state, Databricks account state, and Databricks workspace state. It adds a few state backends, but makes the blast radius legible.

Terraform is a good fit here because the AWS provider and Databricks provider can create and manage the cloud resources, workspaces, access configuration, and Unity Catalog objects. It is not a reason to put every job definition in Terraform. A job tied to one data product should release with that product's code.

The apply identity deserves special treatment. Use short-lived CI credentials through GitHub OIDC or an equivalent federated mechanism. Keep production applies behind an environment approval. Do not place long-lived AWS keys or Databricks personal access tokens in repository secrets and call that an access model.

## Repository two: `lakehouse-data-products`

This repository contains deployable business logic. Organise it by domain or data product, not by tool. A `sql/` folder for every query in the company becomes unsearchable once more than one source or team exists.

```text
lakehouse-data-products/
├── databricks.yml                 # shared bundle configuration and targets
├── resources/                     # bundle-level shared job conventions
├── packages/
│   └── common/                    # small shared Python library
├── products/
│   ├── market-data/
│   │   ├── src/
│   │   │   ├── ingestion/
│   │   │   ├── bronze/
│   │   │   ├── silver/
│   │   │   └── gold/
│   │   ├── resources/             # job and pipeline definitions
│   │   ├── tests/
│   │   ├── contracts/
│   │   └── README.md
│   ├── treasury/
│   └── customer-analytics/
├── dashboards/
├── docs/
│   ├── deployment.md
│   └── incident-runbook.md
└── .github/workflows/
    ├── validate.yml
    ├── deploy-dev.yml
    └── deploy-prod.yml
```

`market-data` might own exchange trade ingestion, contract metadata, funding history, and the Gold liquidity tables used by risk. It owns its source contract and its quality tests. It does not own the production S3 bucket or grant itself a new cross-account role.

Keep shared code genuinely small. A function that normalises timestamps or records a source manifest belongs in `packages/common`. A "universal framework" for every pipeline usually becomes a bottleneck. Let product code remain close to its data contract.

## Use bundles for deployable data products

Databricks Declarative Automation Bundles, formerly Databricks Asset Bundles, let source-controlled project files define Databricks resources and deployment targets alongside business logic. That is the right layer for Lakeflow Jobs, Lakeflow pipelines, dashboards, notebooks, and Python wheels that belong to a product.

Each deployment target should map to a real environment:

```yaml
targets:
  dev:
    mode: development
    workspace:
      host: https://dev-workspace.example.cloud.databricks.com
  staging:
    workspace:
      host: https://staging-workspace.example.cloud.databricks.com
  prod:
    mode: production
    workspace:
      host: https://prod-workspace.example.cloud.databricks.com
```

The exact bundle configuration will vary, but the rule should remain: CI validates a pull request, deploys the merged revision to development, runs a targeted integration check, and requires an explicit production approval. Do not use the production workspace as the first place a notebook runs successfully.

For a Lakeflow pipeline, test the transformations against a small, versioned input fixture. For a SQL model, assert row grain, uniqueness, source freshness, and a known business invariant. For example, a market-data product can verify that `venue + instrument_id + event_time` is unique and that every active instrument has a recorded contract multiplier.

## A practical approval model

Different changes need different reviewers.

| Change | Repository | Minimum review |
| --- | --- | --- |
| New S3 external location | Infrastructure | platform owner and security/data governance owner |
| Unity Catalog grant | Infrastructure | data owner and platform owner |
| New Bronze source | Data products | source owner and data engineer |
| Silver business rule | Data products | data engineer and domain owner |
| Gold metric or dashboard | Data products | domain owner |
| Production bundle deployment | Data products | automated checks plus release approver |

This model prevents an important failure: an engineer should not be able to merge a transformation and quietly expand the data it can read. Business logic review and permission review are both necessary, but they are not the same review.

## When to split the data-products monorepo

Keep the product monorepo while the same platform team owns the shared release process and most changes touch a small group of related domains. It makes refactoring source contracts and shared schemas much easier.

Split a product into its own repository when at least one boundary is real:

- A separate team owns the on-call rotation and production releases.
- The product has a different security boundary, such as restricted customer PII.
- Its dependencies or release cadence cause regular CI contention.
- It is mature enough to publish a versioned interface to other teams.

"There are many folders" is not a reason. Start with directory ownership rules, targeted CI based on changed paths, and CODEOWNERS. Those solve most early monorepo problems without multiplying repositories.

The infrastructure repository should remain separate even when product code splits. It keeps the account and governance plane consistent as more teams join.

## What this looks like on AWS

AWS infrastructure should make the repository boundary enforceable:

- S3 prefixes and KMS keys are allocated through infrastructure changes.
- IAM and Unity Catalog grants follow a reviewed product identity, never an individual developer identity.
- Each environment has separate storage locations and workspaces, or an equally strong isolation model.
- CloudTrail, Databricks audit logs, and Terraform plan output provide the change record.
- Cost tags link compute and storage back to the product directory and owner.

That last point is easy to skip. A product name in a repository is not enough to attribute costs. Add a required tag such as `data_product=market-data` to compute policies and provisioned storage. When a daily pipeline doubles in cost, the owning team should be able to find it without asking finance for a billing export.

## Start with the boundary that prevents the expensive mistake

For the lakehouse described in the previous article, two repositories are enough: `lakehouse-infra` for privileged AWS and Databricks setup, and `lakehouse-data-products` for deployable data products. Use a product monorepo first. Keep Terraform state scoped and production infrastructure approvals narrow. Use bundles to ship jobs and pipelines with the code that they execute.

Split only when an ownership, security, or release boundary has already appeared in real work. That is the point at which another repository reduces coordination. Before then, it mostly creates more places for a broken source contract to hide.

## References

- [Databricks Declarative Automation Bundles](https://docs.databricks.com/aws/en/dev-tools/bundles/)
- [Databricks Terraform provider documentation](https://docs.databricks.com/aws/en/dev-tools/terraform/)
- [Databricks Terraform provider on the Terraform Registry](https://registry.terraform.io/providers/databricks/databricks/latest/docs)
- [AWS provider documentation on the Terraform Registry](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
