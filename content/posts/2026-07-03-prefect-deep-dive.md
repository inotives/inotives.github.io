---
title: "Prefect: Python-Native Orchestration That Feels Like Writing Plain Python"
date: 2026-07-03
tags: [prefect, workflow-orchestration, data-engineering, python, data-pipelines]
series: data-engineering
summary: "Prefect turns Python functions into orchestrated workflows with @flow and @task decorators. No DAGs, no YAML, no DSLs. Created by a former Airflow PMC member, it trades Airflow's scale for Python-native simplicity. Best for small-to-medium teams with 20-50 flows. Breaks down at 500+ flows with complex dependencies."
---

# Prefect: Python-Native Orchestration That Feels Like Writing Plain Python

Prefect is a Python-native workflow orchestration framework created in 2018 by Jeremiah Lowin, a former Apache Airflow PMC member. The core insight: workflow orchestration should feel like writing plain Python, not learning a DSL or YAML schema. Prefect uses Python decorators (`@flow`, `@task`) to turn functions into orchestrated workflows with automatic state tracking, retries, caching, and observability.

22,740 GitHub stars, 2,355 forks, Apache 2.0 license, primarily Python (23M lines) with TypeScript (5.7M) for the UI. Latest release: Prefect 3.7.7 (July 2026). Prefect 3.0 (2024) added event-driven automations, open-sourced the events backend, and improved runtime performance by 90%.

## How Prefect works

You write normal Python functions. You add `@flow` and `@task` decorators. Prefect handles the rest.

```python
from prefect import flow, task

@task
def extract_data():
    return {"records": 1000}

@task
def transform_data(data):
    return {"records": data["records"] * 2}

@flow(log_prints=True)
def my_pipeline():
    data = extract_data()
    transformed = transform_data(data)
    print(f"Processed {transformed['records']} records")
    return transformed

if __name__ == "__main__":
    my_pipeline()
```

Run it with `python my_pipeline.py`. No infrastructure required. No DAG definition. No Airflow webserver. Just Python.

**Core concepts:**

| Concept | Description |
|---------|-------------|
| Flow | A decorated Python function (`@flow`) — the unit of orchestration |
| Task | A decorated Python function (`@task`) — the unit of work within a flow |
| Deployment | Server-side representation of a flow (schedule, infrastructure, parameters) |
| Work Pool | Infrastructure template for running deployments (Docker, K8s, serverless) |
| Worker | Client-side process that executes deployments on infrastructure |
| Automation | Rules that react to events (trigger flows, send notifications) |

## Prefect vs Airflow

| Aspect | Airflow | Prefect |
|--------|---------|---------|
| Definition | Python DAGs (explicit graph) | Decorated functions (implicit graph) |
| DAG requirement | Must define DAG upfront | No DAG — use Python control flow |
| Dynamic workflows | Limited (dynamic task mapping) | First-class (create tasks at runtime) |
| Type hints | Not used | Used for parameter validation (Pydantic) |
| Local execution | Requires Airflow infrastructure | `python my_flow.py` just works |
| Testing | Test DAGs with Airflow test framework | Test like normal Python (pytest) |

Airflow requires learning a framework. Prefect requires learning two decorators.

## Scalability

Prefect scales horizontally via work pools and workers.

| Dimension | Capability |
|-----------|-----------|
| Concurrent Flows | Hundreds (depends on infrastructure) |
| Concurrent Tasks | Per-flow concurrency limits |
| Work Pools | Multiple pools for different infrastructure |
| Deployments | Thousands |

Five scaling mechanisms: work pools + workers (add more workers to increase concurrency), task runners (concurrent, parallel, Dask, Ray within a flow), concurrency limits (global and tag-based to prevent resource exhaustion), push work pools (ECS, Cloud Run, ACI — scale to zero when idle), and Prefect Cloud (managed infrastructure handles server scaling and database management).

**Scalability limits:** Self-hosted Prefect Server requires you to manage the API server, database, and workers. Complex dependency chains (500+ flows) become harder to reason about without DAG visualization. XCom-like data passing is not designed for large datasets. Python GIL limits single-flow parallelism (mitigated by task runners).

## Prefect Cloud vs self-hosted

| Dimension | Prefect OSS (Self-Hosted) | Prefect Cloud (SaaS) |
|-----------|--------------------------|---------------------|
| Cost | Free | Free Hobby tier; paid Starter/Team/Pro/Enterprise |
| Users | No user management (open API) | 2 (Hobby) to unlimited (paid) |
| Auth | None | Basic auth (Hobby), SSO (paid) |
| RBAC | No | Yes (paid) |
| Deployments | Unlimited | 5 (Hobby), unlimited (paid) |
| SLA | None | Uptime SLA (paid) |

**Prefect Cloud pricing tiers:**

| Tier | Users | Deployments | Cost |
|------|-------|-------------|------|
| Hobby | 2 | 5 | Free |
| Starter | More | More | Paid |
| Team | More | More | Paid |
| Pro | More | More | Paid |
| Enterprise | Unlimited | Unlimited | Contact Sales |

The self-hosted setup is two commands:
```
pip install prefect
prefect server start
```
API at `http://localhost:4200`. No user authentication, no RBAC, no SSO. Anyone with the API URL gets full access. The API is open by design — meant for machine-to-machine communication, not human multi-user collaboration.

Prefect Cloud's free Hobby tier (2 users, 5 deployments) is the cheapest path to real multi-user with SSO. Every open-source orchestrator lacks proper multi-user governance out of the box.

## Integrations

| Category | Integrations |
|----------|-------------|
| Cloud - AWS | S3, ECS, Lambda, Glue, Redshift, Step Functions, RDS, Athena |
| Cloud - GCP | BigQuery, GCS, Cloud Run, Vertex AI, Cloud Functions |
| Cloud - Azure | Blob Storage, Azure ML, Azure Container Instances |
| Databases | PostgreSQL, MySQL, Snowflake, BigQuery, Redshift, Databricks |
| Data Processing | Spark, Dask, Ray, dbt, Fivetran, Airbyte |
| Storage | S3, GCS, Azure Blob, MinIO |
| Messaging | Kafka, RabbitMQ, AWS SQS |
| Notifications | Slack, Email, PagerDuty, Microsoft Teams |
| ML | MLflow, Weights & Biases, Hugging Face |

Task runners extend concurrency: ConcurrentTaskRunner (default, asyncio-based), DaskTaskRunner (distributed via Dask), RayTaskRunner (distributed via Ray).

## Prefect 3.x changes

| Feature | Prefect 2.x | Prefect 3.x |
|---------|-------------|-------------|
| Events system | Limited | First-class events + automations |
| Runtime overhead | Baseline | 90% improvement |
| Deployment model | Work queues | Work pools (unified) |
| Dynamic workflows | Task mapping | Full Python control flow |
| Serverless push pools | No | Yes (ECS, Cloud Run, ACI) |

The big changes: event-driven automations (react to S3 uploads, webhooks, schedules with flow triggers and notifications), push work pools (serverless execution without workers), and a 90% reduction in runtime overhead.

## Where Prefect fits in the modern data stack

Prefect orchestrates dbt runs with event-driven triggers. It coordinates Fivetran syncs with downstream transforms. It manages ML pipelines (feature engineering, training, deployment). It handles complex conditional workflows (if X then Y else Z).

**Where Prefect wins:**

| Use Case | Why Prefect Wins |
|----------|-----------------|
| Python-native teams | Feels like writing plain Python |
| Rapid iteration | `python flow.py` just works |
| Dynamic workflows | Create tasks at runtime |
| Small teams (20-50 flows) | Simple, minimal overhead |
| Serverless execution | Push work pools (ECS, Cloud Run) |

**Where Prefect falls short:**

| Limitation | Impact | Alternative |
|-----------|--------|-------------|
| Python-only | Non-Python users cannot author workflows | Kestra (YAML) |
| 500+ flows | Complex dependency chains hard to manage | Airflow (DAG visualization) |
| No RBAC in OSS | Multi-team governance requires paid Cloud | Airflow (built-in roles) |
| Smaller ecosystem | Fewer operators than Airflow | Airflow (80+ providers) |

## When to choose Prefect vs alternatives

| Dimension | Prefect | Airflow | Kestra | Dagster |
|-----------|---------|---------|--------|---------|
| Authoring | Python decorators | Python DAGs | YAML | Python assets |
| Language | Python only | Python only | Any | Python only |
| DAG required | No | Yes | Yes | Yes |
| Dynamic workflows | First-class | Limited | Limited | First-class |
| Serverless | Push work pools | Not native | Not native | Not native |
| Event-driven | Automations (3.0) | Asset Watchers (3.x) | Native at core | Asset observations |
| Enterprise | Cloud (SaaS) | MWAA/Composer/Astronomer | Enterprise Edition | Dagster Cloud |

**Choose Prefect when:** Python-only team wanting minimal boilerplate, small to medium team (20-50 flows), want fast local iteration, need dynamic workflows, want serverless execution.

**Choose something else when:** multi-language team (Kestra), need managed service at scale (Airflow MWAA/Composer), building modern data stack with dbt (Dagster), non-Python users need to author workflows (Kestra/n8n).

## Open questions

- How does Prefect's push work pool pricing compare to running Airflow on MWAA at scale?
- What is the practical limit of Prefect's dynamic workflow model (1000+ dynamically created tasks)?
- How does Prefect Cloud's Hobby tier (2 users) compare to Kestra OSS (unlimited users, no auth) for small teams?
- What are the operational costs of self-hosting Prefect Server vs using Airflow standalone?

---

## References

1. Prefect GitHub Repository: https://github.com/PrefectHQ/prefect
2. Prefect Getting Started: https://docs.prefect.io/v3/get-started/index
3. Prefect Flows: https://docs.prefect.io/v3/concepts/flows
4. Prefect Deployments: https://docs.prefect.io/v3/concepts/deployments
5. Prefect Pricing: https://www.prefect.io/pricing
