---
title: "Data Engineering in 30 Days: A Learning Path for the AI Era"
date: 2026-08-10
tags: [data-engineering, learning-path, sql, ai]
summary: "A practical 30-day map for learning data engineering, from files and SQL through modelling, orchestration, quality, and AI-ready data systems. This is the index for a series that will unpack each topic later."
series: data-engineering-in-30-days
---

Data engineering is the work of making data dependable enough for someone else to use. That “someone” may be an analyst, an application, a finance team, or an AI agent. The job has grown wider in the AI era, but its foundation is unchanged: understand the data, move it safely, model it clearly, and make failures visible.

Thirty days will not make anyone a master data engineer. It can build the first working mental model and a small system worth improving. The goal is to finish the month able to take a messy source, load it, transform it into trustworthy tables, schedule it, test it, and explain what happens when it fails.

This article is the map for the series. Later articles will take each stop slowly, with examples.

## The route at a glance

| Stage | Days | What you learn | Why it matters |
| --- | ---: | --- | --- |
| Beginner | 1–10 | Data basics, files, SQL, Python, and databases | You need to inspect and shape data before automating anything. |
| Builder | 11–20 | Ingestion, modelling, transformation, orchestration, and tests | This turns individual queries into a repeatable pipeline. |
| Advanced | 21–26 | Warehouses, performance, observability, governance, and delivery | This is where a pipeline becomes safe to operate with real users. |
| Mastery direction | 27–30 | Streaming, data products, and AI-ready systems | These topics show where to deepen after the first month. |

The stages are about capability, not job titles. A beginner can use a warehouse; an experienced engineer can still have gaps in governance or streaming. Build in this order because later topics lean on earlier ones.

## Days 1–10: learn to see the data

### Days 1–2: what data engineering is

Learn the difference between an operational system and an analytical system. An application database records the current state needed to run a product. An analytical system keeps enough history to answer questions over time.

Meet the basic shapes: tables, rows, columns, primary keys, foreign keys, timestamps, and schemas. A schema is simply an agreement about what each field means and what form it takes. `price` is not useful until everyone knows its currency, unit, precision, and time of observation.

### Days 3–4: files and formats

Start with CSV, JSON, and Parquet. CSV is easy to inspect but weak at representing types and nested data. JSON is flexible and common in APIs but often inconsistent. Parquet is a columnar format designed for efficient analytical reads.

Practice loading a small public dataset, checking for missing values and duplicate keys, and writing it back in a different format. This is the first lesson in a useful habit: do not trust a file because it parsed successfully.

### Days 5–7: SQL

SQL is the core language of data engineering. Learn `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, joins, common table expressions, and window functions. A window function lets a query compare a row with related rows without collapsing them into one aggregate.

Use PostgreSQL or DuckDB for practice. PostgreSQL teaches real database behaviour. DuckDB makes local analytical work fast and low-friction. The important part is writing queries until joins and aggregates become ordinary tools rather than memorised syntax.

### Days 8–10: Python and a local database

Python is useful for source APIs, file handling, validation, and glue around SQL. Learn enough to read a file, call an API, handle errors, and use a database driver. Do not begin by building a framework.

By day 10, make one small pipeline: fetch daily crypto-market data, store the raw response, load records into a table, and query the latest prices. Preserve the raw payload. You will need it when the provider changes its response later.

## Days 11–20: turn scripts into a pipeline

### Days 11–12: ingestion and incremental loading

Ingestion moves data from a source into your system. Learn the difference between a full refresh and an incremental load. A full refresh reloads everything. An incremental load collects only new or changed records, usually using a cursor, timestamp, or monotonically increasing ID.

The hard part is not calling an API. It is handling retries, duplicate deliveries, late data, rate limits, and partial failures. Learn idempotency: running the same job twice should not corrupt the result.

### Days 13–15: data modelling

Data modelling turns raw records into tables that people can understand. Learn normalisation first: separate entities such as `assets`, `providers`, and `markets` instead of repeating their details everywhere. Then learn dimensional modelling: fact tables record events or measurements; dimension tables describe the people, products, or entities around them.

For analytics, start with a clear layered model:

```text
raw source payloads → cleaned staging tables → business-ready marts
```

Raw data protects evidence. Staging standardises fields. Marts are the stable tables a dashboard, analyst, or agent should use.

### Days 16–17: transformations and dbt

Transformation is the SQL that converts ingested data into useful models. [dbt](https://www.getdbt.com/) gives those SQL models structure: dependencies, tests, documentation, and repeatable runs.

Learn models, `ref()`, tests, sources, and incremental models. The value is not a particular tool. The value is keeping transformation logic versioned, reviewable, and executable from a clean environment.

### Days 18–20: orchestration and tests

An orchestrator runs work in the right order and records what happened. Airflow, Dagster, and Prefect are common choices, but the concept comes first: define a dependency graph, schedule it, retry safely, and expose failures.

Data tests describe assumptions. A market symbol might be unique per provider; a quote currency may not be null; a trade timestamp should not be in the future. Tests turn those assumptions into an early signal instead of a mysterious dashboard number days later.

At day 20, your project should fetch data, load raw records, create cleaned tables, build a mart, and run at least a few tests on a schedule.

## Days 21–26: operate it like a real system

### Days 21–22: warehouses and query performance

Learn why analytical warehouses partition data, store columns together, and separate storage from compute. BigQuery, Snowflake, ClickHouse, and a well-designed PostgreSQL system make different trade-offs, but the questions are shared: how much data does this query scan, which filters are selective, and which model does the user actually need?

Study indexes, partitioning, clustering, query plans, and cost. Optimisation starts with measurement. A faster query that reads the wrong grain is still a broken query.

### Days 23–24: observability and data quality

Software observability asks whether a service is up. Data observability asks whether the data is fresh, complete, valid, and plausible. Track row counts, freshness, null rates, schema changes, and distribution shifts.

Schema drift deserves special attention. Providers add fields, rename fields, change types, and occasionally return two contradictory values. A production pipeline should record the disagreement and make a policy decision; it should not silently choose the convenient value.

### Days 25–26: governance and delivery

Learn lineage, access control, retention, and personally identifiable information. Lineage answers where a number came from. Access control answers who can see or change it. Retention answers how long the system should keep it.

Put pipeline code, SQL, tests, and configuration in version control. Add a simple continuous-integration check that parses or runs the project and tests the models. Data work becomes dependable when changing it is routine and reversible.

## Days 27–30: prepare for the AI era

### Day 27: streaming and event thinking

Batch processing moves a bounded collection of records. Streaming processes an unbounded flow of events. Learn the vocabulary: topics, consumers, offsets, event time, processing time, late events, and exactly-once claims.

You do not need Kafka on day 27. You do need to understand that an event can arrive late, arrive twice, or arrive out of order. Those facts change how you design every “real-time” pipeline.

### Day 28: data products and contracts

A data product is a dataset treated as something with owners, users, a purpose, documented meaning, and a reliability promise. A data contract makes the promise explicit between a producer and a consumer.

For example, a pricing feed can promise that `provider`, `symbol`, `observed_at`, and `price` exist, have specified types, and follow a freshness expectation. Contracts make breakage discussable before it becomes an incident.

### Day 29: data for AI systems

AI systems need data engineering more than they need another prompt. Retrieval systems need clean documents, chunking choices, metadata, and permissions. Agent workflows need stable tool outputs, schemas, checkpoints, and audit trails. Evaluation needs repeatable environments and known expected outcomes.

The same principles apply: keep raw evidence, define stable interfaces, make transformations traceable, and test failure paths. An agent should query a documented mart or tool contract, not scrape whatever happens to be in a production table.

### Day 30: build the capstone and choose a direction

Build a small, complete system rather than another tutorial fragment. A good capstone could ingest exchange prices from two providers, preserve raw responses, standardise them into a shared schema, flag disagreements, produce a daily mart, and expose a short quality report.

Then choose what to deepen next:

- Analytics engineering: SQL, dbt, semantic models, and stakeholder-facing marts.
- Platform engineering: orchestration, infrastructure, reliability, and cost control.
- Streaming: event systems, stateful processing, and low-latency products.
- AI data engineering: retrieval pipelines, evaluation data, tool contracts, and agent observability.

## What “master” actually means

Mastery is not knowing every warehouse, orchestration tool, or file format. It is being able to reason from a business question to a reliable data contract, choose a simple implementation, detect when it is wrong, and improve it without losing trust in the history.

Thirty days gives you the map and one complete route through it. The articles that follow will be the field guides: one concept at a time, with a small example and the production failure that makes the concept worth learning.

## References

- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [DuckDB documentation](https://duckdb.org/docs/)
- [dbt documentation](https://docs.getdbt.com/)
- [Apache Airflow documentation](https://airflow.apache.org/docs/)
- [Apache Kafka documentation](https://kafka.apache.org/documentation/)
