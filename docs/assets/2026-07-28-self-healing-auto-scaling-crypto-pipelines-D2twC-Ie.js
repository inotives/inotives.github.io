var e=`---
title: "Self-Healing, Auto-Scaling Crypto Data Pipelines"
date: 2026-07-28
tags: [data-engineering, crypto, orchestration, prefect, dagster, reliability, autoscaling]
series: data-engineering
summary: "Near-zero downtime in crypto data pipelines comes from retryable ingestion, partitioned recovery, autoscaling workers, idempotent writes, freshness checks, and clear rollback paths. Prefect and Dagster give different ways to build that operating model."
---

# Self-Healing, Auto-Scaling Crypto Data Pipelines

Near-zero downtime is not magic.

It usually means the pipeline fails in small places, recovers automatically when it can, and tells a human when it cannot.

Crypto pipelines need this because the inputs are messy:

\`\`\`text
exchange APIs timeout
rate limits change
CoinGecko returns partial data
wallet balances arrive late
CDC streams lag
provider symbols move
chains pause
backfills collide with daily jobs
\`\`\`

A fragile pipeline treats each failure like a production incident. A resilient pipeline expects some of these failures every day.

The goal is not "never fail." The goal is:

\`\`\`text
keep raw ingestion running
avoid corrupting trusted marts
retry safe failures automatically
scale workers when backlog grows
isolate broken partitions
publish only validated reports
leave enough evidence to debug the run
\`\`\`

That is what self-healing and auto-scaling should mean in data engineering.

## What self-healing means

Self-healing is the pipeline's ability to recover from known failure modes without a person manually restarting everything.

Common examples:

\`\`\`text
retry a timed-out API request
resume a failed partition
skip one broken asset without stopping unrelated assets
move bad rows into quarantine
rerun only affected dbt models
delay downstream reports when freshness fails
open a review task for repeated mapping errors
\`\`\`

Self-healing does not mean the pipeline silently fixes business logic. If the system cannot prove the recovery is safe, it should stop at a controlled boundary.

For financial data, the line is simple:

\`\`\`text
safe to retry     network timeout, temporary 429, worker crash before commit
needs review      wrong asset mapping, duplicate balance, unexplained reconciliation gap
must block        report-critical mart failed validation
\`\`\`

The pipeline can heal infrastructure failures. It should not invent financial truth.

## What auto-scaling means

Auto-scaling is the ability to add or remove compute based on workload.

In crypto data, workload is uneven:

\`\`\`text
daily price jobs are small
month-end reporting is heavier
exchange backfills can fan out across accounts
chain event ingestion may spike after congestion clears
provider outage recovery can create a backlog
\`\`\`

Auto-scaling should protect throughput without overwhelming the warehouse, provider API, or downstream reports.

Scaling everything blindly is how teams create a bigger outage.

The better pattern is controlled scaling:

\`\`\`text
scale workers for independent partitions
limit concurrent calls per provider
limit warehouse-heavy dbt models
separate daily jobs from backfills
queue low-priority work behind report-critical work
\`\`\`

For a crypto pipeline, the bottleneck may be the provider rate limit, not CPU. Ten more workers do not help if CoinGecko allows fewer requests than that.

## The reliability shape

A resilient ELT pipeline usually looks like this:

\`\`\`text
extract source data
write append-only raw records
validate raw envelope
stage and normalize
quarantine bad rows
build marts
run data quality checks
publish reports
record run metadata
\`\`\`

Each step needs a recovery rule.

\`\`\`text
extract failed       retry with backoff
raw write failed     retry idempotently using payload hash and run id
staging failed       isolate bad rows and fail affected model
mart check failed    block report publication
report failed        keep previous published version active
\`\`\`

This is where most "self-healing" designs go wrong. They add retries but forget idempotency. Then every retry risks duplicate rows.

A retryable job must be safe to run twice.

## Idempotency is the foundation

If a pipeline cannot repeat a step safely, retries are dangerous.

Raw ingestion should have stable keys:

\`\`\`text
provider
endpoint
request parameters
provider timestamp
payload hash
run id
\`\`\`

Example raw table shape:

\`\`\`sql
create table raw_coingecko_market_prices (
    raw_id bigserial primary key,
    run_id text not null,
    provider text not null default 'coingecko',
    endpoint text not null,
    request_params jsonb not null,
    provider_observed_at timestamptz,
    ingested_at timestamptz not null default now(),
    payload_hash text not null,
    payload jsonb not null,
    unique (provider, endpoint, request_params, payload_hash)
);
\`\`\`

That unique key turns a retry from a duplicate write into a no-op or an upsert decision.

For exchange balances:

\`\`\`text
exchange
account_id
snapshot_id
asset_id
provider_balance_id
\`\`\`

For chain events:

\`\`\`text
chain_id
block_number
transaction_hash
log_index
\`\`\`

Good keys make healing boring. Bad keys make every retry an accounting problem.

## Prefect example: flow-based recovery

Prefect fits pipelines where extraction and loading are Python-heavy.

A Prefect setup can use:

\`\`\`text
tasks          retryable Python units
flows          the pipeline workflow
task runners   concurrent or parallel execution
work pools     infrastructure target for workers
deployments    schedules and runtime configuration
states         success, failure, retry, cancellation, crash tracking
\`\`\`

For a crypto ingestion flow:

\`\`\`python
from prefect import flow, task

@task(retries=3, retry_delay_seconds=[30, 120, 300])
def fetch_market_page(page: int):
    ...

@task
def write_raw_prices(records):
    ...

@task
def quarantine_bad_rows(run_id: str):
    ...

@task
def run_dbt_prices(run_id: str):
    ...

@flow
def coingecko_prices_flow(run_id: str, pages: list[int]):
    records = fetch_market_page.map(pages)
    write_raw_prices(records)
    quarantine_bad_rows(run_id)
    run_dbt_prices(run_id)
\`\`\`

This is a good self-healing shape because the failure boundary is small. One page can retry. The raw writer can use a payload hash to avoid duplicates. dbt only runs after raw loading finishes.

Auto-scaling with Prefect usually means:

\`\`\`text
run workers in a work pool
increase worker replicas when scheduled work piles up
use task runners for parallel page/account/partition work
set concurrency limits per provider or resource
\`\`\`

For example:

\`\`\`text
CoinGecko requests      max 3 concurrent tasks
exchange balance pulls  max 1 per exchange account
dbt mart builds         max 2 warehouse-heavy tasks
backfills               separate low-priority work pool
\`\`\`

Prefect is a good fit when you want the recovery logic close to the Python code.

## Dagster example: asset-based recovery

Dagster fits pipelines where the main concern is the state of data assets.

A Dagster setup can use:

\`\`\`text
assets         tables, files, snapshots, reports
sensors        react to new data or failed conditions
schedules      time-based runs
partitions     date, account, chain, or asset slices
asset checks   freshness, schema, reconciliation, row count checks
backfills      controlled rematerialization of old partitions
concurrency    run and asset execution limits
\`\`\`

For crypto, the asset graph might be:

\`\`\`text
raw_coingecko_prices
stg_coingecko__prices
mart__daily_asset_prices
mart__portfolio_exposure
report__daily_nav
\`\`\`

With partitions:

\`\`\`text
report_date = 2026-07-28
provider = coingecko
exchange = binance
chain_id = 1
\`\`\`

Dagster's advantage is that recovery can target the affected asset and partition.

If the \`2026-07-28\` CoinGecko price partition fails:

\`\`\`text
retry raw_coingecko_prices for 2026-07-28
materialize stg_coingecko__prices for 2026-07-28
run asset checks
rebuild only marts that depend on that partition
publish report only if checks pass
\`\`\`

That is cleaner than rerunning the whole project.

Asset checks can express reliability rules:

\`\`\`text
raw source observed within 30 minutes
staging row count is within expected range
canonical asset id is present
portfolio exposure reconciles to balances
report partition is fresh before publication
\`\`\`

Dagster is a good fit when lineage and partitioned recovery matter more than a simple Python flow.

## Keep daily work and backfills apart

Near-zero downtime usually fails when daily jobs and backfills share the same path.

Backfills are heavier. They touch more partitions, create more warehouse load, and often run after code or mapping changes.

Separate them:

\`\`\`text
daily work pool        current ingestion and report generation
backfill work pool     historical replay and correction runs
ad hoc work pool       manual investigation jobs
\`\`\`

Also separate priority:

\`\`\`text
daily report jobs beat historical replay
report-critical marts beat exploratory marts
source freshness checks beat dashboard refreshes
\`\`\`

In Prefect, this can be separate deployments and work pools.

In Dagster, this can be separate jobs, partition selections, backfill policies, and concurrency limits.

The principle is the same: a large backfill should not starve today's report.

## The self-healing loop

A practical self-healing loop has five steps:

\`\`\`text
detect
classify
retry
isolate
escalate
\`\`\`

Detect:

\`\`\`text
source freshness failed
API timeout rate increased
raw count dropped below threshold
dbt test failed
asset check failed
run exceeded expected duration
\`\`\`

Classify:

\`\`\`text
transient infrastructure failure
provider rate limit
bad source payload
mapping gap
business reconciliation failure
code regression
\`\`\`

Retry:

\`\`\`text
retry network calls with backoff
retry crashed workers
retry safe partitions
resume from last successful cursor
\`\`\`

Isolate:

\`\`\`text
quarantine bad rows
mark failed partitions
keep previous report version live
skip unrelated assets
\`\`\`

Escalate:

\`\`\`text
create data quality review task
request mapping approval
open backfill request
notify owner with run id and failure reason
\`\`\`

The loop should be explicit. "The orchestrator will retry it" is not a recovery design.

## Crypto example: provider outage

Say CoinGecko starts returning intermittent 500s during the daily price run.

Bad design:

\`\`\`text
one giant job fetches all assets
job fails halfway
rerun manually
duplicates raw rows
daily report publishes with partial data
\`\`\`

Better design:

\`\`\`text
1. Fetch pages or asset groups as independent retryable tasks.
2. Use payload hashes and provider keys for idempotent raw writes.
3. Keep source row counts by page and run id.
4. Mark failed pages as incomplete.
5. Block marts that require complete pricing.
6. Keep yesterday's report version active.
7. Retry failed pages after the provider recovers.
8. Rebuild only affected staging and mart partitions.
\`\`\`

Prefect handles this well as mapped tasks with retries and concurrency limits.

Dagster handles this well as partitioned assets with freshness checks and targeted materialization.

## Crypto example: exchange balance lag

Exchange balance snapshots are often slower than price data. Some accounts may return quickly. Others may timeout or lag behind.

The pipeline should not fail the entire platform because one non-reporting account is late.

A resilient setup:

\`\`\`text
one partition per exchange account
per-account retry policy
balance snapshot completeness check
quarantine duplicate or malformed balances
mart build waits only for report-critical accounts
non-critical account lag creates a warning
report-critical account lag blocks publication
\`\`\`

That severity split matters. The pipeline should know the difference between a stale sandbox account and a missing custody account used in a filing.

## What near-zero downtime actually needs

The orchestrator is only one part.

You also need:

\`\`\`text
append-only raw tables
idempotent loaders
quarantine tables
dbt tests or asset checks
run logs with run IDs
temporal mappings
report versioning
rollback or roll-forward procedures
separate daily and backfill queues
clear owner alerts
\`\`\`

Without those, Prefect or Dagster only gives you a nicer way to rerun a broken job.

With those, the orchestrator becomes the recovery control plane.

## Choosing Prefect or Dagster

Use Prefect when:

\`\`\`text
the pipeline is mostly Python extraction and loading
you want quick flow-based retries
you need mapped tasks for assets, pages, or accounts
you want simple worker pools and deployment schedules
your team prefers code that looks like normal Python
\`\`\`

Use Dagster when:

\`\`\`text
the pipeline is best described as data assets
lineage is important
partitions and backfills are common
asset checks should gate downstream reports
you want the UI to show what data is fresh, stale, failed, or materialized
\`\`\`

For a solo crypto project, I would usually start with Prefect if ingestion is still changing often.

For a reporting platform with point-in-time marts, backfills, and financial review, I would lean toward Dagster.

Both can work. The real difference is how your team thinks:

\`\`\`text
"run these steps"       Prefect
"materialize these assets"  Dagster
\`\`\`

## The rule

Self-healing is not "retry everything."

Auto-scaling is not "run everything at once."

For crypto data pipelines, the resilient version is more careful:

\`\`\`text
retry only safe failures
scale only independent work
block unsafe reports
preserve bad evidence
publish only validated outputs
\`\`\`

Near-zero downtime comes from making failures smaller, not pretending they will disappear.

## References

- [Prefect tasks](https://docs.prefect.io/v3/concepts/tasks)
- [Prefect task runners](https://docs.prefect.io/v3/concepts/task-runners)
- [Prefect work pools](https://docs.prefect.io/v3/how-to-guides/deployment_infra/manage-work-pools)
- [Dagster overview](https://docs.dagster.io/)
- [Dagster asset checks](https://docs.dagster.io/concepts/assets/asset-checks)
- [Dagster freshness checks](https://docs.dagster.io/concepts/assets/asset-checks/checking-for-data-freshness)
- [Dagster concurrency limits](https://docs.dagster.io/guides/limiting-concurrency-in-data-pipelines)
- [Backfills Without Breaking Crypto Reports](/posts/2026-07-23-backfills-without-breaking-crypto-reports)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [Validation, Version Control, and Rollback in Data Engineering](/posts/2026-07-28-validation-version-control-rollback-data-engineering)
`;export{e as default};