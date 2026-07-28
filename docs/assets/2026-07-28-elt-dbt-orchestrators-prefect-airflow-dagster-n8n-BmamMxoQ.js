var e=`---
title: "ELT with dbt Across Prefect, Airflow, Dagster, and n8n"
date: 2026-07-28
tags: [elt, dbt, orchestration, prefect, airflow, dagster, n8n, data-engineering]
series: data-engineering
summary: "dbt handles warehouse transformations, but an ELT pipeline still needs orchestration. Prefect, Airflow, Dagster, and n8n can all run dbt, but they fit different operating styles: Python flows, task DAGs, asset graphs, and automation workflows."
---

# ELT with dbt Across Prefect, Airflow, Dagster, and n8n

dbt is good at the T in ELT.

It turns raw and staging tables into tested, documented, dependency-aware models. It knows that \`mart__portfolio_exposure\` depends on \`stg_coingecko__prices\`, which depends on a raw source. It can run tests, build docs, and materialize models in the warehouse.

But dbt is not the whole pipeline.

An ELT pipeline also needs to:

\`\`\`text
extract data
load raw records
wait for files or upstream systems
run dbt commands
handle retries
send alerts
trigger backfills
record run metadata
coordinate downstream reports
\`\`\`

That is orchestration.

The orchestrator decides when work runs, what happens before dbt, what happens after dbt, how failures are retried, and what operators see when something breaks.

Prefect, Airflow, Dagster, and n8n can all sit around dbt. They just think about orchestration differently.

## dbt's role in ELT

In an ELT setup, the usual shape is:

\`\`\`text
extract -> load raw -> dbt staging -> dbt marts -> reports
\`\`\`

For a crypto pipeline:

\`\`\`text
CoinGecko API -> raw_coingecko__coins_markets -> stg_coingecko__coins_markets -> mart__asset_prices
exchange CSV -> raw_exchange__balances -> stg_exchange__balances -> mart__portfolio_exposure
CDC stream -> raw_cdc__transactions -> stg_product__transactions -> mart__report_line_items
\`\`\`

dbt should own the SQL modeling boundary:

\`\`\`text
source declarations
staging models
intermediate models
marts
tests
docs
exposures
semantic descriptions
\`\`\`

The orchestrator should own the workflow boundary:

\`\`\`text
schedules
dependencies outside dbt
extract and load jobs
secrets and runtime config
retries
alerts
backfills
run logs
handoffs to reports or agents
\`\`\`

The clean setup does not ask the orchestrator to rewrite dbt's model graph. It asks the orchestrator to run dbt at the right time with the right context.

## Prefect: Python-first flows

Prefect's core idea is simple: write workflows as Python functions.

Its main building blocks are:

\`\`\`text
flow        a workflow
task        a unit of work inside a flow
deployment  a scheduled or remotely runnable flow configuration
work pool    infrastructure target for running flows
state        tracked result of each run or task
block        stored configuration or credentials
\`\`\`

This makes Prefect feel natural when extraction logic is already Python.

For a crypto ELT pipeline, a Prefect flow might do:

\`\`\`text
fetch CoinGecko prices
write raw records
load exchange CSV
check raw counts
run dbt build
send alert if freshness fails
\`\`\`

With \`prefect-dbt\`, dbt can be invoked from a Prefect flow. The simple version is a Python flow that calls \`dbt build\`. More advanced usage can surface dbt node observability and let Prefect coordinate more of the execution.

Example shape:

\`\`\`python
from prefect import flow, task
from prefect_dbt import PrefectDbtRunner

@task(retries=2)
def extract_coingecko_prices():
    ...

@task
def load_raw_prices(records):
    ...

@flow
def crypto_elt_flow():
    records = extract_coingecko_prices()
    load_raw_prices(records)
    PrefectDbtRunner().invoke(["build", "--select", "tag:crypto_prices"])
\`\`\`

Use Prefect when:

\`\`\`text
the pipeline is Python-heavy
you want fast local development
you need flexible API calls before dbt
you want simple retries and observability without a lot of ceremony
your team is small and wants code-first orchestration
\`\`\`

Prefect fits solo or small-team crypto pipelines well because the first version can stay close to normal Python code.

## Airflow: task DAGs and operational maturity

Airflow's core model is a DAG: a directed acyclic graph of tasks.

Its main building blocks are:

\`\`\`text
Dag          workflow definition
task         unit of work
operator     template for a task
sensor       task that waits for something
scheduler    triggers workflow runs
executor     runs tasks through workers
connection   stored external system credential
XCom         small task-to-task communication
\`\`\`

Airflow is task-based. A DAG defines dependencies and execution order. Tasks run commands, call APIs, wait for files, start jobs, and execute checks.

For dbt, the blunt approach is a \`BashOperator\`:

\`\`\`python
dbt_build = BashOperator(
    task_id="dbt_build",
    bash_command="dbt build --select tag:daily_nav",
    cwd="/opt/airflow/include/dbt/crypto_project",
)
\`\`\`

That works, but it treats dbt as one big task.

A better Airflow setup often uses Astronomer Cosmos. Cosmos parses a dbt project and turns dbt models into Airflow tasks or task groups. That gives Airflow visibility into the dbt graph instead of hiding all transformation work behind one shell command.

Airflow with Cosmos can look like:

\`\`\`text
extract prices task
load raw prices task
dbt task group generated from selected dbt models
dbt tests
publish report task
\`\`\`

Use Airflow when:

\`\`\`text
the organization already runs Airflow
you need mature scheduling, sensors, retries, and operational controls
you have many systems to coordinate
you need team-owned DAGs and production-grade workflow operations
you want dbt models visible as tasks through Cosmos
\`\`\`

Airflow is strong when the pipeline is part of a larger operational platform. It is heavier than a small Prefect setup, but it has a deep ecosystem.

## Dagster: asset-based orchestration

Dagster's core idea is assets.

An asset is something materialized in storage:

\`\`\`text
raw price table
staging model
mart table
report snapshot
Parquet file
feature table
\`\`\`

Its main building blocks are:

\`\`\`text
asset        declared data object
op           computation step
job          executable selection of assets or ops
resource     external system or dependency
partition    time or category slice
sensor       reacts to external events
schedule     triggers materializations
asset check  data quality or validation check
\`\`\`

Dagster is asset-based. Instead of only asking "which tasks run in what order?", it asks "which data assets exist, and how are they produced?"

That maps nicely to ELT.

For dbt, \`dagster-dbt\` can load dbt models as Dagster assets from the dbt manifest. A dbt model becomes part of the Dagster asset graph. That means Dagster can show lineage across Python assets and dbt assets.

Example shape:

\`\`\`python
from dagster import asset
from dagster_dbt import dbt_assets, DbtCliResource

@asset
def raw_coingecko_prices():
    ...

@dbt_assets(manifest="target/manifest.json")
def crypto_dbt_assets(context, dbt: DbtCliResource):
    yield from dbt.cli(["build"], context=context).stream()
\`\`\`

For a crypto pipeline, Dagster can represent:

\`\`\`text
raw_coingecko_prices
stg_coingecko__prices
mart__asset_prices
mart__portfolio_exposure
regulatory_report_snapshot
\`\`\`

Use Dagster when:

\`\`\`text
lineage is central
the team thinks in datasets, not jobs
you need partitions and backfills by date or asset
you want dbt models and Python assets in one graph
you care about asset checks and materialization metadata
\`\`\`

Dagster is a strong fit when the ELT pipeline is really a data product graph.

## n8n: workflow automation and glue

n8n is a workflow automation tool built around nodes.

Its main building blocks are:

\`\`\`text
workflow      connected automation
node          action or trigger step
trigger       event or schedule starter
credential    stored integration secret
expression    dynamic value from prior nodes
execution     run history
\`\`\`

n8n is not a data orchestrator in the same sense as Airflow or Dagster. It is more of an automation platform.

That can still be useful in ELT.

For dbt, n8n commonly fits around dbt rather than inside dbt. It can:

\`\`\`text
trigger a dbt Cloud job through an HTTP request
call a webhook after an exchange file lands
run a command on a self-hosted worker
send Slack or email alerts
open a review ticket after a dbt test fails
call an MCP or internal API after a mart refresh
\`\`\`

Example workflow:

\`\`\`text
Schedule trigger
-> HTTP request to start dbt Cloud job
-> wait or poll job status
-> if failed, create data quality review task
-> notify Slack
\`\`\`

Use n8n when:

\`\`\`text
the workflow is mostly integration glue
non-engineers need to inspect or modify automations
you want quick alerts, tickets, webhooks, or approval flows
the heavy data work already runs elsewhere
\`\`\`

n8n is usually not where I would put the full dbt dependency graph for a financial pipeline. It is better as the edge automation layer around the pipeline.

## Side-by-side comparison

\`\`\`text
Tool      Core model        Best dbt fit
Prefect   Python flows      run dbt inside Python flows with prefect-dbt
Airflow   task DAGs         run dbt through Cosmos or dbt Cloud operators
Dagster   data assets       load dbt models as software-defined assets
n8n       workflow nodes    trigger dbt jobs and handle edge automation
\`\`\`

Operational comparison:

\`\`\`text
Prefect
Good for: Python-heavy ELT, small teams, fast iteration, API extraction.
Watch out: teams must still design data lineage and asset boundaries clearly.

Airflow
Good for: mature scheduled operations, sensors, many integrations, larger teams.
Watch out: dbt as one Bash task hides model-level visibility unless using Cosmos or similar.

Dagster
Good for: asset lineage, partitions, backfills, dbt plus Python assets.
Watch out: requires the team to adopt asset-based thinking.

n8n
Good for: lightweight automation, alerts, approvals, webhooks, SaaS glue.
Watch out: not ideal as the main orchestrator for complex dbt model graphs.
\`\`\`

## Crypto ELT examples

For a small solo crypto project:

\`\`\`text
Prefect extracts CoinGecko and exchange data.
Raw records land in Postgres or object storage.
Prefect runs dbt build.
dbt creates marts.
Prefect sends a freshness alert.
\`\`\`

This is a simple and practical setup.

For a company already on Airflow:

\`\`\`text
Airflow waits for replicated production data.
Airflow runs exchange ingestion tasks.
Cosmos turns dbt models into Airflow tasks.
Airflow runs report publish tasks.
Airflow alerts on failed freshness checks.
\`\`\`

This fits teams that already operate Airflow and need central scheduling.

For a data-platform-style crypto system:

\`\`\`text
Dagster models raw files, staging tables, marts, and report snapshots as assets.
dagster-dbt imports dbt models into the asset graph.
Partitions represent report dates.
Asset checks validate freshness and reconciliation.
Backfills materialize selected dates.
\`\`\`

This fits teams that care deeply about lineage and point-in-time rebuilds.

For operational glue:

\`\`\`text
n8n watches for a failed dbt Cloud job.
n8n creates a data quality review item.
n8n posts to Slack.
n8n asks for approval before triggering a backfill API.
\`\`\`

This fits approval workflows around the pipeline, not the core transformation graph.

## How I would choose

If I were starting a small crypto ELT pipeline, I would start with Prefect plus dbt.

It keeps extraction and orchestration in Python, runs locally without much ceremony, and is enough for scheduled ingestion, raw landing, dbt builds, retries, and alerts.

If the company already has Airflow, I would use Airflow with Cosmos rather than invent a separate orchestration stack.

If lineage, partitions, and report-date backfills are the center of the system, I would look hard at Dagster.

If the job is mostly "when this fails, notify someone and open a review task," I would use n8n around the pipeline, not as the pipeline's source of truth.

## The practical rule

dbt should own transformation logic.

The orchestrator should own workflow behavior.

Pick the orchestrator based on the shape of the work:

\`\`\`text
Python-first work        Prefect
task operations          Airflow
asset lineage            Dagster
workflow automation      n8n
\`\`\`

For financial and crypto ELT, the best setup is the one that makes failures explainable:

\`\`\`text
which extraction ran
which raw records landed
which dbt models built
which tests failed
which reports changed
which backfill should run
who needs to review it
\`\`\`

That is the real goal. The orchestrator is there to make the pipeline observable, repeatable, and recoverable.

## References

- [dbt documentation](https://docs.getdbt.com/docs/introduction)
- [Prefect dbt integration](https://docs.prefect.io/integrations/prefect-dbt)
- [Prefect dbt model orchestration example](https://docs.prefect.io/v3/examples/run-dbt-with-prefect)
- [Apache Airflow core concepts](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/)
- [Astronomer: Orchestrate dbt Core projects with Airflow and Cosmos](https://www.astronomer.io/docs/learn/airflow-dbt/)
- [Astronomer Cosmos: How Cosmos works](https://astronomer.github.io/astronomer-cosmos/getting_started/how-cosmos-works.html)
- [Dagster software-defined assets](https://docs.dagster.io/guides/build/assets/defining-assets)
- [Dagster dbt integration reference](https://docs.dagster.io/integrations/libraries/dbt/reference)
- [n8n core concepts](https://docs.n8n.io/workflows/)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
- [What Is ELT and ETL](/posts/2026-07-21-what-is-etl-and-elt)
`;export{e as default};