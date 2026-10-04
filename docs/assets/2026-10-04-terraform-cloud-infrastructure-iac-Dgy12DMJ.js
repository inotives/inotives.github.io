var e=`---
title: "Terraform as the control plane for enterprise cloud infrastructure"
date: 2026-10-04
tags: [terraform, infrastructure-as-code, aws, cloud-infrastructure, devops, data-engineering]
summary: "A practical introduction to Terraform as an infrastructure control plane, using an S3 Iceberg market-data platform to explain modules, state, repository structure, environment isolation, and dev-to-production promotion."
series: data-engineering
---

The previous articles designed a data platform. We now need a repeatable way to create it.

That platform includes S3 landing areas, Iceberg tables, a Glue Catalog, Athena workgroups, IAM roles, private networking, a Mage runtime, logging, and separate dev, staging, and production boundaries. Clicking through the AWS console can create the first version. It does not create a reliable way to recreate the second one.

Terraform is the tool I would use to describe that platform as code.

This article uses the proposed \`market_data\` lakehouse from the [Mage and Iceberg architecture](/notes/2026-10-03-mage-iceberg-athena-lakehouse-architecture), plus the Raw-to-Bronze controls from the [data health gate article](/notes/2026-10-04-data-health-gate-safe-ingestion). The examples are a reference design, not a claim that this exact cloud environment has already been deployed.

![Terraform cloud infrastructure control plane](/assets/images/terraform-cloud-control-plane.svg)

## Terraform in plain terms

Terraform is a declarative infrastructure tool. You describe the resources and relationships you want. Terraform compares that desired configuration with its state and the provider's view of the cloud, then proposes a change plan.

The normal loop is:

\`\`\`text
write HCL
  → terraform plan
  → review the proposed changes
  → terraform apply
  → provider APIs change the cloud
  → state records the result
\`\`\`

The configuration might say that an S3 bucket exists, an Athena workgroup uses a particular result path, and a Mage task role can read the Bronze prefix. Terraform does not execute those data jobs. It creates the stage on which they can run.

## What Terraform actually controls

For our market-data platform, Terraform can create or configure:

- VPCs, subnets, routes, and VPC endpoints;
- S3 buckets and Raw, Quarantine, Bronze, Silver, and Gold prefixes;
- Glue databases and catalog settings;
- Athena workgroups and query-result locations;
- IAM roles and policies for Mage, dbt-athena, BI, and CI/CD;
- ECS or another Mage runtime;
- Secrets Manager entries and access policies;
- CloudWatch log groups, alarms, and retention;
- references to container images or other release artifacts.

That list is the infrastructure boundary. Mage still runs the ingestion flow. The health gate still evaluates batches. dbt-athena still executes the Bronze-to-Silver-to-Gold models. Terraform gives each of them a controlled place to run.

## Why this became the IaC standard pattern

Infrastructure as code is not just “put the console steps in a repository.” The useful part is the reviewable dependency graph.

Terraform can see that an Athena workgroup depends on an S3 result location, that a runtime needs an IAM role, and that a role policy refers to a particular bucket. It can create resources in dependency order and show the proposed changes before applying them.

That gives a team a few practical properties:

- infrastructure changes can be reviewed in pull requests;
- a dev environment can be rebuilt from a known commit;
- the same module can create similar environments with different inputs;
- policy checks can run before an apply;
- drift becomes something the team can detect instead of discovering during an incident.

Terraform is not magic drift prevention. Someone can still change a resource outside Terraform, and a provider can expose behavior that the configuration does not capture. The value is that the intended state is written down and can be compared with reality.

## The three Terraform ideas that matter

### Configuration

Terraform configuration is normally written in HCL. A resource describes something a provider manages. A module groups resources into a reusable unit.

For example, a lakehouse module might accept a bucket name, environment name, retention settings, and allowed IAM principals. The module can create the bucket, prefixes, encryption settings, and policies without knowing whether it is being called from dev or prod.

### Providers

Providers translate Terraform resources into API calls. The AWS provider knows how to work with S3, IAM, Glue, Athena, VPC, ECS, and other AWS services.

The provider is an implementation seam, not a reason to hide cloud behavior. A resource may have provider-specific defaults, replacement behavior, or permission requirements. Those details belong in the module documentation and its tests.

### State

State is Terraform's record of the resources it manages and their important relationships. It lets Terraform match a configuration block to an existing cloud object rather than creating a new one every time.

State can contain sensitive values. Store it in a remote backend with encryption, access control, versioning, and locking. Separate dev, staging, and production state. A single shared state file makes unrelated environments share a failure boundary.

## A repository that scales beyond one demo

There are two common mistakes in Terraform repositories. One is putting every resource in one enormous root module. The other is copying the whole configuration three times for dev, staging, and prod.

The practical middle is reusable modules plus small environment root modules.

![Enterprise Terraform repository structure](/assets/images/terraform-enterprise-repository.svg)

\`\`\`text
terraform/
├── modules/
│   ├── networking/
│   ├── lakehouse/
│   ├── athena/
│   ├── iam/
│   └── mage-runtime/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── dev.tfvars
│   ├── staging/
│   └── prod/
├── global/
│   ├── identity/
│   └── state-backend/
└── policies/
\`\`\`

The module defines how to create a thing. The environment root decides whether that thing belongs in dev, staging, or prod and which values it receives.

Keep modules boring. A single S3 bucket does not need a factory, and a module with one caller is often just an indirection. Introduce a module when it represents a real boundary such as the lakehouse, network, runtime, or IAM pattern.

## Applying the structure to \`market_data\`

The dev root module might call the platform pieces like this conceptually:

\`\`\`text
dev/
  networking module
  lakehouse module
    raw/ quarantine/ bronze/ silver/ gold
  athena module
  mage-runtime module
  iam module
\`\`\`

The staging root calls the same modules with different inputs. Production does too, but with tighter retention, smaller write permissions, a separate account, and a reviewed apply path.

The data contract does not belong in a Terraform variable just because Terraform creates the bucket. The schema and health rules live with the ingestion or data project. Terraform can provision the storage, permissions, manifest table, and alerting that the health gate needs.

## Environment control is an isolation problem

Changing \`environment = "prod"\` is not enough to make a safe production boundary. The strongest pattern is separate cloud accounts or projects, separate state, separate credentials, separate buckets, and separate catalog databases.

![Terraform dev staging production promotion](/assets/images/terraform-environment-promotion.svg)

\`\`\`text
pull request
  → format, validate, policy checks
  → plan dev
  → apply dev
  → smoke test the market_data stack
  → approve staging
  → plan production
  → approve and apply production
\`\`\`

The same Terraform module can create the same logical platform in each environment. The environment boundary changes the account, state key, bucket names, IAM principals, network ranges, and data retention.

Terraform workspaces can be useful for small variations, but they should not be the only isolation mechanism for a serious production boundary. A workspace is a state selection. It does not automatically create a different AWS account, credential set, bucket policy, or blast radius.

## State and credentials need their own design

The Terraform backend should be bootstrapped separately from the environments it manages. A typical AWS setup uses a versioned, encrypted S3 state location with a locking mechanism and a narrowly scoped CI role.

GitHub Actions should use OIDC to assume a short-lived AWS role. Do not put a permanent AWS access key in the repository or use the production role for pull-request plans.

Use different roles for different actions:

- pull-request plan role: read enough cloud state to calculate a plan;
- dev apply role: create and update dev resources;
- staging apply role: require an environment approval;
- production apply role: require a separate approval and account boundary;
- runtime roles: used by Mage or ECS while processing data, not by Terraform.

This continues the credential separation from the earlier Prefect and ECS articles. The task role that reads S3 data is not the GitHub deployment role. The Terraform role that creates an IAM policy is not the Mage role that uses it.

## Terraform versus application and data deployment

Terraform should not become a universal deployment system.

![Terraform and data deployment responsibilities](/assets/images/terraform-and-data-deployment-boundary.svg)

Keep the responsibilities separate:

\`\`\`text
Terraform
  → VPC, IAM, S3, Glue, Athena, runtime, logging

Application CI/CD
  → build and publish Mage or service artifacts

Data runtime
  → ingest, validate, quarantine, promote, transform

dbt deployment
  → publish and test SQL model definitions
\`\`\`

Terraform can update an ECS task definition to point at a new image, or create a Lambda function from an artifact. It should not build the image, run every batch, or replace the data orchestrator.

In our platform, a change to the health-gate Python package is an application or pipeline release. A change to the S3 bucket policy is an infrastructure release. A change to a dbt model is a data transformation release. They may share a GitHub repository, but they do not have the same approval or rollback behavior.

## A realistic change through the stack

Suppose the team needs a new \`market_data\` Bronze table and an additional Athena workgroup for analyst queries.

1. A developer changes the lakehouse module or its dev root configuration.
2. GitHub Actions runs formatting, validation, security checks, and a Terraform plan.
3. The pull request shows the new S3 location, Glue table permissions, Athena workgroup, and IAM changes.
4. After review, the dev role applies the change.
5. The health gate loads a test batch, including one rejected schema-drift sample.
6. The data pipeline proves that accepted data reaches Bronze and bad data remains in Quarantine.
7. Staging repeats the test with its own state and account.
8. Production receives the reviewed plan only after the environment approval.

The important evidence is not “Terraform succeeded.” It is that the infrastructure, identities, health gate, and downstream query path work together in the intended environment.

## Common enterprise guardrails

The exact policy set varies, but these are useful defaults:

- run \`terraform fmt\`, \`validate\`, and plan on every change;
- reject unreviewed production applies;
- scan for public buckets, wildcard IAM permissions, and unencrypted storage;
- require tags for environment, owner, data classification, and cost center;
- restrict allowed regions and provider versions;
- keep state access separate from runtime data access;
- test destructive changes explicitly;
- retain plan and apply evidence with the deployment record;
- use module examples or small test environments before changing production.

Do not add a policy because the word “enterprise” sounds better with more checks. Add it when it prevents a real class of outage, data leak, or untracked cost.

## What Terraform gives the platform

Terraform turns cloud infrastructure into a reviewable, repeatable control plane. For the \`market_data\` platform, that means the same repository can describe the storage, catalog, query, runtime, identity, and network boundaries required by the data flow.

It does not make the data clean. The health gate does that. It does not transform Bronze into Gold. dbt-athena does that. It does not make a production release safe by itself. State isolation, OIDC roles, review gates, policy checks, and smoke tests do that.

That division of responsibility is the reason Terraform fits the architecture. It creates the platform once, then lets the systems that understand code and data do their own jobs inside it.

## References

- [Terraform language documentation](https://developer.hashicorp.com/terraform/language)
- [Terraform providers](https://developer.hashicorp.com/terraform/language/providers)
- [Terraform modules](https://developer.hashicorp.com/terraform/language/modules)
- [Terraform state](https://developer.hashicorp.com/terraform/language/state)
- [AWS provider for Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [GitHub Actions OpenID Connect for AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 security best practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
`;export{e as default};