var e=`---
title: "Semantic Layers for Crypto Analytics"
date: 2026-07-30
tags: [semantic-layer, dbt, metrics, analytics, crypto, ai, data-engineering]
series: data-engineering
summary: "A semantic layer gives crypto analytics one governed place for metric definitions, entities, dimensions, freshness rules, and access controls. It keeps dashboards, notebooks, reports, and AI agents from reinventing volume, revenue, exposure, and active wallet logic on every query."
---

# Semantic Layers for Crypto Analytics

A clean mart is not always enough.

You can have a good \`mart__daily_exchange_volume\` table and still get three different answers to the same question:

\`\`\`text
What was ETH volume yesterday?
\`\`\`

One analyst may use executed volume. Another may use quote volume. A dashboard may use USD notional. An AI agent may join by symbol and accidentally mix Ethereum with a provider-specific token row.

The table is not the only problem. The missing piece is the meaning layer.

A semantic layer defines business meaning once:

\`\`\`text
metrics
dimensions
entities
join paths
time grains
filters
freshness expectations
access rules
\`\`\`

Then dashboards, notebooks, APIs, spreadsheets, and agents use the same definitions.

For crypto analytics, this matters because the domain is full of ambiguity:

\`\`\`text
volume can mean base units, quote units, USD notional, or executed trade volume
price can mean last trade, close, midpoint, oracle price, VWAP, or mark price
asset can mean symbol, canonical asset ID, provider ID, chain ID, or contract address
exchange can mean venue, platform, account, or legal entity
active wallet can mean sent a transfer, received a transfer, traded, deposited, or held balance
\`\`\`

Without a semantic layer, every consumer redefines the same terms in a different place.

## What a semantic layer is

A semantic layer sits between modeled data and data consumers.

It does not replace the warehouse. It does not replace dbt. It does not replace BI tools.

It defines the contract that sits above marts:

\`\`\`text
warehouse tables        physical data
dbt models              transformed data
semantic layer          business meaning
BI and agents           consumption
\`\`\`

The layer should answer:

\`\`\`text
What is the metric called?
How is it calculated?
What entity is it measured by?
What dimensions can segment it?
What time column should aggregate it?
Which filters are valid?
Which users can see it?
How fresh must the underlying data be?
\`\`\`

Example:

\`\`\`text
Metric: daily_exchange_volume_usd
Definition: sum executed trade notional converted to USD at execution time
Entity: exchange_id, base_asset_id, quote_asset_id
Time: trade_date
Dimensions: exchange, asset, quote_asset, venue_type
Freshness: daily by 08:00 UTC
Owner: data-platform
\`\`\`

That is more useful than telling stakeholders to query a table and hope they pick the right columns.

## Why crypto needs it

Crypto data has high semantic risk.

Symbols are reused:

\`\`\`text
PAY
TON
USD
ETH
BTC variants
wrapped assets
\`\`\`

Assets exist on multiple chains:

\`\`\`text
USDC on Ethereum
USDC on Solana
USDC on Polygon
native SOL
wrapped SOL
\`\`\`

Providers disagree:

\`\`\`text
CoinGecko asset IDs
exchange symbols
chain contract addresses
internal canonical asset IDs
custody account labels
\`\`\`

Metrics also shift depending on context:

\`\`\`text
spot volume vs derivatives volume
gross revenue vs net revenue
wallet activity vs user activity
book balance vs available balance
current exposure vs point-in-time report exposure
\`\`\`

A semantic layer makes those choices explicit.

It should force questions like:

\`\`\`text
Which volume?
Which asset identity?
Which reporting date?
Which source freshness rule?
Which portfolio scope?
\`\`\`

That friction is good. Fast wrong answers are expensive.

## The dbt semantic layer shape

In dbt, semantic models and metrics can describe modeled data in code. MetricFlow powers dbt's Semantic Layer by compiling metric requests into SQL based on semantic model definitions.

A semantic model usually describes:

\`\`\`text
the dbt model it is based on
the default aggregation time
entities such as asset, exchange, wallet, account, portfolio
dimensions such as date, source, venue, status
measures such as volume_usd, trade_count, balance_usd
\`\`\`

Example shape:

\`\`\`yaml
semantic_models:
  - name: exchange_volume
    description: "Daily executed crypto volume by exchange and asset."
    model: ref('mart__daily_exchange_volume')
    defaults:
      agg_time_dimension: report_date
    entities:
      - name: exchange
        type: foreign
        expr: exchange_id
      - name: base_asset
        type: foreign
        expr: base_asset_id
    dimensions:
      - name: report_date
        type: time
        type_params:
          time_granularity: day
      - name: venue_type
        type: categorical
    measures:
      - name: volume_usd
        agg: sum
      - name: trade_count
        agg: sum
\`\`\`

Then a metric can be defined on top:

\`\`\`yaml
metrics:
  - name: daily_exchange_volume_usd
    description: "Daily executed exchange volume converted to USD."
    type: simple
    label: "Daily exchange volume USD"
    type_params:
      measure: volume_usd
\`\`\`

The value is not only the YAML. The value is that the definition lives next to dbt code, gets reviewed, and can be reused by tools.

## Metric definitions should be boring

A metric definition should avoid cleverness.

Good metric:

\`\`\`text
daily_exchange_volume_usd = sum executed trade notional in USD by report_date
\`\`\`

Bad metric:

\`\`\`text
volume = whatever query this dashboard happens to use
\`\`\`

For crypto, define the metric with enough context:

\`\`\`text
gross_volume_usd
net_revenue_usd
active_trading_wallets
market_data_freshness_lag_seconds
portfolio_exposure_usd
daily_nav_usd
\`\`\`

Each metric should include:

\`\`\`text
calculation
grain
time dimension
allowed dimensions
source mart
owner
freshness SLA
known caveats
\`\`\`

Example:

\`\`\`yaml
metrics:
  - name: active_trading_wallets
    description: "Count of wallets with at least one executed trade during the selected time period."
    type: simple
    label: "Active trading wallets"
    type_params:
      measure: trading_wallet_count
\`\`\`

The phrase "active wallet" is dangerous unless the definition says what activity means.

## Entities matter more than column names

The semantic layer should center entities.

For crypto:

\`\`\`text
asset
chain
contract
exchange
venue
wallet
account
portfolio
counterparty
provider
pipeline_run
\`\`\`

Entities prevent accidental joins.

Bad join:

\`\`\`text
join prices to balances on symbol
\`\`\`

Better join:

\`\`\`text
join prices to balances on canonical_asset_id and report_date
\`\`\`

For chain assets:

\`\`\`text
canonical_asset_id
chain_id
contract_address
valid_from
valid_to
\`\`\`

The semantic layer should know which entity is the primary key, which entities are foreign keys, and which joins are allowed.

This is especially useful for AI agents. An agent should not invent a join path between wallet balances and price tables because two columns have similar names.

## Dimensions control safe slicing

Dimensions are how users slice metrics.

Examples:

\`\`\`text
report_date
exchange_id
base_asset_id
quote_asset_id
chain_id
venue_type
portfolio_id
freshness_status
asset_sector
\`\`\`

A semantic layer should expose dimensions that make sense for the metric.

For \`daily_exchange_volume_usd\`, useful dimensions might be:

\`\`\`text
report_date
exchange
base_asset
quote_asset
venue_type
\`\`\`

For \`portfolio_exposure_usd\`, useful dimensions might be:

\`\`\`text
report_date
portfolio
canonical_asset
chain
custodian
\`\`\`

Do not expose every column as a dimension. Some columns are metadata. Some are debugging fields. Some create misleading cuts.

Examples to hide by default:

\`\`\`text
payload_hash
raw_id
internal loader cursor
provider debug code
temporary migration flag
\`\`\`

Stakeholders need meaningful building blocks, not the entire warehouse schema.

## Freshness belongs in the semantic layer

Crypto analytics gets stale quickly.

The semantic layer should not only say what a metric means. It should say whether the metric is current enough to use.

For example:

\`\`\`text
market_data_freshness_lag_seconds
exchange_balance_snapshot_age_seconds
cdc_replication_lag_seconds
last_successful_run_at
freshness_status
\`\`\`

A dashboard or agent answer should include:

\`\`\`text
metric used
time window
freshness status
data cutoff
source run ID
\`\`\`

For stakeholder analytics:

\`\`\`text
Question: What was BTC volume yesterday?
Answer: BTC volume was $X using daily_exchange_volume_usd. Data is current through 2026-07-30 08:03 UTC.
\`\`\`

If the data is stale, the system should say so before the number.

## The semantic layer and AI agents

AI agents make semantic layers more important.

A human analyst may know that \`volume_usd\` in one table excludes internal transfers. An LLM will not know unless the model context says it.

Point an agent at raw tables and it will infer:

\`\`\`text
which table to use
which joins are valid
which metric definition is correct
which filters matter
which freshness rules apply
\`\`\`

That is too much guessing.

Point an agent at a semantic layer and the task becomes safer:

\`\`\`text
find the approved metric
choose allowed dimensions
apply required time filters
return the metric definition
return freshness metadata
show query provenance
\`\`\`

For MCP-based analytics, expose semantic tools before raw SQL:

\`\`\`text
list_metrics
describe_metric
list_dimensions_for_metric
query_metric
get_metric_freshness
explain_metric_definition
\`\`\`

Let SQL be the lower-level escape hatch for data engineers, not the first interface for stakeholders.

## Common crypto metrics to define

Start with the metrics people already argue about.

Trading and market data:

\`\`\`text
daily_exchange_volume_usd
trade_count
average_spread_bps
mid_price_usd
vwap_price_usd
market_data_freshness_lag_seconds
\`\`\`

Portfolio and balances:

\`\`\`text
portfolio_exposure_usd
daily_nav_usd
cash_balance_usd
available_balance_usd
book_balance_usd
unmapped_balance_count
\`\`\`

Wallet activity:

\`\`\`text
active_wallets
new_wallets
retained_wallets
reactivated_wallets
wallet_transfer_count
wallet_volume_usd
\`\`\`

Pipeline health:

\`\`\`text
successful_runs
failed_runs
quarantine_rows
freshness_warnings
mapping_gaps
report_blockers
\`\`\`

Do not define 100 metrics at once. Start with the metrics that appear in reports, Slack incidents, and recurring stakeholder questions.

## Governance and access

The semantic layer should help enforce access rules.

Examples:

\`\`\`text
finance users can see report marts
trading users can see market data metrics
operations users can see freshness and pipeline metrics
stakeholders can query approved aggregate metrics
agents cannot query raw or sensitive tables
\`\`\`

For AI-assisted analytics, the guardrails should include:

\`\`\`text
approved metrics only
approved dimensions only
default time windows
freshness checks
row limits
no raw table access
no PII or secrets
query audit logs
clear refusal messages
\`\`\`

If someone asks:

\`\`\`text
Show every wallet and its balance history.
\`\`\`

The system should refuse or route to an approved aggregate metric. Natural language should not bypass data access policy.

## Semantic layer does not fix bad marts

A semantic layer cannot rescue weak modeling.

If the mart has duplicate rows, broken grain, stale mappings, or ambiguous IDs, the semantic layer will encode bad truth.

Before exposing a metric:

\`\`\`text
test the mart grain
document canonical IDs
check freshness
verify point-in-time joins
define ownership
add data quality tests
review metric naming
\`\`\`

The semantic layer is the contract above the mart. The mart still has to be correct.

## A practical rollout plan

Use a small rollout.

\`\`\`text
1. Pick five recurring stakeholder questions.
2. Identify the marts that should answer them.
3. Define the metric names, grains, entities, and time dimensions.
4. Add dbt tests to protect the underlying marts.
5. Add semantic model YAML for the approved marts.
6. Expose only those metrics in BI or MCP tools.
7. Require answers to include metric definition and freshness status.
8. Review query logs and add missing definitions.
\`\`\`

Example first metrics:

\`\`\`text
daily_exchange_volume_usd
portfolio_exposure_usd
daily_nav_usd
active_trading_wallets
market_data_freshness_lag_seconds
\`\`\`

That is enough to prove the pattern.

## The rule

dbt marts answer "where is the clean data?"

The semantic layer answers "what does this number mean?"

For crypto analytics, that distinction matters. Symbols collide. Providers disagree. Prices have different meanings. Stakeholders ask questions in business language. AI agents will happily fill gaps with guesses.

Define the metrics once.

Tie them to entities, dimensions, freshness, and access rules.

Then let dashboards, notebooks, reports, and agents reuse the same truth.

## References

- [dbt Semantic Layer documentation](https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl)
- [dbt semantic models](https://docs.getdbt.com/docs/build/semantic-models)
- [dbt metrics](https://docs.getdbt.com/docs/build/metrics-overview)
- [MetricFlow](https://github.com/dbt-labs/metricflow)
- [Cube documentation](https://docs.cube.dev/docs/introduction)
- [Lightdash open semantic layer](https://www.lightdash.com/blogpost/why-were-building-an-open-semantic-layer)
- [AI-Assisted Analytics with MCP and ClickHouse](/posts/2026-07-28-ai-assisted-analytics-mcp-clickhouse)
- [What Makes a Mart Agent-Safe](/posts/2026-07-23-what-makes-a-mart-agent-safe)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
`;export{e as default};