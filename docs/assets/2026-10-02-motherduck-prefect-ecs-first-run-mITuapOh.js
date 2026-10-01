var e=`---
title: "Taking the MotherDuck connection spike to ECS"
date: 2026-10-02
tags: [motherduck, prefect, aws, duckdb, data-engineering]
summary: "A practical runbook for moving the Prefect and MotherDuck connection check onto ECS, wiring credentials through the right roles, and proving both an accepted and rejected market-data batch."
series: building-ai-systems
---

The last two articles left one useful question open: does the market-data flow still work when Prefect launches it as an ECS task?

The connection spike exercised Prefect Serverless. That run checked that MotherDuck could read the source Parquet from S3 and write to its DuckLake path. It did not exercise ECS networking, task roles, or Secrets Manager injection. This article lays out the ECS setup and the acceptance checks for the first run. I have not run this ECS deployment yet, so the configuration below is a runbook, not a report of a successful ECS execution.

![A Prefect Cloud deployment launches an ECS task. Secrets Manager supplies the task's Prefect and MotherDuck tokens; MotherDuck reads source Parquet and writes DuckLake data in separate S3 prefixes.](/assets/images/motherduck-prefect-ecs-run.svg)

## Keep the credentials in their own lanes

There are several identities involved. Prefect needs AWS credentials to create and start ECS tasks. The ECS task execution role lets ECS pull the image, write logs, and retrieve secrets at startup. The task role is available to code inside the container. This flow sends SQL to MotherDuck and does not call S3 directly, so its task role needs no S3 permissions. If the flow later uses \`boto3\` to inspect or move objects, add only the required bucket and prefix permissions there.

MotherDuck has a separate storage identity. Its scoped S3 secret lets MotherDuck read the raw batch and write DuckLake objects. The ECS role does not replace that secret, and the MotherDuck token does not grant AWS access.

| Identity | Used for | Minimum access in this example |
| --- | --- | --- |
| Prefect AWS credentials | Start ECS tasks | ECS task and cluster operations for the selected pool |
| ECS execution role | Start the container | Pull the image, write logs, read the two Secrets Manager entries |
| ECS task role | Code inside the flow container | No S3 access; the flow calls MotherDuck |
| MotherDuck service account | Connect and run SQL | Access to the development database |
| MotherDuck S3 secret | MotherDuck storage access | Read the raw prefix and write the DuckLake prefix |

Use a dedicated MotherDuck service account token and store it in Secrets Manager. Create a separate secret for the Prefect Cloud service account API key. The task definition should reference the secret ARNs; never put token values in \`prefect.yaml\`, the image, or a committed environment file.

Here is the relevant shape of the ECS container definition. The task execution role needs \`secretsmanager:GetSecretValue\` for these specific ARNs and \`kms:Decrypt\` if the secrets use a customer managed KMS key.

\`\`\`json
{
  "executionRoleArn": "<ecs-task-execution-role-arn>",
  "taskRoleArn": "<ecs-task-role-arn>",
  "containerDefinitions": [{
    "name": "market-data-flow",
    "image": "<account>.dkr.ecr.<region>.amazonaws.com/market-data:<tag>",
    "secrets": [
      {"name": "PREFECT_API_KEY", "valueFrom": "<prefect-api-key-secret-arn>"},
      {"name": "MOTHERDUCK_TOKEN", "valueFrom": "<motherduck-token-secret-arn>"}
    ]
  }]
}
\`\`\`

The exact task definition fields belong in the ECS push pool's job template. Keep subnet, security group, and image settings there too. The task needs outbound HTTPS access to Prefect Cloud and MotherDuck. If it runs in private subnets, make sure the route or endpoints support those calls and the image and secrets can be reached at startup.

## Put the dummy pair in the landing prefix

Reuse the \`coins.parquet\` and \`market_data.parquet\` files generated in [the connection spike](/notes/2026-10-01-motherduck-prefect-aws-connection-spike). In CloudShell, set the same bucket and batch ID, then confirm both objects are present before triggering Prefect:

\`\`\`bash
export AWS_REGION='<bucket-region>'
export BUCKET='<private-bucket-name>'
export BATCH_ID='20261001T000000Z'

aws s3api head-object \\
  --bucket "$BUCKET" \\
  --key "raw/$BATCH_ID/coins.parquet"
aws s3api head-object \\
  --bucket "$BUCKET" \\
  --key "raw/$BATCH_ID/market_data.parquet"
\`\`\`

CloudShell's identity uploads and checks the source files. MotherDuck's scoped S3 secret is the identity that reads them during the query.

## Make the flow fail before it writes a bad pair

This small flow is an ECS connection check for the dummy batch. It checks both file counts and the \`coin_uniq_key\` reference before replacing either development table. It is not a substitute for the local validator, which also checks the full schema, duplicate keys, timestamps, and numeric constraints.

\`\`\`python
import os
import re

import duckdb
from prefect import flow, get_run_logger


@flow(name="market-data-ecs-connection-check")
def ingest_pair(bucket: str, batch_id: str) -> None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{2,62}", bucket):
        raise ValueError("invalid bucket")
    if not re.fullmatch(r"[0-9]{8}T[0-9]{6}Z", batch_id):
        raise ValueError("invalid batch ID")

    token = os.environ["MOTHERDUCK_TOKEN"]
    base = f"s3://{bucket}/raw/{batch_id}"
    coins = f"{base}/coins.parquet"
    market = f"{base}/market_data.parquet"
    con = duckdb.connect(
        "md:market_data_dev",
        config={"motherduck_token": token},
    )
    try:
        coin_count = con.sql(
            f"SELECT count(*) FROM read_parquet('{coins}')"
        ).fetchone()[0]
        market_count = con.sql(
            f"SELECT count(*) FROM read_parquet('{market}')"
        ).fetchone()[0]
        orphans = con.sql(f"""
            SELECT count(*)
            FROM read_parquet('{market}') AS md
            LEFT JOIN read_parquet('{coins}') AS c
              ON c.uniq_key = md.coin_uniq_key
            WHERE c.uniq_key IS NULL
        """).fetchone()[0]

        if (coin_count, market_count, orphans) != (2, 1000, 0):
            raise ValueError("dummy pair failed validation")

        con.sql(
            f"CREATE OR REPLACE TABLE coins AS SELECT * FROM read_parquet('{coins}')"
        )
        con.sql(
            f"CREATE OR REPLACE TABLE market_data AS SELECT * FROM read_parquet('{market}')"
        )
        get_run_logger().info(
            "accepted batch=%s coins=%s market_data=%s",
            batch_id, coin_count, market_count,
        )
    finally:
        con.close()
\`\`\`

The bucket and batch ID are checked before they become part of the S3 paths. Keep these flow parameters constrained to the intended test bucket and prefix in the deployment too. For production ingestion, call the full pair validator and quarantine the batch before either Bronze table changes.

## Build and deploy the ECS run

In the repository that contains \`flow.py\`, keep the dependencies locked. The spike used DuckDB 1.5.5; export the resolved project dependencies to a requirements file and build that into the image:

\`\`\`bash
uv lock
uv export --no-hashes --no-emit-project -o requirements.txt
\`\`\`

\`\`\`dockerfile
FROM python:3.12-slim
WORKDIR /opt/market-data
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY flow.py .
\`\`\`

Log Docker into ECR from a machine with the approved AWS profile. Use the ECR repository created for the pool, or create one in the selected account first. This example targets Linux AMD64 Fargate tasks:

\`\`\`bash
export AWS_REGION='<aws-region>'
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export ECR_REPOSITORY='market-data'
export IMAGE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:ecs-check"

aws ecr get-login-password --region "$AWS_REGION" \\
  | docker login --username AWS --password-stdin \\
      "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker buildx build --platform linux/amd64 --push -t "$IMAGE" .
\`\`\`

Point the ECS push pool at that image tag. For a sandbox account, Prefect documents an automatic setup command:

\`\`\`bash
prefect work-pool create \\
  --type ecs:push \\
  --provision-infra \\
  market-data-ecs
\`\`\`

This provisions AWS resources and creates a Prefect \`AWSCredentials\` block. Review the resources and permissions it proposes before running it in an account with existing workloads. For a controlled environment, use the existing approved VPC, subnets, ECR, IAM roles, and Secrets Manager entries, then configure the ECS push pool's job template to use them.

The deployment can keep the flow parameters and pool name in \`prefect.yaml\`:

\`\`\`yaml
deployments:
  - name: market-data-ecs-check
    entrypoint: flow.py:ingest_pair
    parameters:
      bucket: <private-bucket-name>
      batch_id: 20261001T000000Z
    work_pool:
      name: market-data-ecs
      job_variables:
        image: <account>.dkr.ecr.<region>.amazonaws.com/market-data:<tag>
\`\`\`

Set the ECS task definition and network settings in the pool's base job template, then deploy from the flow repository:

\`\`\`bash
uv run prefect deploy --all
\`\`\`

The sample image field is a job variable; check the pool's template for the exact variable names it exposes. Keep the task's secret references in its ECS task definition so the values enter the container only when ECS starts it.

## Record the first run as evidence

Start with the valid pair. In Prefect Cloud, confirm the run reached the ECS task and completed. Query the dev database for two coins and 1,000 market-data rows. Check that the flow log contains the batch ID and counts, with no token values or market rows.

Then point a second test run at a deliberately invalid pair, such as a Parquet file with an unknown \`coin_uniq_key\`. The flow should fail validation before either table is replaced. Verify the previous accepted counts remain intact. Also inspect the ECS task logs and Prefect run details to confirm the error identifies the batch and validation check without exposing secrets.

That pair of runs will close the gap left by the spike: one proves the ECS task can reach Prefect and MotherDuck with runtime credentials; the other proves invalid input stops before the dev tables change. Until those runs happen, this remains the acceptance plan.

## References

- [Previous: AWS, Prefect, and MotherDuck connection spike](/notes/2026-10-01-motherduck-prefect-aws-connection-spike)
- [Previous: Deploying the market-data flow with AWS, Prefect Cloud, and MotherDuck](/notes/2026-09-30-motherduck-aws-prefect-cloud-deployment)
- [Prefect: serverless deployment infrastructure and ECS push pools](https://docs.prefect.io/v3/how-to-guides/deployment_infra/serverless)
- [Prefect: define deployments with \`prefect.yaml\`](https://docs.prefect.io/v3/how-to-guides/deployments/prefect-yaml)
- [AWS: ECS task IAM roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [AWS: passing Secrets Manager secrets to ECS containers](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html)
- [MotherDuck: create and configure service accounts](https://motherduck.com/docs/key-tasks/service-accounts-guide/create-and-configure-service-accounts/)
- [MotherDuck: configure Amazon S3 access](https://motherduck.com/docs/integrations/cloud-storage/amazon-s3/)
`;export{e as default};