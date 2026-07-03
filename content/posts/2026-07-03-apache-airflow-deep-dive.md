---
title: "Apache Airflow: The Workflow Orchestrator That 80% of the Data Stack Still Runs On"
date: 2026-07-03
tags: [apache-airflow, workflow-orchestration, data-engineering, python, dag, scheduler]
series: data-engineering
summary: "Airflow is the most widely adopted orchestrator. 46k GitHub stars, Apache 2.0, Python DAGs. 80+ providers cover AWS, GCP, Azure, databases, and more. Airflow 3.x adds event-driven triggers and a modernized UI. Enterprise via MWAA, Cloud Composer, and Astronomer. The Python DAG approach is both its greatest strength and its limitation."
---

# Apache Airflow: The Workflow Orchestrator That 80% of the Data Stack Still Runs On

Apache Airflow is a platform for programmatically authoring, scheduling, and monitoring workflows. Created at Airbnb in 2015 by Maxime Beauchemin, it became an Apache Top-Level Project in 2016. The core concept: define your workflow as a Python DAG (Directed Acyclic Graph), where each node is a task and edges define dependencies. Airflow's scheduler executes tasks in the correct order, handles failures with retries, and provides a web UI for monitoring.

46,011 GitHub stars, 17,334 forks, Apache 2.0 license. 80+ community-maintained providers. Airflow 3.x (2026) adds event-driven triggers, improved task isolation, and a modernized UI. Enterprise deployment via MWAA (AWS), Cloud Composer (GCP), Astronomer (multi-cloud).

## How Airflow works

You write Python code that declares tasks and their dependencies. Airflow schedules and executes them.

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from datetime import datetime

def extract_data(**context):
    return {"records": 1000}

with DAG(
    'daily_etl',
    start_date=datetime(2024, 1, 1),
    schedule='@daily',
    catchup=False,
) as dag:

    extract = PythonOperator(
        task_id='extract',
        python_callable=extract_data,
    )

    transform = BashOperator(
        task_id='transform',
        bash_command='dbt run --select staging',
    )

    load = BashOperator(
        task_id='load',
        bash_command='echo "Loading to warehouse"',
    )

    extract >> transform >> load
```

**Core components:**

| Component | Description |
|-----------|-------------|
| Scheduler | Triggers scheduled DAGs, submits tasks to executor |
| DAG Processor | Parses DAG files, serializes to metadata DB |
| Webserver | UI for monitoring, triggering, debugging |
| Metadata Database | Stores task states, DAG configs (PostgreSQL/MySQL) |
| Worker | Executes tasks (Celery/K8s executor) |
| Triggerer | Handles deferred/async tasks |

**Task types:** Operators (pre-built tasks like `BashOperator`, `PythonOperator`, `SparkSubmitOperator`), Sensors (wait for external conditions like `FileSensor`, `HttpSensor`, `SqlSensor`), and TaskFlow (`@task` decorated Python functions with automatic XCom).

**Executors:**

| Executor | Description | Use Case |
|----------|-------------|----------|
| SequentialExecutor | Tasks one at a time | Testing only |
| LocalExecutor | Parallel on one machine | Small deployments |
| CeleryExecutor | Distributed across worker nodes | Production (most common) |
| KubernetesExecutor | Each task as a K8s pod | Cloud-native, isolation |

## Scalability

Airflow scales horizontally by adding more workers.

| Dimension | Capability |
|-----------|-----------|
| Concurrent DAGs | Thousands |
| Concurrent Tasks | Hundreds (Celery) / thousands (K8s) |
| DAG Files | Thousands (with separate DAG processor) |
| Task Throughput | Tens of thousands per hour |

Five scaling mechanisms: executor-based scaling (CeleryExecutor distributes across nodes, KubernetesExecutor spawns pods on-demand), separate DAG processing (CPU-intensive parsing runs independently from the scheduler), pools (limit concurrent task execution per resource), centralized connection management (workers don't need local credentials), and XComs (pass small metadata between tasks, not large datasets).

**Scalability limits:** Metadata DB becomes a bottleneck at very high throughput (PostgreSQL + PgBouncer required). DAG parsing is CPU-intensive for thousands of files. Celery broker (Redis/RabbitMQ) adds operational complexity. Python GIL limits single-task parallelism.

## Enterprise deployment

| Platform | Provider | Best For |
|----------|----------|----------|
| AWS MWAA | Amazon | AWS-native teams |
| Cloud Composer | Google | GCP-native teams |
| Astronomer | Commercial | Cross-cloud, enterprise governance |
| Self-managed | OSS | Full control, cost-sensitive |

Managed (MWAA, Composer, Astronomer) handles infrastructure, upgrades, and scaling automatically. Higher cost, lower operational burden. Self-managed gives full control at lower cost but requires a dedicated platform team.

**Production requirements:** PostgreSQL (not SQLite) for metadata DB, PgBouncer for connection pooling, CeleryExecutor or KubernetesExecutor, separate DAG Processor for thousands of DAG files, RBAC and authentication (built-in since Airflow 2.0).

## Providers and ecosystem

80+ community-maintained providers covering:

| Category | Providers |
|----------|-----------|
| Cloud - AWS | S3, EMR, Glue, Redshift, Lambda, Step Functions, SQS, SNS |
| Cloud - GCP | BigQuery, GCS, Dataflow, Dataproc, Cloud SQL, Pub/Sub |
| Cloud - Azure | Blob, Data Lake, Synapse, Databricks |
| Databases | PostgreSQL, MySQL, Oracle, SQL Server, Snowflake, BigQuery, Redshift |
| Data Processing | Spark, Flink, dbt, Databricks, Snowflake |
| Messaging | Kafka, RabbitMQ, SQS, Pub/Sub |
| Storage | S3, GCS, Azure Blob, HDFS, MinIO |
| CI/CD | GitHub, GitLab, Jenkins, CircleCI |
| Notifications | Slack, Email, PagerDuty, Microsoft Teams |
| ML | MLflow, Kubeflow, SageMaker |

Providers are versioned and released independently from Airflow core. You can upgrade or downgrade individual providers without touching Airflow itself. You can also build custom providers with operators, hooks, and connections.

## Airflow 3.x changes

| Feature | Airflow 2.x | Airflow 3.x |
|---------|-------------|-------------|
| Event-driven triggers | Limited (sensors only) | First-class event triggers (S3, webhooks, Kafka) |
| Task isolation | Shared Python process | Better isolation via KubernetesExecutor |
| DAG versioning | Manual (Git) | Built-in DAG version tracking |
| UI | Legacy Flask UI | Modernized React-based UI |
| Python version | Python 3.8+ | Python 3.10+ |

The big changes: DAGs can be triggered by events (S3 file arrival, webhook, Kafka message), not just cron schedules. Better KubernetesExecutor pod isolation and resource management. Faster, more responsive UI.

## Airflow in the ELT era

Airflow does not do the extraction (Fivetran/Airbyte), the transformation (dbt), or the serving (BI tools). It coordinates when these tools run, in what order, with what retries and what monitoring.

**Where Airflow fits:**

| Use Case | Airflow's Role |
|----------|---------------|
| Orchestration sequencing | Coordinate: Fivetran finishes -> dbt starts -> notify team |
| Cross-system workflows | Spark + dbt + Fivetran + ML training in one DAG |
| Event-driven pipelines | Trigger dbt on new Fivetran sync completion |
| ML pipeline orchestration | Feature engineering -> training -> deployment -> monitoring |
| Infrastructure automation | Terraform + dbt + data quality checks |
| Backfills and reprocessing | Re-run historical data through entire pipeline |

**Where Airflow lost ground:**

| Use Case | Old (Airflow) | Modern Alternative | Why |
|----------|--------------|-------------------|-----|
| SQL transforms | Custom Airflow tasks | dbt (declarative, tested) | Purpose-built for SQL transforms |
| Data extraction | Custom Airflow tasks | Fivetran/Airbyte (managed) | Managed connectors are more reliable |
| Simple scheduling | Airflow DAGs | dbt Cloud, Cron, Kestra | Overkill for simple schedules |
| Data quality | Custom Airflow checks | dbt tests, Great Expectations | Purpose-built tools are better |

For simple analytics pipelines with just dbt, Airflow may be overkill. For complex pipelines spanning multiple systems (Spark + dbt + Fivetran + ML + notifications), Airflow is essential.

### Airbyte: the ingestion layer that completes Airflow

Airflow orchestrates when things run. Airbyte handles the extraction and loading part that Airflow used to do with custom operators. Together they form the standard ELT ingestion pipeline.

**What Airbyte is:** An open-source data integration platform that moves data from sources (APIs, databases, files) to destinations (warehouses, lakes). 350+ pre-built connectors. Each connector is a Docker container (source or destination) that reads from or writes to a standardized format. Apache 2.0 license.

**How Airbyte and Airflow fit together:**

```
Airflow (orchestrator)
  │
  ├── Trigger Airbyte sync (API call)
  │     ├── Source connector extracts data
  │     └── Destination connector loads to warehouse
  │
  ├── Wait for sync completion
  │
  └── Trigger dbt (transform in warehouse)
```

Airflow does not move the data itself. It tells Airbyte when to run, monitors completion, and triggers downstream tasks. Airbyte does the heavy lifting of connecting to 350+ sources, handling pagination, rate limiting, schema changes, and incremental syncs.

**Why this pairing works:**

| Problem | Airbyte Solves | Airflow Solves |
|---------|---------------|----------------|
| Connector maintenance | 350+ pre-built, maintained connectors | N/A (no custom connector code) |
| Incremental sync | Built-in CDC, cursor-based, timestamp-based | Triggers when source data changes |
| Schema changes | Automatic schema detection and propagation | Orchestrates migration tasks |
| Retry logic | Per-connector retry with backoff | DAG-level retry and alerting |
| Scheduling | N/A (Airbyte is not a scheduler) | Cron, event-driven, SLA-based triggers |
| Multi-source coordination | N/A (one sync at a time) | Parallel syncs across multiple sources |
| Downstream triggers | N/A (Airbyte does not know about dbt) | Chains: sync -> transform -> notify |

**Airbyte's role in the stack:**

| Layer | Tool | Responsibility |
|-------|------|---------------|
| Extract | Airbyte source connectors | Pull data from APIs, databases, files |
| Load | Airbyte destination connectors | Write to warehouse, lake, or database |
| Orchestrate | Airflow | Schedule, trigger, monitor, retry, alert |
| Transform | dbt | SQL transforms in the warehouse |
| Serve | BI tools | Dashboards, reports |

**Airbyte vs Fivetran:** Both do the same thing (extract + load), but Airbyte is open-source and self-hostable. Fivetran is fully managed SaaS. Airbyte requires infrastructure (Docker or Kubernetes) and maintenance. Fivetran requires only money. For teams that want control over their data infrastructure, Airbyte. For teams that want zero ops, Fivetran.

**Airflow Airbyte provider:** The `apache-airflow-providers-airbyte` package provides an `AirbyteTriggerSyncOperator` that triggers Airbyte syncs from Airflow DAGs and waits for completion. This is the standard way to integrate the two.

```python
from airflow.providers.airbyte.operators.airbyte import AirbyteTriggerSyncOperator

sync_data = AirbyteTriggerSyncOperator(
    task_id='airbyte_sync',
    airbyte_conn_id='airbyte_default',
    connection_id='your-connection-id',
)
```

**The pragmatic answer:** Airbyte replaced the custom Python extraction scripts that data engineers used to write and maintain in Airflow. Airflow still orchestrates the pipeline, but the extraction and loading is delegated to Airbyte's 350+ connectors. This is the same pattern as dbt replacing custom SQL transforms — specialized tools for specialized jobs, orchestrated by Airflow.

## Airflow vs alternatives

| Dimension | Airflow | Kestra | Prefect | Dagster |
|-----------|---------|--------|---------|---------|
| Authoring | Python DAGs | YAML | Python decorators | Python assets |
| Language | Python only | Any (YAML) | Python only | Python only |
| Architecture | Schedule-first | Event-driven | Hybrid | Asset-centric |
| UI | Observability-focused | Full authoring | Observability | Full authoring |
| Providers/Plugins | 80+ providers | 1,700+ plugins | Integrations | Integrations |
| Enterprise | MWAA, Composer, Astronomer | Enterprise Edition | Prefect Cloud | Dagster Cloud |

**Choose Airflow when:** Python-native team with existing Airflow expertise, need managed service (MWAA, Cloud Composer, Astronomer), complex cross-system orchestration, large existing ecosystem of operators and hooks, regulatory compliance requiring a mature battle-tested platform.

**Choose something else when:** multi-language team (Kestra), want Python-native simplicity (Prefect), building modern data stack with dbt (Dagster), need event-driven at core (Kestra), non-technical users need to author workflows (Kestra/n8n).

## Open questions

- How does Airflow 3.x event-driven triggers compare to Kestra's native event system?
- What is the operational cost difference between MWAA and self-managed Airflow at scale (1K+ DAGs)?
- How does the Python-only authoring limitation affect cross-functional team adoption?
- What are the practical limits of XCom for passing data between tasks?

---

## References

1. Apache Airflow GitHub Repository: https://github.com/apache/airflow
2. Airflow Architecture Overview: https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html
3. Airflow Providers: https://airflow.apache.org/docs/apache-airflow-providers/index.html
4. Database Setup: https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html
5. Airbyte GitHub Repository: https://github.com/airbytehq/airbyte
6. Airbyte Documentation: https://docs.airbyte.com/
7. Airflow Airbyte Provider: https://airflow.apache.org/docs/apache-airflow-providers-airbyte/stable/index.html
