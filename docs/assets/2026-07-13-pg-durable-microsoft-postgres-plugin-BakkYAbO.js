var e=`---
title: "pg_durable: Durable Workflow Execution Inside PostgreSQL"
date: 2026-07-13
tags: [postgresql, microsoft, durable-execution, workflow-orchestration, data-engineering]
series: data-engineering
summary: "Microsoft released pg_durable, a PostgreSQL extension that runs durable workflows entirely inside the database. SQL-native operators replace external orchestrators like Airflow and Temporal for ETL, scheduled jobs, and data pipelines. Built on Rust (pgrx), it checkpoints every step, retries failures automatically, and survives crashes — all without leaving PostgreSQL."
---

# pg_durable: Durable Workflow Execution Inside PostgreSQL

Microsoft open-sourced pg_durable, a PostgreSQL extension that brings durable execution into the database. Instead of spinning up Airflow or Temporal to orchestrate your ETL, you write a few lines of SQL, and PostgreSQL handles checkpointing, retries, crash recovery, and parallel execution itself.

Durable execution is a pattern where workflow state persists at every step. If the process crashes halfway through, it picks up from the last checkpoint rather than starting over. pg_durable makes this available through a SQL DSL with custom operators, running as a background worker inside PostgreSQL. No Redis, no external scheduler, no separate orchestration server.

## The problem it solves

Without durable execution, teams write hundreds of lines of boilerplate for data pipelines: job queue tables, polling workers, manual retry logic, step coordination, crash recovery functions, status monitoring. pg_durable collapses that to roughly five lines of SQL.

The usual alternatives (Airflow, Temporal, Step Functions) each add infrastructure. Separate schedulers, metadata databases, worker nodes, dashboards. For SQL-shaped workflows, all of that infrastructure is overhead that pg_durable eliminates by running directly inside PostgreSQL.

## How it works

pg_durable provides a small set of SQL operators:

| Operator | Purpose |
|----------|---------|
| \`~>\` | Sequential execution |
| \`&\` | Parallel execution |
| \`\\|=>\` | Capture result to variable |
| \`$var\` | Variable substitution |
| \`@>\` | Loop |
| \`?>\` | Conditional check |
| \`df.if()\` | Conditional branching |
| \`df.join()\` | Wait for parallel results |
| \`df.http()\` | HTTP call from SQL |
| \`df.sleep()\` | Pause execution |
| \`df.wait_for_signal()\` | Wait for external signal |
| \`df.wait_for_schedule()\` | Cron-like scheduling |

A basic ETL pipeline looks like this:

\`\`\`sql
SELECT df.start(
    'DELETE FROM staging WHERE processed = true' ~> 'batch'
    |> 'SELECT * FROM raw_data WHERE id NOT IN (SELECT id FROM $batch)' |> 'new_batch'
    ~> 'INSERT INTO staging SELECT * FROM $new_batch'
);
\`\`\`

Parallel fan-out for a dashboard refresh:

\`\`\`sql
SELECT df.start(
    'SELECT count(*) FROM users'     &
    'SELECT count(*) FROM orders'    &
    'SELECT sum(amount) FROM orders'
    ~> 'REFRESH MATERIALIZED VIEW metrics',
    'dashboard_refresh'
);
\`\`\`

Scheduled API ingestion with crash recovery:

\`\`\`sql
SELECT df.start(
    df.wait_for_schedule('0 * * * *')
    ~> 'SELECT df.http(''GET'', ''https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd'')' |> 'data'
    ~> 'INSERT INTO raw_coingecko SELECT * FROM jsonb_to_recordset($data)'
);
\`\`\`

## Architecture

pg_durable runs as a PostgreSQL background worker, built on the pgrx Rust framework. It has two core components: duroxide (the orchestration runtime) and duroxide-pg (the PostgreSQL state provider). All workflow state lives in Postgres tables, queryable with standard SQL. No external services required.

The extension requires PostgreSQL 17 or 18 and is available on Azure HorizonDB.

## What it's good at

SQL-shaped workflows are the sweet spot: ETL pipelines, scheduled data ingestion, parallel aggregations, database maintenance with human approval gates, AI/ML batch pipelines. Anywhere you'd normally reach for Airflow to orchestrate PostgreSQL operations, pg_durable is worth evaluating first.

The \`df.http()\` operator is particularly interesting for API ingestion pipelines. CoinGecko, Salesforce, Fireblocks, Binance — any REST API that fits a scheduled batch pattern works well. You get automatic retries for 429/500 responses, rate limiting via \`df.sleep()\`, and crash recovery without a scheduler daemon.

A hybrid architecture makes sense: keep a Rust application for real-time WebSocket/FIX streaming (order books, live trades), and use pg_durable for the REST API batch ingestion layer that currently runs in Dagster or Airflow.

## When to skip it

pg_durable isn't for everything. Simple single-statement operations don't need a workflow engine. Sub-millisecond synchronous request handling isn't the target. Complex multi-system orchestration that spans many services outside PostgreSQL might still need an external orchestrator. And if you can't install extensions or run background workers, it's off the table entirely.

## Comparison to alternatives

| Feature | pg_durable | Airflow | Temporal | AWS Step Functions |
|---------|------------|---------|----------|-------------------|
| Infrastructure | None (runs in Postgres) | Separate scheduler | Separate server | AWS managed |
| State storage | PostgreSQL tables | Metadata DB | External DB | AWS state machine |
| Crash recovery | Automatic | Manual | Automatic | Automatic |
| Observability | SQL queries | Web UI | Web UI | AWS Console |
| Language | SQL | Python | Go/Java/TS | JSON/YAML |
| Cost | Free (extension) | Free (self-hosted) | Free (self-hosted) | Pay per execution |

## Getting started

1. Install the extension on PostgreSQL 17+
2. Start with one pipeline (e.g., CoinGecko ingestion)
3. Implement as a pg_durable function with \`df.http()\` and \`df.wait_for_schedule()\`
4. Validate crash recovery by killing the connection mid-run
5. Add more sources incrementally

The migration path is incremental. You don't need to replace your entire orchestration stack. Pick one workflow, prove it works, then expand.

## Evaluating pg_durable for felts

I'm currently evaluating whether pg_durable fits into [felts](https://github.com/inotives/felts), my open-source financial ELT pipeline. The stack extracts data from CoinGecko and CSV sources (OHLCV, FRED), lands it in PostgreSQL/TimescaleDB, transforms it with dbt, and orchestrates runs with Prefect. pg_durable's \`df.http()\` operator, built-in scheduling, and crash recovery map directly to what Prefect does for these batch jobs — but without the separate orchestration server. The incremental migration path (start with one source, prove it works, expand) makes this a realistic option to test without ripping out the entire Prefect setup.

## References

- [pg_durable documentation](https://microsoft.github.io/pg_durable/)
- [pg_durable GitHub repository](https://github.com/microsoft/pg_durable)
- [Azure HorizonDB](https://azure.microsoft.com/en-us/products/horizondb)
- [felts: Financial data ELT pipeline](https://github.com/inotives/felts)
`;export{e as default};