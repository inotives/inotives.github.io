---
title: "Data Engineering in 30 Days, Days 18–20: Orchestration, Testing, and Deployment Environments"
date: 2026-08-12
tags: [data-engineering, learning-path, orchestration, data-quality]
summary: "Why pipelines need orchestration, how Airflow, Dagster, Prefect, Argo, Step Functions, and Spark differ, and how to test code plus data across local development, staging, and production."
series: data-engineering-in-30-days
---

A pipeline with three commands is easy to run by hand. Production changes the question: what should run first, which data interval does it represent, what retries safely, what happens after a partial failure, and how do we prove that the tables are complete before another system uses them?

An orchestrator does not make data correct. It makes the work of running, observing, retrying, backfilling, and proving a pipeline explicit. Days 18–20 cover that operating layer, along with the tests and environments that prevent a green task from being mistaken for trustworthy data.

## The outcome for these three days

By the end, you should be able to:

1. Explain why scheduling alone is not orchestration.
2. Compare the common orchestration tools by their execution model and fit.
3. Choose an orchestrator from project constraints rather than popularity.
4. Test pipeline code, data integrity, and data completeness separately.
5. Promote the same pipeline through local development, staging, and production with increasing evidence.

## 1. Why a data pipeline needs an orchestrator

Consider the market-data pipeline built so far:

```text
fetch provider pages
  → retain raw payloads
  → load observations
  → run dbt staging models
  → build daily mart
  → check freshness and completeness
  → publish for dashboards and agents
```

`cron` can start one command at 09:00. It does not naturally model the dependency between these steps, the data interval being processed, a retry policy per step, a paused backfill, run logs, ownership, or a way to rerun only the failed database load.

An orchestrator usually provides these core capabilities:

| Capability | Why it matters |
| --- | --- |
| Dependency graph | A mart cannot safely build before its source load and staging models complete. |
| Schedule or event trigger | The system knows when a run should begin. |
| Run state | Each attempt is recorded as pending, running, succeeded, failed, skipped, or retried. |
| Retries and timeouts | Transient source failures get another controlled attempt; stuck work stops. |
| Backfills | Historical intervals can be processed deliberately without pretending they are current runs. |
| Logs and metadata | An operator can trace a bad table to the exact task, parameters, and source run. |
| Alerts and ownership | A failed or late pipeline reaches the person responsible for deciding what to do. |
| Concurrency controls | A retry storm or overlapping runs does not overload a source or duplicate data. |

The orchestrator should coordinate work, not become the place where every transformation lives. Keep durable business logic in dbt/SQL or a tested application module. A task should invoke that work, pass an explicit interval or configuration, and report the result.

## 2. Common orchestration choices

There is no single list that fits every team, but the tools below cover the most common patterns in current data platforms. Apache Spark is included because it is often mentioned in this decision; it is an execution engine, not a general orchestrator.

| Tool | Primary language or definition | Core concept | Strong fit | Watch out for |
| --- | --- | --- | --- | --- |
| Apache Airflow | Python-defined workflows | Scheduled task DAGs, operators, and task instances. | Established batch scheduling with many integrations and complex recurring dependencies. | Operational footprint and a task-centric model can feel heavy for a small project. |
| Dagster | Python | Data assets and their dependencies, plus jobs and schedules. | Teams that want lineage and observability centred on tables, files, and models. | A new asset-oriented mental model and platform conventions to adopt. |
| Prefect | Native Python | Flows and tasks with dynamic Python control flow and state. | Python-heavy teams, dynamic workflows, and a gentle path from local runs to deployment. | Less prescriptive structure means teams must set their own conventions. |
| Argo Workflows | Kubernetes custom resources, usually YAML; SDKs exist | Container-native DAGs or steps running on Kubernetes. | A Kubernetes-first platform with containerised Spark, ML, or batch workloads. | Kubernetes is a serious operational dependency, not a shortcut. |
| AWS Step Functions | Amazon States Language JSON/YAML; SDK integrations | Managed state machines that coordinate AWS services and code. | AWS-native event workflows, Lambda, ECS, Batch, and service integration. | Cloud coupling and state-machine definitions can be awkward for SQL-centric data graphs. |
| Apache Spark | Scala, Python, Java, SQL, and R APIs | Distributed execution for large-scale batch and streaming computation. | Transforming data that is too large for one machine or warehouse query. | Spark runs computation; it still needs a scheduler/orchestrator around jobs and dependencies. |

Other valid choices exist: managed Airflow services, cloud-native schedulers, Databricks Workflows, and warehouse-native task systems. The useful first question is not “which product is best?” It is “what work must coordinate, where does it execute, and what platform does the team already operate well?”

### Airflow: task DAGs for established batch systems

Airflow models a workflow as a directed acyclic graph of tasks. Its Python framework, scheduling semantics, UI, backfills, and large provider ecosystem make it a common choice when a team needs dependable recurring batch operations across many systems.

```text
extract_binance → load_raw → dbt_staging → dbt_mart → quality_gate
```

Choose Airflow when the project has clear batch intervals, several external systems, and a team ready to run or consume an Airflow platform. A mature data organisation with hundreds of scheduled pipelines often values its familiar operating model. Avoid choosing it merely for a single daily Python script; a managed scheduler or simpler flow runner may be enough.

### Dagster: assets first

Dagster treats a table, file, or model as an **asset** with dependencies, materialisations, and observable metadata. This maps naturally to a dbt-heavy data platform because the question is often “is this table fresh and trustworthy?” rather than “did task number four succeed?”

Choose Dagster for a project where the main deliverables are data assets and where lineage, partitions, asset checks, and ownership should be visible at the same level as execution. For example, a research platform can show that `mart_daily_market_price` depends on a provider landing table, a standardisation model, and an exchange calendar asset.

### Prefect: Python control flow first

Prefect turns ordinary Python functions into flows and tasks. It supports schedules, state tracking, retries, and deployment onto different execution environments while retaining native Python control flow.

Choose Prefect when a small Python team needs to orchestrate dynamic API jobs, conditional fan-out, or task counts discovered at runtime. For example, a provider list might be read at the start of a run, and one fetch task can be launched for each currently active provider. The flexibility is useful; use clear run parameters and idempotent tasks so that dynamic behaviour stays debuggable.

### Argo Workflows: Kubernetes is the execution contract

Argo Workflows runs container steps on Kubernetes and represents workflows as DAGs or sequences. Choose it when Kubernetes is already the platform boundary: each transformation has a container image, jobs require GPU or large compute pools, and operational ownership of the cluster already exists.

For example, a team may run an ingestion container, a dbt container, and a Spark container as separate Argo steps, passing artefacts through object storage. Do not introduce Kubernetes solely to orchestrate a few SQL models. The benefits arrive with existing container and cluster maturity.

### AWS Step Functions: managed service coordination

Step Functions coordinates AWS services through state machines. Choose it when the pipeline is tightly integrated with Lambda, ECS, AWS Batch, Glue, S3 events, and AWS-native identity and operations.

For example, an S3 landing event can start a state machine that validates a file, invokes a container task, triggers a warehouse load, and sends failure notification through AWS services. It is a strong service-integration choice. A team building a portable, warehouse-centred dbt graph may prefer an orchestrator that keeps the data graph closer to the codebase.

### Spark: compute engine, not the conductor

Spark processes large-scale batch and streaming workloads using APIs in Python, Scala, Java, SQL, and R. It can execute a complex job graph inside one application. It does not replace the outer concerns of when a provider ingestion run starts, which dbt models follow it, how a backfill is tracked, or how all pipeline services report one coherent run.

Choose Spark when the processing workload needs distributed compute: very large files, wide joins that cannot fit on one machine, streaming state, or an existing lakehouse platform. Use Airflow, Dagster, Prefect, Argo, or a managed platform to coordinate Spark with the rest of the pipeline when that coordination is needed.

## 3. Choose from the project, not a feature checklist

Use the smallest operationally credible tool that matches the project's constraints.

| Project situation | Likely first choice | Why |
| --- | --- | --- |
| One daily Python ingestion and a few dbt models | A simple managed scheduler or Prefect. | Low operational overhead; flow is mostly Python and SQL. |
| Many scheduled batch jobs across databases, files, APIs, and warehouses | Airflow. | Mature DAG scheduling, task retries, backfills, and broad integrations. |
| A data-product platform where tables, freshness, ownership, and lineage are first-class | Dagster. | Asset-oriented model makes the deliverables visible. |
| Containerised jobs already run on a well-operated Kubernetes platform | Argo Workflows. | The infrastructure and execution contract already exist. |
| AWS event-driven integration across Lambda, ECS, Batch, Glue, and S3 | Step Functions. | Managed coordination and native AWS service integrations. |
| High-volume distributed transformation or streaming | Spark plus an outer orchestrator. | Spark handles compute scale; the orchestrator handles cross-system lifecycle. |

Do not evaluate a tool only by its UI or syntax. Test a realistic failure: page two of a source API times out, the raw load commits, the dbt model fails, and a late record appears during the retry. Can the team see the interval, rerun the safe scope, prevent duplicates, and prove the mart is correct? That answer matters more than a feature matrix.

## 4. A task success is not a data success

Pipeline testing has at least three layers.

| Test layer | Question | Example |
| --- | --- | --- |
| Code and configuration | Does the code parse and behave correctly in isolation? | Unit-test a symbol parser; validate an Airflow DAG or compile a dbt project. |
| Data integrity | Do loaded records satisfy structural and business rules? | No null market key, no duplicate observation key, no negative price. |
| Data completeness | Did the target receive the records it was meant to receive? | Every API page was consumed; expected provider-symbol pairs appear; source and target counts reconcile. |

Code tests are necessary but insufficient. A perfect parser cannot detect that an API omitted one page. A `not_null` dbt test cannot prove that a late hour of source data was absent. Treat integrity and completeness as independent contracts.

### Integrity tests

Run structural checks after ingestion and after transformations:

```sql
-- Failing rows reveal a broken observation key.
SELECT provider, symbol, observed_at
FROM analytics.fct_price_observation
GROUP BY provider, symbol, observed_at
HAVING count(*) > 1;
```

Other integrity examples include referential relationships, accepted currencies, non-negative values, valid time ordering, and schema compatibility. dbt generic and singular tests are a good home for transformation-layer checks; ingestion code should also validate source-boundary requirements before loading corrupt records onward.

### Completeness tests

Completeness compares the expected set with the received set. It depends on source knowledge, so it cannot be universal.

```sql
-- Did every active provider send at least one observation in the last hour?
SELECT p.provider_id
FROM analytics.dim_provider AS p
LEFT JOIN analytics.fct_price_observation AS f
  ON f.provider_id = p.provider_id
 AND f.received_at >= now() - interval '1 hour'
WHERE p.is_active
GROUP BY p.provider_id
HAVING count(f.provider_id) = 0;
```

Also record page count, source count when supplied, first and final cursors, per-provider row counts, and freshness. A count match alone can still hide a duplicate replacing a missing row, so use a stable source ID, checksum, range coverage, or sampled reconciliation when the source allows it.

## 5. Promotion needs local development, staging, and production

Production is the place to deliver trusted data, not to discover whether the pipeline can run. Use separate environments with separate credentials, state, and targets.

```text
local development → staging → production
small fixtures       partial representative data       full scheduled workload
fast feedback        integration and safety proof       consumer-facing delivery
```

| Environment | Goal | Data and tests |
| --- | --- | --- |
| Local development | Fast iteration on logic. | Synthetic fixtures or small anonymised extracts; unit tests; lint/format; parser tests; dbt parse/compile; a local or isolated database run. |
| Staging | Prove integration in production-like infrastructure. | A bounded but representative data slice; real connectors where safe; migrations; one or more orchestration runs; dbt models and integrity/completeness checks. |
| Production | Deliver the approved data contract. | Full data scope; monitored scheduled runs; freshness, integrity, completeness, and alert checks; controlled backfills. |

Staging must be different enough from local to catch real integration errors: missing permissions, wrong environment variables, absent packages, object-storage paths, deployment image errors, or a scheduler that passes the wrong interval. It should be small enough that a test failure is safe and inexpensive.

### A practical promotion sequence

For a change to the price pipeline:

1. **Local:** run unit tests for parsing and cursor logic; compile the dbt project; execute the flow or DAG against a fixture; verify expected rows and logs.
2. **Staging:** deploy the exact built artefact or image; run one bounded data interval; verify source access, raw retention, task dependencies, dbt build, integrity tests, and a completeness expectation such as all expected pages loaded.
3. **Production:** promote the same version and configuration shape; run or schedule it for the intended interval; monitor freshness and run state; compare key counts or totals with staging expectations where useful.
4. **After deployment:** observe at least one normal scheduled run and rehearse the safe retry or backfill path before the first incident forces it.

Avoid pointing local development at production write targets. Read-only production access can still expose sensitive data, so use least-privilege credentials and carefully scoped samples. The objective is parity of behaviour, not copying production risk onto a laptop.

## A small exercise for day 20

Take the pipeline from Days 11–17 and write an operating plan:

```text
Orchestrator and why it fits:
Task or asset graph:
Run interval and data interval:
Retryable failures and retry limit:
Idempotency key and late-data policy:
Code tests:
Integrity tests:
Completeness tests:
Local environment target:
Staging data window and pass criteria:
Production alert and owner:
Safe backfill procedure:
```

Then simulate one failure: the source sends two pages but page two times out. State whether the run fails or retries, how it avoids duplicate page-one rows, which completeness check prevents publication, and how an operator resumes it. The exercise is complete when the recovery path is written down, not merely assumed.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Orchestrator | A system that coordinates workflow dependencies, scheduling, state, and recovery. | `Explain why cron is not sufficient orchestration for an API ingestion plus dbt pipeline. Use a page-two timeout as the failure example.` |
| DAG | A directed acyclic graph of dependent work. | `Draw a DAG for raw price ingestion, dbt transformations, quality gates, and publication. Explain upstream and downstream.` |
| Asset | A durable data object such as a table, file, or model with known dependencies. | `Explain task-oriented and asset-oriented orchestration using a daily market-price mart. When does each viewpoint help?` |
| Backfill | A controlled run over historical data intervals. | `Design a backfill for one week of missing prices. Explain logical date, idempotency, concurrency, and how to avoid colliding with current runs.` |
| Idempotent task | A task whose retry leaves the target in the intended state. | `Show how an orchestration retry can duplicate data. Then design an idempotent database load with a unique key and upsert.` |
| Data integrity | Whether data satisfies its structure and business rules. | `Give data-integrity tests for a price-observation fact table, including keys, relationships, values, and timestamps.` |
| Data completeness | Whether the expected data arrived for a run or interval. | `Explain why a dbt not_null test does not prove completeness. Design page, count, freshness, and coverage checks for a paginated API.` |
| Staging environment | A production-like environment for bounded integration proof. | `Design local, staging, and production environments for a Python ingestion and dbt project. List different credentials, data volumes, and tests for each.` |
| Canary run | A small, monitored production-like run before broader rollout. | `Explain a canary run for a changed data pipeline. What should be compared before expanding to the full production schedule?` |
| Concurrency limit | A bound on simultaneous workflow or task execution. | `Explain why concurrency limits matter for backfills and API rate limits. Use an example with ten overlapping provider runs.` |

When asking an LLM to choose an orchestrator, supply the real constraints: team language, existing cloud and Kubernetes maturity, data interval, dynamic fan-out, connectors, compliance needs, budget, and who will operate it at 03:00. A generic recommendation is less useful than a failure scenario the team must genuinely handle.

## What comes next

Days 21–22 move into warehouses and query performance: storage and compute trade-offs, partitioning, clustering, indexes, query plans, and the cost of asking a simple question against a large history.

## References

- [Apache Airflow documentation](https://airflow.apache.org/docs/apache-airflow/stable/)
- [Dagster asset documentation](https://docs.dagster.io/guides/build/assets)
- [Prefect documentation](https://docs.prefect.io/v3/get-started)
- [Argo Workflows documentation](https://argo-workflows.readthedocs.io/en/latest/)
- [AWS Step Functions documentation](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [Apache Spark documentation](https://spark.apache.org/docs/latest/)
