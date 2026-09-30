var e=`---
title: "Testing the AWS, Prefect, and MotherDuck connection before ECS"
date: 2026-10-01
tags: [data-engineering, motherduck, aws, prefect, ducklake, crypto-data]
summary: "Generate a dummy coins and market_data Parquet pair in AWS CloudShell, give MotherDuck scoped S3 access, and run the ingest through Prefect Cloud before building the ECS deployment."
series: building-motherduck-warehouse
---

The [previous deployment article](/notes/2026-09-30-motherduck-aws-prefect-cloud-deployment) drew the intended ECS path for our market-data flow. Before building that infrastructure, I ran a smaller connection spike. The question was narrow: can Prefect start a run that asks MotherDuck to read a Parquet object from our S3 bucket and write a queryable table backed by that bucket?

It worked. The spike also found two access rules that change the design: a reader of a shared DuckLake needs their own S3 access, and small writes can sit in the MotherDuck-managed catalog before they reach S3. Neither shows up in an architecture diagram.

## The path that actually ran

![The tested connection path: Prefect Serverless pulls the flow from a private repository and sends SQL to MotherDuck. MotherDuck reads source Parquet from S3 and writes DuckLake data to a separate S3 prefix.](/assets/images/motherduck-connection-spike-path.svg)

The Prefect container did not download the Parquet file or hold an AWS key. It sent SQL to MotherDuck. MotherDuck used an S3 secret to read the source and another scoped secret to write the DuckLake data. The repository supplied the flow code when the container started; Prefect Cloud held the deployment and run record.

This is a different compute location from the ECS push pool in the previous article. Serverless let me test the connection without deploying a VPC, image, or task. It did not test ECS networking, task roles, or Secrets Manager injection. The code below adapts the spike to our \`coins\` and \`market_data\` contract; the actual spike used a smaller probe file.

## Put a dummy pair in S3 from CloudShell

Open AWS CloudShell in the bucket's region. This uses the existing private, versioned bucket from the [deployment setup](/notes/2026-09-30-motherduck-aws-prefect-cloud-deployment). The two files share one batch ID, just as they did in the local flow. CloudShell's AWS identity uploads them; it is not the identity MotherDuck will use to read them.

\`\`\`bash
export BUCKET='<your-private-bucket>'
export SPIKE_REGION='<bucket-region>'
export BATCH_ID='20261001T000000Z'
python3 -m venv .venv
source .venv/bin/activate
python -m pip install 'duckdb==1.5.5'
python - <<'PY'
import duckdb

duckdb.sql("""
COPY (SELECT id::INTEGER AS id, 'coin-' || id AS uniq_key,
             CASE id WHEN 1 THEN 'Bitcoin' ELSE 'Ether' END AS name
      FROM range(1, 3) AS t(id))
TO 'coins.parquet' (FORMAT PARQUET)
""")
duckdb.sql("""
COPY (SELECT CASE WHEN i % 2 = 0 THEN 'coin-1' ELSE 'coin-2' END AS coin_uniq_key,
             TIMESTAMP '2026-10-01 00:00:00' + i * INTERVAL '1 minute' AS time_open,
             TIMESTAMP '2026-10-01 00:01:00' + i * INTERVAL '1 minute' AS time_close,
             TIMESTAMP '2026-10-01 00:00:20' + i * INTERVAL '1 minute' AS time_high,
             TIMESTAMP '2026-10-01 00:00:40' + i * INTERVAL '1 minute' AS time_low,
             TIMESTAMP '2026-10-01 00:01:00' + i * INTERVAL '1 minute' AS "timestamp",
             CASE WHEN i % 2 = 0 THEN 'Bitcoin' ELSE 'Ether' END AS name,
             100.00::DECIMAL(18,2) AS "open", 105.00::DECIMAL(18,2) AS high,
             95.00::DECIMAL(18,2) AS low, 102.00::DECIMAL(18,2) AS "close",
             10.00::DECIMAL(18,2) AS volume,
             1000000.00::DECIMAL(18,2) AS market_cap,
             10000.00::DECIMAL(18,2) AS circulating_supply
      FROM range(1000) AS t(i))
TO 'market_data.parquet' (FORMAT PARQUET)
""")
print(duckdb.sql("SELECT count(*) FROM read_parquet('coins.parquet')").fetchone()[0])
print(duckdb.sql("SELECT count(*) FROM read_parquet('market_data.parquet')").fetchone()[0])
PY
aws s3 cp coins.parquet "s3://$BUCKET/raw/$BATCH_ID/coins.parquet"
aws s3 cp market_data.parquet "s3://$BUCKET/raw/$BATCH_ID/market_data.parquet"
aws s3 ls "s3://$BUCKET/raw/$BATCH_ID/"
\`\`\`

Expect two and 1,000 rows, then two objects in S3. These are invented prices and two invented coin keys; the point is to exercise the path and the cross-file reference, not to test market-data semantics.

## Give MotherDuck its own credentials

The MotherDuck token authenticates the flow to MotherDuck. An AWS access key authorizes MotherDuck to read the private source and write its DuckLake data. They are separate credentials. In MotherDuck, create a dedicated service account under Settings → Service accounts and copy its read/write token when shown. Enter it in CloudShell without putting the value in a command or a file:

\`\`\`bash
read -rsp 'MotherDuck token: ' motherduck_token; echo
export motherduck_token
python - <<'PY'
import duckdb
print(duckdb.connect('md:').sql('SELECT 1').fetchone())
PY
\`\`\`

Give the AWS identity used by MotherDuck \`s3:GetObject\` on \`raw/*\`, and \`s3:GetObject\`, \`s3:PutObject\`, and \`s3:DeleteObject\` on \`ducklake/market-spike/*\`. Limit \`s3:ListBucket\` to those prefixes. Create its access key in AWS. Back in the same CloudShell session, register two nonoverlapping S3 secrets through the service-account connection. The key values stay out of \`flow.py\`, \`prefect.yaml\`, and Git.

\`\`\`bash
read -rp 'Scoped AWS key ID: ' S3_KEY_ID
read -rsp 'Scoped AWS secret key: ' S3_SECRET_KEY; echo
export S3_KEY_ID S3_SECRET_KEY
python - <<'PY'
import os
import duckdb

con = duckdb.connect('md:')  # uses motherduck_token from the environment
for name, prefix in [('raw_reader', 'raw/'),
                     ('lake_writer', 'ducklake/market-spike/')]:
    con.sql(f"""
        CREATE SECRET {name} IN MOTHERDUCK (
          TYPE S3, KEY_ID '{os.environ['S3_KEY_ID']}',
          SECRET '{os.environ['S3_SECRET_KEY']}',
          REGION '{os.environ['SPIKE_REGION']}',
          SCOPE 's3://{os.environ['BUCKET']}/{prefix}'
        )
    """)
con.sql(f"""CREATE DATABASE market_spike (
    TYPE DUCKLAKE,
    DATA_PATH 's3://{os.environ['BUCKET']}/ducklake/market-spike/'
)""")
con.close()
PY
unset S3_KEY_ID S3_SECRET_KEY
\`\`\`

MotherDuck manages this database's catalog; S3 holds its Parquet data. The previous article also described a self-hosted catalog inside AWS, which this spike did not build. Before involving Prefect, run the same read and write by hand through the service-account token in CloudShell:

\`\`\`bash
python - <<'PY'
import os
import duckdb

con = duckdb.connect('md:market_spike')
base = f"s3://{os.environ['BUCKET']}/raw/{os.environ['BATCH_ID']}"
for table in ('coins', 'market_data'):
    source = f"{base}/{table}.parquet"
    con.sql(f"CREATE OR REPLACE TABLE {table} AS "
            f"SELECT * FROM read_parquet('{source}')")
    print(table, con.sql(f"SELECT count(*) FROM {table}").fetchone()[0])
con.close()
PY
\`\`\`

Check the source counts, the MotherDuck counts, and \`aws s3 ls "s3://$BUCKET/ducklake/market-spike/" --recursive\` back in CloudShell. The 1,000-row table should produce a new object; the two-row \`coins\` table may be inlined in the catalog. A successful SQL statement by itself does not prove where the data landed.

For the isolation check, I used the first identity's AWS key to request a *known, existing* object under the second identity's prefix. AWS denied both listing the other prefix and reading that object. Testing a nonexistent path would have produced an unhelpful denial. Testing from a MotherDuck session would also have missed the boundary, because MotherDuck secrets are available at the account level in this setup. The boundary under test was the AWS key's IAM policy.

## Then let Prefect run the same ingest

In a private repository, \`flow.py\` repeats the source checks and the two table writes. It loads the MotherDuck token from a Prefect Secret block at run time. The bucket and batch ID are flow parameters, so a later run can choose another dummy batch without relying on the Serverless job-variable override that failed in this spike.

\`\`\`python
# flow.py: connection check, not the full Bronze validator
import os
import re

import duckdb
from prefect import flow, get_run_logger
from prefect.blocks.system import Secret


@flow(name="market-connection-spike")
def ingest_pair(bucket: str, batch_id: str) -> None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{2,62}", bucket):
        raise ValueError("invalid bucket")
    if not re.fullmatch(r"[0-9]{8}T[0-9]{6}Z", batch_id):
        raise ValueError("invalid batch ID")

    os.environ["motherduck_token"] = Secret.load("motherduck-spike").get()
    con = duckdb.connect("md:market_spike")
    base = f"s3://{bucket}/raw/{batch_id}"
    coins = f"{base}/coins.parquet"
    market = f"{base}/market_data.parquet"
    try:
        coin_count = con.sql(f"SELECT count(*) FROM read_parquet('{coins}')").fetchone()[0]
        market_count = con.sql(f"SELECT count(*) FROM read_parquet('{market}')").fetchone()[0]
        orphans = con.sql(f"""
            SELECT count(*) FROM read_parquet('{market}') AS md
            LEFT JOIN read_parquet('{coins}') AS c
              ON c.uniq_key = md.coin_uniq_key
            WHERE c.uniq_key IS NULL
        """).fetchone()[0]
        if (coin_count, market_count, orphans) != (2, 1000, 0):
            raise ValueError("dummy pair failed the connection check")
        con.sql(f"CREATE OR REPLACE TABLE coins AS SELECT * FROM read_parquet('{coins}')")
        con.sql(f"CREATE OR REPLACE TABLE market_data AS SELECT * FROM read_parquet('{market}')")
        get_run_logger().info("loaded coins=%s market_data=%s", coin_count, market_count)
    finally:
        con.close()
\`\`\`

Create a Serverless work pool and two Secret blocks in the Prefect Cloud workspace: \`motherduck-spike\` holds the read/write MotherDuck token, and \`repo-read-token\` holds a fine-grained token limited to Contents: Read on this private repository. Log the local CLI into that workspace with \`prefect cloud login\`. In the uv-managed repo, pin DuckDB to \`1.5.5\` and run \`uv export --no-hashes --no-emit-project -o requirements.txt\` so Serverless installs the same locked dependencies. This \`prefect.yaml\` clones the code for each run:

\`\`\`yaml
name: market-connection-spike
pull:
  - prefect.deployments.steps.git_clone:
      id: repo
      repository: https://github.com/<user>/<private-repo>.git
      access_token: "{{ prefect.blocks.secret.repo-read-token }}"
  - prefect.deployments.steps.pip_install_requirements:
      directory: "{{ repo.directory }}"
      requirements_file: requirements.txt
deployments:
  - name: ingest-pair
    entrypoint: flow.py:ingest_pair
    work_pool:
      name: <serverless-pool>
    parameters:
      bucket: <your-private-bucket>
      batch_id: 20261001T000000Z
\`\`\`

Push \`flow.py\`, \`prefect.yaml\`, and \`requirements.txt\` to that private repo, run \`uv run prefect deploy --all\`, then use Deployments → ingest-pair → Run in Prefect Cloud. Drop the manually created test tables before the run, so Prefect must create them again. Check the two row counts, a fresh object under the DuckLake prefix, and the run logs. Prefect holds the MotherDuck token but no AWS key; MotherDuck reads and writes S3 itself.

I also pointed a test run at a missing source path. The flow failed, and the Prefect run log showed the source error and the SQL call site. That was useful evidence for the control plane: an operator could tell which hop failed without opening the container.

One configuration test gave a less comfortable result. On the Serverless deployment used for this spike, a run-level environment override was recorded on the run but did not replace the deployment value. A Prefect Secret reference placed in \`job_variables.env\` also resolved to a readable token in the saved deployment. The example above uses flow parameters and loads the secret inside the flow. On ECS, inject it from AWS Secrets Manager and retest any job-variable override before relying on it.

## Sharing the table exposed another credential boundary

I granted a second MotherDuck user a read-only share. They could see the database, but their query failed until their account also had a scoped S3 secret for the DuckLake data. The share conveyed catalog access, not the owner's bucket credential. After adding the reader's storage access, the query worked, while the other DuckLake database stayed outside their share.

![A shared DuckLake query needs both a MotherDuck share for catalog access and a scoped S3 secret for the underlying objects. Without the S3 secret the database is visible but the read fails; IAM denies the other prefix.](/assets/images/motherduck-ducklake-share-access.svg)

That makes analyst onboarding more than one \`GRANT\`: the reader needs MotherDuck access and a way to read the matching S3 prefix. It also means we should decide whether distributing AWS credentials to analysts is acceptable before promising this sharing model for restricted data.

I saw a separate storage wrinkle with a tiny write. The row was queryable, but no new Parquet object appeared in S3. DuckLake can inline small writes into its catalog and flush them later. If our requirement says every row must already be in our bucket, we need a flush and an S3 check in the acceptance test. "Bring your own bucket" by itself is not that guarantee.

## Apply the spike to the market-data flow

The example checks row counts and the coin reference only. The [full local validator](/notes/2026-09-29-motherduck-prefect-dbt-market-data-flow) also checks schemas, duplicates, types, timestamps, and negative values, then quarantines a bad pair before Bronze. Keep that gate when moving the real market-data dump to AWS. This spike proved the network and credential chain, not the full data-quality path.

The ECS version still needs its own check. There, the flow task should use an IAM task role for its direct S3 work, with the task execution role retrieving runtime secrets. If MotherDuck itself reads or writes S3, its S3 secret remains a separate credential boundary. I would repeat the source-to-table proof on ECS, verify the secret is absent from the deployment record and logs, and test a rejected market-data pair. Only then can the previous deployment design be called implemented.

## References

- [MotherDuck: DuckLake with your own S3 bucket and a MotherDuck-managed catalog](https://motherduck.com/blog/announcing-ducklake-support-motherduck-preview/)
- [MotherDuck: DuckLake data inlining and flushing](https://motherduck.com/blog/announcing-ducklake-1-0-on-motherduck/)
- [Prefect: serverless deployment infrastructure](https://docs.prefect.io/v3/how-to-guides/deployment_infra/serverless)
- [Prefect: store and load Secret blocks](https://docs.prefect.io/v3/how-to-guides/configuration/store-secrets)
- [Prefect: define deployments with prefect.yaml](https://docs.prefect.io/v3/how-to-guides/deployments/prefect-yaml)
- [AWS: getting started with CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/getting-started.html)
- [MotherDuck: create an access token and S3 secret](https://motherduck.com/blog/estuary-streaming-cdc-replication/)
- [AWS: IAM policy examples for S3 buckets](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-policies-s3.html)
- [AWS: Amazon ECS task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
`;export{e as default};