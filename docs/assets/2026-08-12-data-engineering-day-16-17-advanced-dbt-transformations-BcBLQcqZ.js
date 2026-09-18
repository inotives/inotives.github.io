var e=`---
title: "Data Engineering in 30 Days, Days 16–17: Advanced dbt Transformations That Stay Maintainable"
date: 2026-08-12
tags: [data-engineering, learning-path, dbt, transformations]
summary: "Go beyond basic dbt models: choose materialisations, build safe incremental models, use macros sparingly, select the right scope to run, and keep tests and documentation close to transformation logic."
series: data-engineering-in-30-days
---

The first dbt model is usually straightforward: write a \`SELECT\`, add \`ref()\`, run it, and see a table appear. The harder work begins when the data grows, the source changes, and several people need to understand why a model behaves the way it does.

Days 16–17 focus on the dbt techniques that solve those real problems without turning a SQL project into a Jinja maze. The guiding rule is simple: prefer clear SQL and a small model graph. Add an advanced feature only when it removes repeated work or makes the model safer to operate.

We will continue the market-data pipeline. Raw provider observations feed a standardised fact table and a daily mart for analysts and AI workflows.

## The outcome for these two days

By the end, you should be able to:

1. Choose a dbt materialisation from the access pattern and cost of a model.
2. Build an incremental model that handles retries, late data, and backfills.
3. Write a small macro when repeated SQL is genuinely the same behaviour.
4. Use selectors to run an appropriate slice of the dependency graph.
5. Keep tests, documentation, and model contracts close to the transformations they protect.

## 1. A model needs a materialisation decision

A dbt model is a \`SELECT\` statement. A **materialisation** decides what database object dbt creates from that statement.

| Materialisation | What the database keeps | Good fit | Cost or limitation |
| --- | --- | --- | --- |
| \`view\` | Saved query, evaluated when read. | Lightweight staging logic or rarely queried models. | Downstream reads repeat the query work. |
| \`table\` | A rebuilt physical table. | Expensive models, stable daily marts, or convenient downstream reads. | Rebuild cost and temporary storage can grow with data. |
| \`incremental\` | A physical table changed with new or updated rows. | Large append-heavy facts such as price observations. | Requires correct merge and late-data policy. |
| \`ephemeral\` | A compiled CTE embedded in dependent models. | Small, private helper logic used by a few models. | Cannot be queried directly or independently tested as a relation. |
| \`materialized view\` | A database-managed precomputed result, where supported. | Platform-specific read acceleration. | Refresh and feature behaviour depend on the adapter and database. |

Do not make every model a table. A simple staging view is often easier to maintain because it always reflects its source. Do not make every large model incremental either. A daily 50,000-row mart can be simpler and safer to rebuild as a table than to patch across months of edge cases.

The question is: what is the model's grain, how much data does it process, how fresh must it be, and what does a correct rebuild cost?

## 2. Incremental models are a correctness design

An incremental model runs a full \`SELECT\` on its first build. Later runs execute only the subset of logic inside \`is_incremental()\` and insert or merge those results into the existing table.

Here is a simplified price-observation fact model:

\`\`\`sql
{{ config(
    materialized='incremental',
    unique_key=['provider', 'symbol', 'observed_at'],
    incremental_strategy='merge'
) }}

SELECT
  provider,
  symbol,
  observed_at,
  price,
  received_at
FROM {{ ref('int_price_observations_standardised') }}

{% if is_incremental() %}
  WHERE received_at >= (
    SELECT coalesce(max(received_at), '1900-01-01'::timestamp)
    FROM {{ this }}
  ) - interval '10 minutes'
{% endif %}
\`\`\`

\`{{ this }}\` refers to the relation currently being built. On the first run, the \`WHERE\` block is absent and all available source rows are loaded. On later runs, the model revisits a small receipt-time overlap. The unique key and merge strategy make re-read rows update or match their existing destination rows instead of accumulating duplicates.

This model encodes several choices that must be explicit:

| Choice | Why it matters |
| --- | --- |
| Incremental boundary | \`received_at\` captures when your system saw the row; \`observed_at\` may be late or corrected. |
| Overlap window | Reprocesses recent rows that arrived late or were replayed. |
| Unique key | Defines what “the same observation” means. |
| Merge policy | Decides whether the latest source value overwrites a prior value. |
| Full-refresh behaviour | Gives an escape hatch when model logic changes or drift must be repaired. |

An incremental condition is a filter, not magic. If the source corrects a six-month-old price and the model only re-reads ten minutes, it will not notice. Use a planned backfill, a periodic reconciliation, or a wider update window when the source's correction policy requires it.

### Know when to use \`--full-refresh\`

Run a full refresh when a model's transformation logic, key, or historical interpretation changes enough that patching the old table is unsafe:

\`\`\`text
dbt build --select fct_price_observation --full-refresh
\`\`\`

That command can be expensive and can affect downstream models, so use it deliberately. Record why the rebuild happened and validate the resulting row counts, keys, and business totals. An incremental table is a performance optimisation; it must remain rebuildable from trusted inputs.

## 3. Macros remove repeated behaviour, not repeated words

A **macro** is a reusable Jinja template that generates SQL. It is useful when the same transformation rule occurs in several models and must change together.

Suppose several providers have different symbol separators but your output contract uses \`BASE/QUOTE\`. A small macro can make the standardisation rule consistent:

\`\`\`sql
-- macros/normalise_symbol.sql
{% macro normalise_symbol(symbol_expression, quote_suffix) %}
  concat(
    left({{ symbol_expression }}, length({{ symbol_expression }}) - length('{{ quote_suffix }}')),
    '/',
    '{{ quote_suffix }}'
  )
{% endmacro %}
\`\`\`

Used inside a model:

\`\`\`sql
SELECT
  {{ normalise_symbol('source_symbol', 'USDT') }} AS symbol,
  last_price AS price
FROM {{ source('raw', 'binance_price_observations') }}
\`\`\`

The macro is justified if the team agrees on this exact rule and uses it in more than one place. A repeated three-line expression alone is not enough reason to add it. A reader can inspect ordinary SQL quickly; generated SQL adds an indirection they must compile mentally.

Avoid macros that choose entire business rules from a web of flags. If Binance and Kraken have materially different parsing rules, give each a readable staging model. Use a macro for the shared narrow operation after the provider-specific differences are resolved.

### Other useful macro cases

- Emit a consistent safe-cast expression across warehouse dialects.
- Generate repetitive date-spine or partition predicates.
- Apply a shared naming rule to a small family of source fields.
- Encapsulate a tested adapter-specific implementation while exposing one project-level name.

Macro output is SQL. Always inspect compiled SQL with \`dbt compile\` when changing a macro, especially if it changes joins, filters, quoting, or data types.

## 4. Tests should match the transformation's failure modes

Days 13–15 introduced generic and singular dbt tests. At this stage, tie them to the specific risks added by an advanced model.

For an incremental price fact, test the unique grain and key relationships:

\`\`\`yaml
version: 2

models:
  - name: fct_price_observation
    description: "One row per provider, symbol, and observation time."
    columns:
      - name: provider
        tests: [not_null]
      - name: symbol
        tests: [not_null]
      - name: observed_at
        tests: [not_null]
      - name: price
        tests: [not_null]
      - name: received_at
        tests: [not_null]
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns:
            - provider
            - symbol
            - observed_at
\`\`\`

\`dbt_utils.unique_combination_of_columns\` comes from the optional \`dbt_utils\` package. Without it, write a singular test that groups by the three columns and returns any combinations with \`count(*) > 1\`.

Tests do not replace reconciliation. A uniqueness test proves no duplicate keys exist in the model; it does not prove that every source record arrived. Pair model tests with ingestion run records, source freshness checks, and periodic count comparisons.

## 5. Select the graph you need, not the whole project by habit

As a dbt project grows, \`dbt build\` across every model becomes slow and noisy for a small change. dbt selectors let you name a narrow, meaningful scope.

| Selector pattern | Typical purpose |
| --- | --- |
| \`--select model_name\` | Build one model and its directly selected tests. |
| \`--select +model_name\` | Include upstream parents required by the model. |
| \`--select model_name+\` | Include downstream children affected by the model. |
| \`--select +model_name+\` | Inspect or rebuild a local neighbourhood of the graph. |
| \`--select path:models/marts\` | Work on a folder of related models. |
| \`--select tag:critical\` | Run the models your team has marked as critical. |
| \`--select state:modified+\` | In CI, select modified resources and affected downstream models using a prior manifest. |

For a change to a market mart, start narrow:

\`\`\`text
dbt parse
dbt build --select +mart_daily_market_price
\`\`\`

Then choose the release scope based on risk. A shared macro change can affect many models, so a single downstream mart is not enough proof. Use \`dbt ls\` to see the selected resources before running an expensive command.

## 6. Documentation is part of the transformation contract

When a table is used by a dashboard, another team, or an AI agent, someone needs to answer these questions without tracing every CTE:

\`\`\`text
What is one row?
Which source and models feed it?
How fresh is it?
What does each measure mean?
Which tests protect it?
Who owns a failure?
\`\`\`

dbt's YAML descriptions and generated docs put much of this near the model. Write the grain in the model description, define the important columns, and name models after their role rather than their implementation detail. \`mart_daily_market_price\` tells a reader more than \`final_prices_v2\`.

When the model is a public interface, consider a dbt model contract where the adapter and project version support it. A contract makes the expected column names and types part of the build boundary. It is stronger than documentation, but it should follow a stable consumer need rather than be imposed on every internal staging model.

## A small exercise for day 17

Extend the model map from Days 13–15 with one incremental fact and one reusable rule.

\`\`\`text
1. Choose the fact's target grain and unique key.
2. Choose a receipt-time or update-time incremental boundary.
3. Add a small overlap and explain the late-data policy.
4. Write the full-refresh condition and how you will validate it.
5. Identify one expression repeated in at least two models; make it a macro only if its rule is truly shared.
6. Compile the project and inspect the generated SQL.
7. Run the selected upstream path and its tests.
\`\`\`

The exercise is complete when a retry, a late source record, and a full rebuild all lead to an explainable result. If the macro makes the code harder to read than the duplicated expression, delete the macro.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Materialisation | The database object dbt builds from a model. | \`Compare dbt view, table, incremental, ephemeral, and materialized-view models using raw, staging, fact, and mart layers.\` |
| Incremental model | A model that processes a bounded set of new or changed records after its first run. | \`Design an incremental dbt model for price observations with late data. Explain unique_key, merge, is_incremental(), and a 10-minute overlap.\` |
| \`is_incremental()\` | A dbt conditional that is true on incremental runs. | \`Explain what happens to a dbt model on first build, incremental run, and full refresh. Show the compiled SQL effect of is_incremental().\` |
| \`this\` | dbt's reference to the relation currently being built. | \`Explain dbt this in an incremental watermark query. What can go wrong if the existing table has no rows?\` |
| Merge strategy | A warehouse-specific incremental method that updates matching keys and inserts new ones. | \`Compare append, merge, delete+insert, and insert_overwrite incremental strategies. Which source behaviours suit each?\` |
| Backfill | A controlled rebuild of missing or changed historical data. | \`Show a safe dbt backfill for a month of corrected market prices. Include selectors, validation, and communication to consumers.\` |
| Macro | A reusable Jinja template that generates SQL. | \`Show a small dbt macro for normalising provider symbols. Explain the line between useful reuse and an over-abstracted macro.\` |
| Compiled SQL | The database-specific SQL dbt produces after rendering Jinja and refs. | \`Show how to inspect dbt compiled SQL after a macro change. What should I check before running it in production?\` |
| Selector | A dbt expression that chooses a subset of resources. | \`Teach dbt selectors using +model, model+, path, tag, and state:modified+. Give safe commands for a small model change.\` |
| Source freshness | A check that upstream source data arrived recently enough. | \`Explain dbt source freshness for a price API landing table. How is freshness different from data completeness?\` |
| Model contract | An enforced agreement about a model's columns and types. | \`Explain dbt model contracts. Which consumer-facing marts benefit, and why can contracts be excessive for volatile staging models?\` |

When asking an LLM for advanced dbt help, include the adapter, dbt version, model grain, source mutation rules, warehouse size, and the desired rebuild path. Jinja that looks generic can compile into SQL that is invalid or expensive on a particular platform.

## What comes next

Days 18–20 move from a model graph to a dependable scheduled system: orchestration, dependencies, retries, run state, data tests, and the operational difference between a green task and a trustworthy pipeline.

## References

- [dbt documentation: materializations](https://docs.getdbt.com/docs/build/materializations)
- [dbt documentation: incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [dbt documentation: Jinja and macros](https://docs.getdbt.com/docs/build/jinja-macros)
- [dbt documentation: node selection syntax](https://docs.getdbt.com/reference/node-selection/syntax)
- [dbt documentation: model contracts](https://docs.getdbt.com/docs/collaborate/govern/model-contracts)
`;export{e as default};