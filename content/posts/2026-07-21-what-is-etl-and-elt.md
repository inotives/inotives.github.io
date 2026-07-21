---
title: "What Is ETL and ELT? When to Use One Over the Other"
date: 2026-07-21
tags: [etl, elt, data-engineering, pipelines, data-warehouse, analytics]
series: data-engineering
summary: "ETL and ELT are two ways to move data from source systems into usable analytics tables. The difference is where transformation happens, and the right choice depends on data sensitivity, warehouse power, latency, cost, and how much raw history you need to preserve."
---

# What Is ETL and ELT? When to Use One Over the Other

ETL and ELT are two names for the same basic job: move data from source systems into a place where people and software can use it.

The letters are the workflow:

```text
ETL = Extract, Transform, Load
ELT = Extract, Load, Transform
```

The difference is where the transformation happens.

In ETL, you clean and reshape the data before it lands in the target system.

In ELT, you load raw or lightly processed data first, then transform it inside the warehouse, lakehouse, or database.

That sounds like a small ordering change. It changes how you debug, how much raw history you keep, where compute costs land, and how safely you handle sensitive data.

## ETL in plain English

ETL means:

```text
extract from source -> transform in pipeline code -> load clean output
```

The target system receives data that has already been filtered, normalized, validated, or aggregated.

A classic ETL pipeline might pull customer records from an app database, remove invalid rows, hash email addresses, convert date formats, and load only the clean customer dimension into a warehouse.

The raw source payload may never reach the warehouse.

That can be good. It can also hurt later.

## ELT in plain English

ELT means:

```text
extract from source -> load raw data -> transform inside the warehouse
```

The target system receives raw or near-raw data first. Then SQL models, dbt, Spark, stored procedures, or warehouse jobs turn it into staging tables and marts.

A typical ELT flow might load raw Stripe events into `raw.stripe_events`, then use dbt to build `stg_stripe__charges`, `mart__revenue`, and `mart__customer_ltv`.

The raw data stays available for replay and debugging.

That is the main reason ELT became popular with modern cloud warehouses. Storage got cheap, warehouses got powerful, and teams wanted to preserve raw history instead of throwing it away inside pipeline code.

## The shortest decision rule

Use ETL when the data must be changed before it lands.

Use ELT when you can safely land raw data and want the warehouse to do the transformation.

That rule covers most cases.

ETL is stronger when privacy, bandwidth, legacy systems, or target limits force you to clean early.

ELT is stronger when the warehouse is powerful, raw history matters, and transformations should be testable, replayable, and visible.

## Real-world ETL examples

Healthcare data is a good ETL case.

Suppose a hospital exports patient records for analytics. The analytics warehouse does not need full names, addresses, notes, or raw identifiers. The pipeline can tokenize patient IDs, remove restricted fields, normalize diagnosis codes, and load a safer dataset.

That is ETL because transformation is part of the trust boundary.

Payment data can be similar. If a company processes card data, the analytics system should not receive raw PANs or sensitive authentication fields. The pipeline should redact, tokenize, or aggregate before loading.

ETL also makes sense when the target system is weak. If the destination is a small reporting database, a SaaS tool, or a fixed-schema system, doing heavy cleanup before loading may be simpler than asking the target to transform messy data.

## Real-world ELT examples

Product analytics is often a good ELT case.

You load raw events from a website or app:

```text
page_view
signup_started
checkout_completed
subscription_cancelled
```

Then the warehouse builds models for funnels, retention, activation, and revenue. Different teams can transform the same raw events for different questions.

Crypto market data is another good ELT case.

In a small project like `market-pipe`, I would usually load raw CoinGecko or exchange responses first. Keep the provider's IDs, symbols, timestamps, and payload shape. Then transform them into staging and mart tables:

```text
raw.coingecko_coins
stg_coingecko__coins
mart__assets
mart__asset_prices
mart__portfolio_exposure
```

That raw layer is useful because crypto providers change. Symbols collide. Tokens migrate. Reference data and price data age differently. If the transform logic is wrong, you can fix the model and replay from raw data.

That is the heart of ELT: preserve source truth, then build trusted consumer truth.

## The crypto version

Here is a concrete crypto example.

You pull a token list from a provider. Each row has:

```text
id
symbol
name
asset_platform_id
contract_address
updated_at
```

An ETL pipeline might normalize it in application code and load only:

```text
canonical_asset_id
display_symbol
display_name
chain_id
contract_address
```

That can work if the mapping rules are stable and the raw payload is not needed.

But I would usually pick ELT here:

```text
load raw provider rows
build staging model with provider-specific names
build mapping table to canonical assets
build mart for agent/reporting use
test identity, freshness, and relationships
```

Crypto data has too many identity traps to throw raw evidence away early. If a provider changes a token ID, a symbol collides, or a contract mapping is wrong, the raw table lets you inspect what really arrived.

## Where dbt fits

dbt is mostly an ELT tool.

It does not extract from APIs. It does not usually load raw files. It shines after the data is already in the warehouse.

That is why a common modern stack looks like this:

```text
ingestion tool -> raw warehouse tables -> dbt staging -> dbt marts -> dashboards/agents
```

In that setup, ingestion should be boring. Pull the data, store it, record the run. dbt handles transformation, tests, docs, contracts, and lineage.

This is why dbt makes sense even for small crypto projects. Once two sources need to agree, the transform logic is important enough to name and test.

## When ETL is the better choice

Pick ETL when raw data should not land in the target.

Common reasons:

- the source contains sensitive fields the warehouse should never store
- the target has strict schema or size limits
- the network cost of moving raw data is too high
- the source data must be validated before crossing a boundary
- the target cannot run the transformations efficiently
- the business only needs a small aggregate, not raw detail

Example: a payroll system exports compensation data for a finance report. The pipeline can aggregate by department and month, remove employee-level fields, and load only the report-safe output.

That is a good ETL use case.

## When ELT is the better choice

Pick ELT when raw history is valuable and the target can transform it well.

Common reasons:

- you need replayable transformations
- different teams need different models from the same raw source
- data quality rules are still evolving
- warehouse compute is cheaper than application-side transformation
- lineage and dbt tests matter
- agents or analysts need traceability from mart back to source

Example: an ecommerce company loads raw orders, payments, refunds, shipments, and customer events into a warehouse. Finance builds revenue marts. Product builds retention models. Support builds customer timelines.

That is a good ELT use case.

## The mixed approach is normal

Real pipelines often use both.

You might do light ETL before loading:

```text
parse JSON
drop secrets
validate required IDs
add ingestion timestamp
load raw-safe data
```

Then use ELT for analytics:

```text
normalize source fields
map identities
join facts
calculate metrics
publish marts
```

That is usually the best shape.

Do the minimum transformation needed to store data safely. Then do the business transformation where it can be tested, documented, and replayed.

## The agent angle

Agents make ELT more attractive for analytics work because agents need evidence.

If an agent debugs a portfolio report, it should be able to inspect the chain:

```text
raw provider payload -> staging model -> asset mapping -> price mart -> report
```

If the only artifact is a final loaded table, the agent has less to inspect. It may still answer, but it has to infer more.

That does not mean agents should see every raw table. Production agents should usually query curated views and marts. But the pipeline should preserve enough raw and staging data for debugging, replay, and review.

Raw data is not always for the end-user agent. It is for the engineering loop.

## The practical rule

ETL is best when data must be made safe or small before loading.

ELT is best when raw history should be preserved and the warehouse can handle transformation.

For most modern analytics pipelines, especially crypto analytics, I would start with ELT plus a small ETL safety step at ingestion.

Load raw-safe data. Transform in dbt. Test the domain rules. Expose clean marts to dashboards and agents.

That gives you traceability without giving every consumer the raw mess.

## References

- [dbt documentation](https://docs.getdbt.com/docs/introduction)
- [Apache Airflow: The Workflow Orchestrator That 80% of the Data Stack Still Runs On](/posts/2026-07-03-apache-airflow-deep-dive)
- [Apache Spark in 2026: The Compute Engine That 80% of Fortune 500 Still Runs On](/posts/2026-07-03-apache-spark-deep-dive)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
