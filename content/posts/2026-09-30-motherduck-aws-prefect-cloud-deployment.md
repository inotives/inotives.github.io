---
title: "Deploying the market-data flow with AWS, Prefect Cloud, and MotherDuck"
date: 2026-09-30
tags: [data-engineering, motherduck, aws, prefect, duckdb, ducklake, crypto-data]
summary: "Connect the paired market-data Parquet dump in S3 to an ECS flow managed by Prefect Cloud and a MotherDuck database, with separate AWS roles, secret handling, access checks, and a DuckLake BYOB path for restricted data."
series: building-motherduck-warehouse
---

The last article ran our paired `coins.parquet` and `market_data.parquet` dump through Prefect and dbt. It worked locally and could target a MotherDuck development database. This article connects that flow to AWS and Prefect Cloud, then runs it against MotherDuck from an ECS task.

There are two data destinations in this series. MotherDuck is the managed warehouse for data allowed to leave our AWS account. When policy requires the table data to stay on infrastructure we control, the BYOB path uses DuckLake with Parquet in our S3 bucket and its SQL catalog inside AWS. They are separate targets; this setup does not write the same restricted data to both.

![The market-data Parquet dump lands in S3, Prefect Cloud launches an ECS Fargate flow task, and the task can write to either a MotherDuck managed warehouse or a DuckLake BYOB catalog and S3 path in the AWS account. The diagram shows separate task and execution roles.](/assets/images/motherduck-aws-prefect-motherduck-architecture.png)

## The four services and their boundaries

The flow reads the two Parquet files from S3, validates them as a pair, and sends invalid batches to quarantine. For the MotherDuck target, it loads a passing batch into Bronze. Prefect Cloud schedules the run; an ECS Fargate task executes it inside our AWS account.

That last distinction matters. Prefect Cloud is the control plane, while the Python process runs in AWS. The flow reports run state and logs to Prefect Cloud. Those logs should contain batch IDs and file paths, not token values or market rows. If policy prohibits even run metadata from leaving the account, Prefect Cloud may not meet the requirement; confirm that before using this design.

The MotherDuck branch sends query traffic and table data to a managed warehouse. The DuckLake BYOB branch stores Parquet in our S3 bucket and keeps its catalog in a SQL database inside AWS. Use DuckLake for the restricted-data path, and do not also configure that same batch to load into MotherDuck.

## Create the AWS landing area

Create an S3 bucket in the AWS account and region where the flow will run. Keep Block Public Access enabled, turn on versioning, and choose the encryption key required by your policy. Use prefixes to separate incoming files, rejected batches, and archived data:

```text
s3://<bucket>/market-data/
├── landing/<batch-id>/coins.parquet
├── landing/<batch-id>/market_data.parquet
├── quarantine/<batch-id>/...
└── archive/<batch-id>/...
```

S3 prefixes are object-key paths, not separate folders with independent ACLs. Put access boundaries in IAM and bucket policies. The flow task should read only from the landing prefix and write only to the quarantine or archive prefixes it needs. If the production flow moves objects by copying and deleting, include the corresponding permissions on those exact prefixes.

For DuckLake, reserve a separate prefix for table data, such as `s3://<bucket>/ducklake/market-data/`. Its writer needs read/write access there and may need `s3:DeleteObject` for table maintenance, so scope that permission to the DuckLake prefix rather than granting it across the bucket. DuckLake metadata lives in its SQL catalog, not in S3 by itself.

## Keep the AWS roles separate

ECS has two roles that are easy to confuse:

| Identity | Used by | Access in this setup |
| --- | --- | --- |
| Prefect ECS launcher credentials | Prefect Cloud when it starts an ECS task | ECS task launch operations and the ability to pass the specific ECS roles |
| Task execution role | ECS/Fargate agents | Pull the flow image, publish container logs, and retrieve the named Secrets Manager values |
| Task role | The flow code inside the container | Read the landing objects and write only to its approved quarantine/archive or DuckLake prefixes |

Do not use the task execution role for the flow's S3 reads, and do not put long-lived AWS access keys in the flow's environment. The task role supplies temporary AWS credentials to the application through the ECS credential provider. At minimum, scope its `s3:ListBucket` permission to the required prefixes, `s3:GetObject` to landing objects, and `s3:PutObject` to quarantine/archive objects. For secrets injected from Secrets Manager, the execution role needs `secretsmanager:GetSecretValue` on those secret ARNs; if a customer-managed KMS key encrypts them, it also needs permission to decrypt with that key.

For a first POC, Prefect documents an ECS push-pool provisioning command that creates the ECS resources and a Prefect `AWSCredentials` block:

```bash
aws configure sso --profile market-data-dev
aws sso login --profile market-data-dev
AWS_PROFILE=market-data-dev \
prefect work-pool create --type ecs:push --provision-infra market-data-ecs
```

Run `aws configure sso` once to create the local profile, then log in to Prefect Cloud and select the intended workspace before creating the pool. The AWS profile should use an IAM Identity Center role in the intended account, not a long-lived access key. Review the IAM user and policy the Prefect provisioning step creates before using the pool with production data. The launch credentials are stored in Prefect Cloud so the push pool can call AWS. Give them only the ECS permissions needed for this deployment, and do not start with the AWS root user or an administrator key.

For production, treat the launcher identity as a separate credential from both ECS roles. Rotate it, limit who can read or edit the Prefect block, and scope `iam:PassRole` to the task and execution roles for this flow. If your policy does not allow AWS credentials to be stored in Prefect Cloud, this push-pool setup is the wrong fit; use a worker deployed in AWS with an IAM task role instead.

## Create the Prefect Cloud workspace and deployment

Create a Prefect Cloud workspace for this project. Under the account's Service Accounts page, create a service account, share it with this workspace, give it the workspace role needed to run this deployment, and create an API key. Log the local CLI into that workspace with the interactive `prefect cloud login` command. Store the service-account key in Secrets Manager for the flow task to report states and logs; do not use a personal key in a scheduled production job.

Package the existing flow and its dependencies in a container image. It needs the same Prefect, DuckDB, dbt, and Parquet-reading dependencies used by the local run. From the repository root, start the deployment wizard with the flow entry point from the previous article:

```bash
prefect deploy features/market_data/ingestion.py:ingest_market_data
```

Choose `market-data-ecs` when prompted. In the ECS work pool's base job template, set the AWS region, network placement, task role ARN, and execution role ARN. Configure the container definition with the Secrets Manager references below. The task needs outbound HTTPS access to Prefect Cloud, S3, and the selected data destination. If the task runs in private subnets, provide the required NAT or service endpoints.

Store runtime secrets in AWS Secrets Manager. In the console, choose **Store a new secret**, use the key/value option, and create separate secrets for the Prefect Cloud API key used by the running flow and the MotherDuck token. Reference their ARNs in the ECS container definition's `secrets` list; do not paste secret values into `prefect.yaml`, a Dockerfile, or a committed `.env` file. For example, the container definition includes entries shaped like this:

```json
"secrets": [
  {"name": "PREFECT_API_KEY", "valueFrom": "<prefect-api-key-secret-arn>"},
  {"name": "motherduck_token", "valueFrom": "<motherduck-token-secret-arn>"}
]
```

The ECS task execution role retrieves these values when the container starts. Pass non-secret settings such as the region, bucket name, and target database as ordinary environment variables.

Example configuration names (the values below are placeholders):

```text
AWS_REGION=ap-southeast-1
S3_LANDING_PREFIX=s3://<bucket>/market-data/landing/
S3_QUARANTINE_PREFIX=s3://<bucket>/market-data/quarantine/
WAREHOUSE_TARGET=motherduck_dev
MOTHERDUCK_DATABASE=market_data_dev
```

The container receives `PREFECT_API_KEY` and `motherduck_token` from Secrets Manager. In the flow, read the MotherDuck token from the environment and connect without embedding it in the connection string:

```python
import duckdb

con = duckdb.connect("md:market_data_dev")
con.execute("SELECT 1").fetchone()
```

DuckDB reads `motherduck_token` from the process environment. The test query confirms authentication and connectivity; it does not prove the ingestion task has the right database permissions or S3 access. Keep the token out of logs and exceptions, and give the token only the access this environment needs.

## Create the MotherDuck development target

In the MotherDuck UI, create a development database named `market_data_dev`. Under organization settings, open **Access tokens** and create a dedicated token for this deployment. Choose Read/Write access and an expiry, then copy it once into the Secrets Manager value referenced by the ECS task definition. Do not commit it or pass it in a command-line argument, where it may be retained in shell history or process listings.

The task connects using the database name and injected token. When the selected target is `motherduck_dev`, the valid `coins` and `market_data` pair is written to MotherDuck Bronze and the dbt models run against that target. The Parquet source remains in S3 according to the archive policy, but the warehouse tables are managed by MotherDuck. This path is for data permitted to use that managed service.

The credentials are independent: the ECS task role authorizes AWS object access, while `motherduck_token` authenticates to MotherDuck. Changing one does not grant or revoke access to the other.

## Run one accepted batch and one rejected batch

Start with a small dump in the landing prefix. Run the deployment once with a valid pair, then again with a deliberately invalid copy in a test prefix. Check the Prefect run page for task results, then verify:

- the valid pair appears in the expected MotherDuck Bronze tables;
- the rejected batch is under quarantine and is absent from Bronze;
- the flow can read S3 using its task role without any AWS key in its container variables;
- logs show the batch ID and outcome, not token values or data rows.

Keep the same batch-level validation and provenance rules from the local flow. Moving the worker to ECS should change where it runs, not whether a partial pair can reach Bronze.

## When the target is DuckLake instead

For a data-residency requirement, keep the flow task and DuckLake catalog inside AWS, store DuckLake's Parquet files in the reserved S3 prefix, and grant the task role access only to that prefix and catalog. The AWS security group and route table must allow the task to reach the catalog. The flow still validates the same pair before writing.

This is the DuckLake BYOB path selected for the series. It keeps the table files and catalog under our control, but it does not automatically keep orchestration metadata there: Prefect Cloud still receives run state and logs, and an ECS push pool stores AWS launcher credentials in Prefect Cloud. Check those boundaries against the actual policy. If either is prohibited, stop before sending the restricted workload through this design.

MotherDuck and DuckLake are therefore two deliberate destinations, not a replication pair. We can run the same contract and quality gate against either target, but the policy decision determines where the batch is written.

## References

- [Prefect: run flows on serverless compute, including AWS ECS push work pools](https://docs.prefect.io/v3/how-to-guides/deployment_infra/serverless)
- [Prefect: manage service accounts](https://docs.prefect.io/v3/how-to-guides/cloud/manage-users/service-accounts)
- [AWS: Amazon ECS task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [AWS: Amazon ECS task execution IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)
- [AWS: pass sensitive data to an Amazon ECS container](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html)
- [MotherDuck: authenticate with an access token](https://motherduck.com/docs/key-tasks/authenticating-to-motherduck/)
- [DuckLake: choose a storage backend](https://ducklake.select/docs/stable/duckdb/usage/choosing_storage.html)
- [DuckLake: access control with S3 and a SQL catalog](https://ducklake.select/docs/stable/duckdb/guides/access_control.html)
