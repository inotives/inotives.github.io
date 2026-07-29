var e=`---
title: "dbt Modeling Patterns, Macros, and Tests in ELT"
date: 2026-07-29
tags: [dbt, elt, data-engineering, macros, data-tests, modeling, crypto]
series: data-engineering
summary: "dbt works best when ELT projects use clear modeling layers, small reusable macros, and tests that protect the business meaning of marts. The goal is not clever SQL, but repeatable transformations that analysts, agents, and reports can trust."
---

# dbt Modeling Patterns, Macros, and Tests in ELT

dbt is easy to start with.

Put SQL in a model, run \`dbt build\`, get a table.

That simplicity is useful, but it also creates the first trap. A dbt project can turn into a pile of SQL files where every model knows too much, every source is cleaned three different ways, and every report has its own definition of volume.

Good dbt modeling is boring in the right places.

In ELT, dbt should make this path clear:

\`\`\`text
extract raw data
load raw tables
stage provider-shaped data
combine and apply business logic
publish marts
test the contract
document what the mart means
\`\`\`

For a crypto project:

\`\`\`text
CoinGecko payloads
-> raw_coingecko__coins_markets
-> stg_coingecko__coins_markets
-> int_asset_prices__deduped
-> mart__daily_asset_prices
\`\`\`

The pattern matters because the same data may feed dashboards, regulatory reports, natural-language analytics, and model features. If the dbt project is messy, every downstream system inherits the mess.

## Pattern 1: keep sources raw

Raw tables should preserve provider truth.

For crypto data, that means raw tables keep:

\`\`\`text
provider payload
request parameters
provider timestamp
ingested_at
run_id
payload_hash
source file or endpoint
\`\`\`

Raw is not where business cleanup belongs.

Bad raw pattern:

\`\`\`text
raw table renames provider symbols
raw table drops unknown assets
raw loader normalizes chain IDs
raw loader rewrites prices
\`\`\`

Better raw pattern:

\`\`\`text
raw table stores what the provider sent
raw table records enough metadata to replay and debug
dbt staging does type cleanup and light normalization
business mappings happen later with audited tables
\`\`\`

dbt should declare raw sources in YAML:

\`\`\`yaml
sources:
  - name: coingecko
    schema: raw
    tables:
      - name: coins_markets
        loaded_at_field: ingested_at
        freshness:
          warn_after: {count: 2, period: hour}
          error_after: {count: 6, period: hour}
\`\`\`

Source freshness is one of the first dbt checks worth adding. A perfect model over stale prices is still a bad report.

## Pattern 2: staging models clean once

Staging models create a consistent shape from raw provider data.

They should usually do:

\`\`\`text
rename columns
cast data types
standardize timestamps
flatten useful JSON fields
dedupe obvious provider retries
add stable source keys
preserve provider IDs
\`\`\`

They should usually avoid:

\`\`\`text
joining many business tables
calculating final KPIs
applying reporting rules
hiding provider quirks without a trace
\`\`\`

Example staging model:

\`\`\`sql
with source as (
    select *
    from {{ source('coingecko', 'coins_markets') }}
),

renamed as (
    select
        id as provider_asset_id,
        symbol as provider_symbol,
        name as provider_asset_name,
        current_price::numeric as price_usd,
        market_cap::numeric as market_cap_usd,
        last_updated::timestamptz as provider_updated_at,
        ingested_at,
        run_id,
        payload_hash
    from source
)

select *
from renamed
\`\`\`

The naming convention helps:

\`\`\`text
stg_<source>__<object>
\`\`\`

Examples:

\`\`\`text
stg_coingecko__coins_markets
stg_binance__balances
stg_ethereum__logs
stg_internal__accounts
\`\`\`

Staging is where the source becomes usable. It is not where it becomes business truth.

## Pattern 3: intermediate models hold business assembly

Intermediate models are for logic that is too important to bury in a final mart and too business-heavy for staging.

Examples:

\`\`\`text
dedupe price observations
join provider assets to canonical assets
prepare daily rollups
combine exchange balance snapshots
calculate exposure inputs
apply point-in-time mappings
\`\`\`

For crypto:

\`\`\`text
int_asset_prices__deduped
int_asset_prices__mapped_to_canonical_assets
int_exchange_balances__latest_snapshot
int_portfolio_exposure__priced_positions
\`\`\`

Intermediate models should have one job. Long multi-page SQL is usually a sign that a model is doing three jobs.

Example:

\`\`\`sql
with prices as (
    select *
    from {{ ref('stg_coingecko__coins_markets') }}
),

mappings as (
    select *
    from {{ ref('asset_provider_mappings') }}
    where provider_name = 'coingecko'
),

mapped as (
    select
        p.provider_asset_id,
        m.canonical_asset_id,
        p.price_usd,
        p.provider_updated_at,
        p.ingested_at,
        p.run_id
    from prices p
    left join mappings m
      on p.provider_asset_id = m.provider_asset_id
     and p.provider_updated_at >= m.valid_from
     and (m.valid_to is null or p.provider_updated_at < m.valid_to)
)

select *
from mapped
\`\`\`

This model should be tested. Missing mappings are not a cosmetic issue. They can break a portfolio report.

## Pattern 4: marts publish business truth

Marts are the tables people should query.

They should have:

\`\`\`text
clear grain
canonical IDs
business metric definitions
freshness expectations
tests
documentation
owner
run metadata
\`\`\`

Examples:

\`\`\`text
mart__daily_asset_prices
mart__portfolio_exposure
mart__exchange_balance_snapshots
mart__market_data_freshness
mart__daily_nav
\`\`\`

A mart should answer a business question:

\`\`\`text
What was the daily price of each canonical asset?
What was portfolio exposure by report date?
Which providers were stale before report publication?
Which accounts failed balance reconciliation?
\`\`\`

Example mart:

\`\`\`sql
select
    date_trunc('day', provider_updated_at)::date as report_date,
    canonical_asset_id,
    avg(price_usd) as average_price_usd,
    max(provider_updated_at) as latest_provider_updated_at,
    max(ingested_at) as latest_ingested_at,
    max(run_id) as latest_run_id
from {{ ref('int_asset_prices__mapped_to_canonical_assets') }}
where canonical_asset_id is not null
group by 1, 2
\`\`\`

The mart should not expose provider-only symbols as the primary identifier. Symbols are display fields, not IDs.

## Pattern 5: incremental models for large facts

Crypto data gets large quickly:

\`\`\`text
price ticks
order book snapshots
chain logs
exchange trades
wallet transfers
pipeline run events
\`\`\`

Rebuilding everything every time is wasteful.

Incremental models help process only new or changed data:

\`\`\`sql
{{
  config(
    materialized='incremental',
    unique_key='price_observation_id',
    incremental_strategy='merge'
  )
}}

select
    {{ dbt_utils.generate_surrogate_key([
      'provider_asset_id',
      'provider_updated_at',
      'payload_hash'
    ]) }} as price_observation_id,
    provider_asset_id,
    price_usd,
    provider_updated_at,
    ingested_at,
    run_id
from {{ ref('stg_coingecko__coins_markets') }}

{% if is_incremental() %}
where ingested_at > (
    select coalesce(max(ingested_at), '1900-01-01'::timestamp)
    from {{ this }}
)
{% endif %}
\`\`\`

Incremental models need extra discipline:

\`\`\`text
stable unique key
late-arriving data policy
backfill policy
tests for duplicates
clear full-refresh procedure
\`\`\`

For financial reports, "incremental" should not mean "we cannot replay history." Keep raw data and mappings versioned so marts can be rebuilt when needed.

## Pattern 6: ephemeral models only for small reusable logic

Ephemeral models are injected as common table expressions into downstream SQL. They do not materialize as warehouse relations.

Use them for:

\`\`\`text
small helper transformations
light reusable CTE logic
private building blocks
\`\`\`

Avoid them for:

\`\`\`text
large joins
expensive aggregations
debug-heavy logic
models used by many downstream marts
\`\`\`

Ephemeral models can make the warehouse cleaner, but they can also make compiled SQL harder to debug. Use them sparingly.

## Macros: reuse logic, not business confusion

Macros are dbt's Jinja-powered reuse tool.

Good macro uses:

\`\`\`text
surrogate key generation
safe casting
timestamp normalization
repeated filter clauses
currency conversion helpers
common source metadata columns
test SQL generation
\`\`\`

Bad macro uses:

\`\`\`text
hiding 200 lines of business logic
creating SQL frameworks inside dbt
abstracting one model for no reuse
making queries unreadable to analysts
\`\`\`

A useful macro should remove boring duplication without hiding meaning.

Example macro:

\`\`\`sql
{% macro source_metadata_columns() %}
    ingested_at,
    run_id,
    payload_hash
{% endmacro %}
\`\`\`

Usage:

\`\`\`sql
select
    provider_asset_id,
    price_usd,
    provider_updated_at,
    {{ source_metadata_columns() }}
from {{ ref('stg_coingecko__coins_markets') }}
\`\`\`

Another useful macro:

\`\`\`sql
{% macro canonical_asset_join(left_alias, provider_name) %}
left join {{ ref('asset_provider_mappings') }} asset_map
  on {{ left_alias }}.provider_asset_id = asset_map.provider_asset_id
 and asset_map.provider_name = '{{ provider_name }}'
 and {{ left_alias }}.provider_updated_at >= asset_map.valid_from
 and (
     asset_map.valid_to is null
     or {{ left_alias }}.provider_updated_at < asset_map.valid_to
 )
{% endmacro %}
\`\`\`

Use it only if the join is truly repeated. If one model needs it, write the SQL directly.

## Tests: protect the contract

dbt tests are SQL checks. Passing tests return zero failing rows.

Use generic tests for common rules:

\`\`\`yaml
models:
  - name: mart__daily_asset_prices
    columns:
      - name: canonical_asset_id
        data_tests:
          - not_null
      - name: report_date
        data_tests:
          - not_null
\`\`\`

Use relationship tests when one table depends on another:

\`\`\`yaml
models:
  - name: mart__portfolio_exposure
    columns:
      - name: canonical_asset_id
        data_tests:
          - relationships:
              arguments:
                to: ref('dim_assets')
                field: canonical_asset_id
\`\`\`

Use accepted values for controlled states:

\`\`\`yaml
models:
  - name: mart__market_data_freshness
    columns:
      - name: freshness_status
        data_tests:
          - accepted_values:
              arguments:
                values: ['fresh', 'warning', 'stale']
\`\`\`

Tests should match the layer.

\`\`\`text
staging tests       keys, types, basic not-null checks
intermediate tests  mapping completeness, dedupe assumptions
mart tests          business grain, reconciliation, report blockers
\`\`\`

## Custom generic tests

When a rule repeats, make it a custom generic test.

Example: prices should be positive.

\`\`\`sql
{% test positive_value(model, column_name) %}

select *
from {{ model }}
where {{ column_name }} <= 0

{% endtest %}
\`\`\`

Usage:

\`\`\`yaml
models:
  - name: mart__daily_asset_prices
    columns:
      - name: average_price_usd
        data_tests:
          - positive_value
\`\`\`

Example: report dates cannot be in the future.

\`\`\`sql
{% test not_future_date(model, column_name) %}

select *
from {{ model }}
where {{ column_name }} > current_date

{% endtest %}
\`\`\`

These are good tests because the failure rows are obvious. A person can inspect the result and know what broke.

## Singular tests for business rules

Singular tests are SQL files for one specific rule.

Use them when the check is too specific for a reusable generic test.

Example: daily NAV should reconcile to priced positions.

\`\`\`sql
select
    nav.report_date,
    nav.portfolio_id,
    nav.nav_usd,
    exposure.total_exposure_usd
from {{ ref('mart__daily_nav') }} nav
join {{ ref('mart__portfolio_exposure') }} exposure
  on nav.report_date = exposure.report_date
 and nav.portfolio_id = exposure.portfolio_id
where abs(nav.nav_usd - exposure.total_exposure_usd) > 0.01
\`\`\`

If this returns rows, the report should not publish.

For crypto reporting, singular tests are useful for:

\`\`\`text
portfolio exposure reconciliation
daily price completeness for held assets
provider mapping validity at report time
stale source blocking rules
duplicate exchange balance snapshots
\`\`\`

## Warning vs failure

Not every test should block the pipeline.

Examples:

\`\`\`text
warn: a delisted asset has no fresh price today
warn: non-critical reference table is older than expected
fail: BTC price missing for report date
fail: canonical asset ID is null in portfolio mart
fail: daily NAV does not reconcile
\`\`\`

Configure severity intentionally:

\`\`\`yaml
models:
  - name: dim_platforms
    columns:
      - name: platform_name
        data_tests:
          - not_null:
              config:
                severity: warn
\`\`\`

Warnings should still become visible in run logs, dashboards, or Slack. A warning is not a deleted failure. It is a non-blocking signal.

## Unit tests for SQL logic

Data tests check real model outputs. Unit tests check model logic with controlled inputs.

Use unit tests for logic that is easy to break:

\`\`\`text
case statements
classification rules
fee tier logic
asset status derivation
freshness status calculation
KPI decomposition buckets
\`\`\`

Example:

\`\`\`text
if freshness lag <= 30 minutes, status is fresh
if freshness lag <= 2 hours, status is warning
otherwise, status is stale
\`\`\`

This kind of logic should not need a production dataset to test. Small fixtures are enough.

## How dbt fits in ELT

In ELT, dbt should own transformations and quality gates after raw data lands.

The orchestrator owns:

\`\`\`text
extract jobs
load jobs
schedules
retries
backfills
alerts
\`\`\`

dbt owns:

\`\`\`text
source definitions
staging models
intermediate models
marts
macros
tests
docs
lineage
\`\`\`

Example workflow:

\`\`\`text
Prefect or Dagster extracts CoinGecko and exchange data
loader writes append-only raw tables
dbt build runs selected staging, intermediate, and mart models
dbt tests fail or warn
orchestrator reads dbt artifacts
Slack alert fires for report blockers
reports publish only after mart tests pass
\`\`\`

This split keeps extraction code out of dbt and business SQL out of orchestration scripts.

## The rule

Use models for business shape.

Use macros for boring repetition.

Use tests for trust boundaries.

For crypto ELT, that means:

\`\`\`text
raw preserves provider truth
staging cleans once
intermediate models assemble business logic
marts publish canonical analytics
macros remove repeated plumbing
tests protect report-critical assumptions
\`\`\`

The best dbt project is not the one with the most clever macros. It is the one where a wrong price, missing asset mapping, duplicate balance, or stale source gets caught before it reaches the report.

## References

- [dbt documentation](https://docs.getdbt.com/docs/introduction)
- [dbt best practices](https://docs.getdbt.com/best-practices)
- [dbt materializations](https://docs.getdbt.com/docs/build/materializations)
- [dbt Jinja and macros](https://docs.getdbt.com/docs/build/jinja-macros)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt unit tests](https://docs.getdbt.com/docs/build/unit-tests)
- [dbt source freshness](https://docs.getdbt.com/docs/build/sources)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
- [When to Fail the Pipeline vs Warn](/posts/2026-07-22-when-to-fail-pipeline-vs-warn)
- [Data Lineage for Small Crypto Pipelines](/posts/2026-07-24-data-lineage-small-crypto-pipelines)
`;export{e as default};