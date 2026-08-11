var e=`---
title: "Data Engineering in 30 Days, Days 13–15: Data Modelling, Marts, and dbt"
date: 2026-08-11
tags: [data-engineering, learning-path, data-modelling, dbt]
summary: "Learn how data modelling turns raw records into dependable consumer-facing tables, then see why modern data stacks use dbt for SQL transformations, dependencies, tests, documentation, and controlled delivery."
series: data-engineering-in-30-days
---

Ingestion gives you records. Data modelling gives those records meaning that another person can use without rediscovering every source quirk.

For a market-data system, a raw provider payload might contain \`BTCUSDT\`, \`lastPrice\`, and a timestamp. A research analyst needs a stable \`market\`, a standardised quote currency, a documented observation time, and a table that does not change its shape every time a provider changes an API field. The gap between those two is modelling work.

Days 13–15 build the concepts first, then introduce dbt as a practical tool for running and maintaining SQL transformations in a modern data stack.

## The outcome for these three days

By the end, you should be able to:

1. Define entities, relationships, facts, dimensions, and a table's grain.
2. Explain why normalised source models and dimensional analytics models solve different problems.
3. Design a raw → staging → mart flow for a small pipeline.
4. Explain what dbt does, what it does not do, and why teams use it.
5. Recognise the dbt files and commands used most often by data engineers.

## 1. Model the business before modelling the columns

Data modelling starts with the real-world nouns and events that the system needs to represent.

For market data, the important entities may be:

\`\`\`text
Provider: an exchange or market-data vendor
Asset: a tradable unit such as BTC or USD
Market: a base asset traded against a quote asset on a provider
Observation: a measured price or volume at a point in time
\`\`\`

Relationships describe how they connect:

\`\`\`text
one provider → many markets
one market   → many observations
one asset    → many markets as a base or quote asset
\`\`\`

Before writing tables, write one sentence for the grain of each record:

| Model | Grain |
| --- | --- |
| \`provider\` | One row per provider. |
| \`market\` | One row per provider-specific tradable market. |
| \`price_observation\` | One row per provider market at one observation time. |
| \`daily_market_price\` | One row per provider market per UTC calendar date. |

Grain protects the model from accidental duplication. A \`market\` record should not repeat once per price. A daily summary should not claim to represent individual events. State the grain in model documentation and code review; it is the shortest explanation of what a table promises.

## 2. Normalisation keeps source facts consistent

**Normalisation** separates data into related tables so that each fact is stored in one sensible place. It reduces contradictory copies and makes updates safer.

Consider a flat observation table:

\`\`\`text
provider_name | provider_country | symbol   | base_asset | quote_asset | observed_at | price
Binance       | Cayman Islands   | BTCUSDT  | BTC        | USDT        | 09:00       | 118450.25
Binance       | Cayman Islands   | ETHUSDT  | ETH        | USDT        | 09:00       | 3850.10
\`\`\`

\`provider_country\` is repeated for every observation. If the value is corrected in one record but not another, the table contains two versions of the same provider fact.

A normalised design separates the entities:

\`\`\`text
provider(provider_id, provider_name, provider_country)
market(market_id, provider_id, source_symbol, base_asset_id, quote_asset_id)
price_observation(market_id, observed_at, price, received_at)
\`\`\`

Normalisation is valuable in operational and canonical layers where data needs clear ownership, relationships, and low duplication. It is not a commandment to split every field into its own table. Over-normalising can make ordinary analytical questions require many joins and make models hard to use.

## 3. Dimensional modelling makes analysis easier

Analytics often benefits from a different shape. A **fact table** records measurable events at a defined grain. A **dimension table** provides the descriptive context used to filter, group, and label those facts.

\`\`\`text
dim_market                         fct_price_observation
┌───────────┬──────────┬────────┐  ┌───────────┬─────────────────────┬──────────┐
│ market_id │ provider │ symbol │  │ market_id │ observed_at         │ price    │
├───────────┼──────────┼────────┤  ├───────────┼─────────────────────┼──────────┤
│ 101       │ Binance  │ BTC/USD│  │ 101       │ 2026-08-11 09:00:00 │ 118450.25│
└───────────┴──────────┴────────┘  └───────────┴─────────────────────┴──────────┘
\`\`\`

The star-shaped relationship makes frequent questions direct:

\`\`\`sql
SELECT
  m.provider,
  m.symbol,
  avg(f.price) AS average_price
FROM analytics.fct_price_observation AS f
JOIN analytics.dim_market AS m
  ON m.market_id = f.market_id
WHERE f.observed_at >= DATE '2026-08-11'
  AND f.observed_at < DATE '2026-08-12'
GROUP BY m.provider, m.symbol;
\`\`\`

The fact table may be very large. The dimension is comparatively small and stable. This is a useful pattern for events, orders, payments, clicks, and inventory movements.

Two warnings matter:

- A fact is not defined by its name. \`daily_market_price\` is a fact table if it contains measurements at a daily grain.
- Dimensions can change. If a market's classification or provider name changes, decide whether reports should use the new value for all history or preserve the historical value. That choice leads to slowly changing dimensions, a topic to deepen later.

## 4. Build layers so consumers do not inherit source chaos

One of the most durable modelling patterns is to keep distinct layers:

\`\`\`text
raw → staging → intermediate → marts
\`\`\`

| Layer | Purpose | Typical rule |
| --- | --- | --- |
| Raw | Preserve source evidence close to its original form. | Do not silently fix or discard source meaning. |
| Staging | Rename, type, and standardise one source at a time. | One source table in, one predictable model out. |
| Intermediate | Combine or prepare models for a specific transformation. | Make complex logic readable without becoming a public contract. |
| Mart | Publish a stable business-facing model. | One clear consumer purpose and documented grain. |

For the provider price feed:

\`\`\`text
raw.binance_ticker_payloads
  → stg_binance__price_observations
  → int_price_observations_standardised
  → fct_price_observation
  → mart_daily_market_price
\`\`\`

The staging model can turn provider-specific JSON fields into consistent names and types. The intermediate model can map \`BTCUSDT\` to a canonical market ID and reject ambiguous records. The mart can expose daily open, high, low, close, and volume to a dashboard or AI analyst.

This is not ceremony for its own sake. When the provider renames \`lastPrice\`, the change should mostly be contained in its staging model. Consumers of \`mart_daily_market_price\` should not need to know that an upstream API changed a field name.

## 5. dbt makes SQL transformations a software project

**dbt**, short for data build tool, runs SQL transformations in your data platform and adds the structure that hand-written SQL folders usually lack: model dependencies, reusable references, tests, documentation, and environments.

In a modern stack, the warehouse or database does the computation. dbt compiles models into SQL and asks that platform to run them. This is why dbt works with warehouses such as BigQuery, Snowflake, and Databricks, and with databases such as PostgreSQL and DuckDB through adapters.

dbt is useful because it turns this fragile arrangement:

\`\`\`text
analyst_query_final_v7.sql
run this before that file
ask Sam which table feeds the dashboard
\`\`\`

into an explicit dependency graph:

\`\`\`text
source('raw', 'binance_ticker_payloads')
  → stg_binance__price_observations
  → int_price_observations_standardised
  → fct_price_observation
  → mart_daily_market_price
\`\`\`

The modern stack uses dbt because data transformations need the same discipline as application code: changes should be reviewed, reproducible, testable, documented, and deployable. It does not mean dbt is the only modelling tool or that every SQL query needs a dbt project.

### What dbt does not do

dbt is not an API extractor, a general-purpose scheduler, a streaming engine, or a replacement for a warehouse. It typically starts after ingestion has made source data available. An orchestrator can schedule dbt, and Python can collect source records, but dbt is focused on transforming data through SQL.

Keeping that boundary clear avoids a common beginner error: putting API calls and mutable operational work inside the modelling layer because dbt is already present.

## 6. The dbt project pieces you will use most

A minimal dbt project has SQL models and YAML files beside them. The exact folder layout varies by team, but these parts recur:

| dbt item | What it does | Example use |
| --- | --- | --- |
| Model (\`.sql\`) | A \`SELECT\` statement that builds a view or table. | \`stg_binance__price_observations.sql\`. |
| \`source()\` | Declares an upstream table that dbt does not build. | Read raw payloads loaded by Python. |
| \`ref()\` | Declares a dependency on another dbt model. | Build a mart from \`fct_price_observation\`. |
| \`schema.yml\` | Documents models and columns; defines tests. | State grain and test that \`market_id\` is not null. |
| Generic test | A reusable rule such as \`not_null\`, \`unique\`, or \`relationships\`. | Ensure a fact links to a valid dimension. |
| Singular test | A custom SQL query that returns failing rows. | Find observations where price is non-positive. |
| \`seed\` | A version-controlled CSV loaded into the warehouse. | Small canonical symbol mapping maintained by the team. |
| Snapshot | A historical record of how mutable source rows changed. | Track changes to a provider's market metadata. |
| Macro | Reusable Jinja or SQL logic. | Standardise a provider symbol with one shared expression. |
| Documentation | Generated lineage, model descriptions, and column definitions. | Help an analyst find the right mart. |

Here is a simple staging model:

\`\`\`sql
-- models/staging/stg_binance__price_observations.sql
SELECT
  'Binance' AS provider,
  symbol,
  CAST(last_price AS numeric) AS price,
  observed_at,
  received_at
FROM {{ source('raw', 'binance_price_observations') }}
WHERE symbol IS NOT NULL;
\`\`\`

And a model that depends on it:

\`\`\`sql
-- models/marts/mart_daily_market_price.sql
SELECT
  provider,
  symbol,
  CAST(observed_at AS date) AS observation_date,
  min(price) AS low_price,
  max(price) AS high_price,
  avg(price) AS average_price
FROM {{ ref('stg_binance__price_observations') }}
GROUP BY provider, symbol, CAST(observed_at AS date);
\`\`\`

\`ref()\` is more than a text shortcut. It lets dbt build the dependency graph, choose models in the right order, generate lineage, and resolve the correct relation for an environment.

## 7. Common dbt commands for daily engineering work

These are the commands worth understanding first:

| Command | What it checks or does |
| --- | --- |
| \`dbt parse\` | Parses the project and catches many structural errors without running models. |
| \`dbt compile\` | Renders Jinja and compiles models to executable SQL. |
| \`dbt run\` | Builds selected models. |
| \`dbt test\` | Runs generic and singular tests. |
| \`dbt build\` | Runs models, tests, snapshots, and seeds in dependency-aware order. |
| \`dbt seed\` | Loads version-controlled CSV seed files. |
| \`dbt docs generate\` | Produces documentation and lineage artefacts. |
| \`dbt ls\` | Lists resources selected by a selector. |

For a small model change, a useful habit is:

\`\`\`text
dbt parse
dbt build --select +mart_daily_market_price
\`\`\`

The leading \`+\` selects the mart and its upstream dependencies. The right selector depends on the question: during a narrow edit, run the changed model, its relevant parents, and its tests. Before a release, run the project scope that your team treats as the contract.

## 8. dbt tests turn assumptions into executable rules

Tests are where a model declares what it considers acceptable. A basic YAML definition might look like this:

\`\`\`yaml
version: 2

models:
  - name: fct_price_observation
    description: "One row per provider market and observation time."
    columns:
      - name: market_id
        tests:
          - not_null
          - relationships:
              to: ref('dim_market')
              field: market_id
      - name: observed_at
        tests: [not_null]
\`\`\`

Exact YAML style varies by dbt version and team conventions. The central idea does not: if an observation must link to a known market, make that claim executable. Do not leave it as a sentence in a ticket.

Use a custom singular test for business logic that generic tests cannot express cleanly:

\`\`\`sql
-- tests/assert_positive_prices.sql
SELECT *
FROM {{ ref('fct_price_observation') }}
WHERE price <= 0;
\`\`\`

A dbt test fails when this query returns rows. The failed rows are the investigation queue, not a reason to delete data blindly.

## A small exercise for day 15

Draw a model map for your source from Days 1–12. Start with one provider or file, not every source at once.

\`\`\`text
1. Name the entities and write the grain for each model.
2. Choose a raw, staging, and mart model.
3. Write one staging SELECT that renames and types source fields.
4. Write one mart SELECT that answers a real consumer question.
5. Add three tests: a required field, a uniqueness expectation, and a relationship.
6. State which logic belongs in ingestion, SQL/dbt, and an orchestrator.
\`\`\`

The exercise is successful if another person can identify the source, intended grain, consumer, and failure conditions without reading the original API documentation.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Entity | A distinct business object the system represents. | \`Help me identify entities, attributes, and relationships for an exchange market-data system. Explain why an observation is different from a market.\` |
| Relationship | A defined connection between records or entities. | \`Explain one-to-many and many-to-many relationships using providers, markets, assets, and price observations.\` |
| Normalisation | Separating related facts to reduce contradictory duplication. | \`Teach normalisation with a flat price feed. Show the problem, then split it into provider, market, and observation tables.\` |
| Fact table | A table of measured events or observations at a declared grain. | \`Explain fact-table grain using hourly market prices. What columns are measures, keys, and timestamps?\` |
| Dimension table | A table of descriptive context used with facts. | \`Teach dimension tables with a market dimension. Explain why changing dimension values can alter historical reports.\` |
| Star schema | A fact table joined to surrounding dimensions. | \`Draw a star schema for price observations, markets, providers, and assets. Show one analytical query it makes easy.\` |
| Data mart | A stable model published for a clear consumer purpose. | \`Explain how a data mart differs from a raw table and a staging model. Design one for a daily market-price dashboard.\` |
| dbt model | A SQL transformation managed and built by dbt. | \`Teach dbt models, materializations, and model grain using raw, staging, and mart layers.\` |
| \`source()\` | dbt's declaration of an upstream relation it does not build. | \`Show how to define and use a dbt source for a raw price-observation table. Why does source freshness matter?\` |
| \`ref()\` | dbt's reference to another dbt model. | \`Explain ref() as a dependency and lineage tool rather than a simple table-name shortcut. Show a two-model example.\` |
| Generic test | A reusable dbt test applied through YAML. | \`Teach not_null, unique, accepted_values, and relationships tests for a price-observation fact model.\` |
| Snapshot | A dbt pattern for preserving versions of mutable source rows. | \`Explain dbt snapshots using changing market metadata. When is a snapshot better than overwriting a dimension?\` |
| Macro | Reusable parameterised SQL or Jinja logic in dbt. | \`Show a simple dbt macro for normalising provider symbols. When would a macro be unnecessary abstraction?\` |

When asking an LLM to generate a dbt model, include the source grain, target grain, warehouse dialect, and tests you expect. Then inspect its joins and \`GROUP BY\` clauses using the SQL execution order from Days 5–7. dbt makes the project easier to operate; it does not make an incorrect model correct.

## What comes next

Days 16–17 go deeper into dbt transformations: model materialisations, incremental models, selectors, test strategy, documentation, and the decisions that keep a dbt project useful as it grows.

## References

- [dbt documentation](https://docs.getdbt.com/)
- [dbt guide: how we structure dbt projects](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview)
- [dbt command reference](https://docs.getdbt.com/reference/dbt-commands)
- [PostgreSQL documentation: data definition](https://www.postgresql.org/docs/current/ddl.html)
`;export{e as default};