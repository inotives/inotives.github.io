---
title: "AI-Assisted Analytics with MCP and ClickHouse"
date: 2026-07-28
tags: [ai, analytics, mcp, clickhouse, claude-code, data-engineering, crypto]
series: data-engineering
summary: "Natural-language analytics can work when the LLM is connected to curated, read-only data through a guarded MCP server. A production ClickHouse setup needs strict access boundaries, query limits, audit logs, semantic metadata, and clear refusal rules."
---

# AI-Assisted Analytics with MCP and ClickHouse

Natural-language analytics sounds simple:

```text
stakeholder asks a question
LLM writes SQL
database returns the answer
LLM explains the result
```

The real system is more delicate.

If the model queries ambiguous tables, it gives confident wrong answers. If it can query production without limits, it can burn compute or leak sensitive data. If it can mutate the database, the analytics tool becomes an operational risk.

A better pattern is to put a guarded MCP server between the agent and the database.

At Flowdesk, the pattern can look like this:

```text
production ClickHouse
-> read-only MCP server
-> Claude Code
-> stakeholders asking natural-language questions
```

The important part is not that an LLM can write SQL. The important part is that the LLM can only ask safe questions against curated data.

## What MCP adds

MCP, the Model Context Protocol, is a standard way to expose tools and data sources to AI clients.

For analytics, an MCP server can expose controlled tools like:

```text
list_available_marts
describe_table
search_metrics_catalog
run_readonly_query
explain_metric
get_freshness_status
get_recent_pipeline_runs
```

The LLM does not need raw database credentials. It calls an MCP tool. The MCP server checks the request, applies limits, runs the allowed read-only query, and returns a bounded result.

That gives data engineering a control point.

Without MCP:

```text
agent has broad database access
agent sees too many tables
agent writes SQL from guesswork
hard to audit which user asked what
hard to enforce limits consistently
```

With MCP:

```text
agent sees curated tools
agent queries allowlisted schemas
agent gets table and metric metadata
queries are limited and audited
unsafe requests are refused
```

MCP turns the database into a controlled interface instead of an exposed production system.

## Why ClickHouse fits this pattern

ClickHouse is a strong backend for AI-assisted analytics because it is fast for analytical queries. It handles large event, trade, price, and telemetry tables well when the schema and sort keys match the query pattern.

For crypto, stakeholders might ask:

```text
What was BTC spot volume yesterday by venue?
Which assets had the largest spread change this week?
Did any exchange balance snapshot arrive late today?
Which counterparties drove the change in daily revenue?
What were the top stale market data sources this morning?
Which trading pairs had abnormal quote churn?
```

These are analytical questions. They usually read many rows, aggregate them, and return a small answer.

That is ClickHouse territory.

The risk is that ClickHouse is also very good at scanning lots of data quickly. A bad natural-language question can become an expensive full-table scan unless the MCP layer and ClickHouse role stop it.

## Start with curated marts

Do not point the agent at every production table.

Give it curated analytics surfaces:

```text
marts.daily_asset_prices
marts.daily_exchange_volume
marts.portfolio_exposure
marts.market_data_freshness
marts.exchange_balance_snapshots
marts.pipeline_run_status
marts.counterparty_revenue
```

Avoid exposing:

```text
raw payload tables
internal staging tables
tables with secrets
tables with unrestricted customer PII
operational write tables
correction proposal tables that are not approved
```

The best LLM analytics surface looks more like a data mart than a production database dump.

Each exposed table should have:

```text
clear description
owner
freshness expectation
grain
primary dimensions
metric definitions
safe example queries
known caveats
```

Example table metadata:

```yaml
table: marts.daily_exchange_volume
description: "Daily crypto trading volume by exchange, venue, asset, and quote currency."
grain: "one row per report_date, exchange_id, base_asset_id, quote_asset_id"
freshness: "daily by 08:00 UTC"
allowed_for_agents: true
pii: false
default_time_filter: "last 30 days"
common_filters:
  - report_date
  - exchange_id
  - base_asset_id
metrics:
  volume_usd: "Total executed volume converted to USD using report-date FX and asset prices."
```

Good metadata reduces guessing. Guessing is where many LLM analytics failures start.

## Make the database role read-only

The first guardrail belongs in ClickHouse, not in the prompt.

Create a role for LLM analytics:

```sql
create role if not exists llm_analytics_role;
grant select on marts.* to llm_analytics_role;
```

Create a service user:

```sql
create user if not exists llm_analytics_user
identified with sha256_password by 'use-a-real-secret-here';

grant llm_analytics_role to llm_analytics_user;
alter user llm_analytics_user default role llm_analytics_role;
```

Then apply hard limits:

```sql
alter role llm_analytics_role settings
    readonly = 1,
    max_execution_time = 30,
    max_memory_usage = 2000000000,
    max_rows_to_read = 100000000,
    max_bytes_to_read = 5000000000,
    max_threads = 4;
```

These settings matter.

```text
readonly              prevents mutations
max_execution_time    kills long queries
max_memory_usage      limits runaway aggregation
max_rows_to_read      stops accidental giant scans
max_bytes_to_read     controls cost and cluster pressure
max_threads           prevents one query from eating the node
```

The MCP server should also reject non-read statements before they reach ClickHouse:

```text
insert
update
delete
alter
drop
truncate
create
rename
optimize
system
kill
```

Do both. Database permissions are the hard boundary. MCP validation gives friendlier errors and better audit logs.

## Put query limits in the MCP tool

The MCP `run_readonly_query` tool should not execute arbitrary SQL as-is.

It should enforce:

```text
allowlisted database names
maximum result rows
maximum execution time
required LIMIT
blocked SQL verbs
blocked functions if needed
default date window
query timeout
result truncation
audit logging
```

Example tool behavior:

```text
Input: show BTC volume by exchange last week
MCP builds or checks SQL
MCP verifies only marts.* tables are used
MCP adds LIMIT 100 if missing
MCP rejects query if no time filter on large tables
MCP runs query with read-only ClickHouse user
MCP returns rows plus freshness metadata
```

For large crypto tables, require a time filter:

```text
daily marts            require report_date
tick tables            require observed_at
chain event marts      require block_date
run logs               require started_at
```

An agent should not scan two years of trade ticks because someone asked "what changed recently?"

## Use natural language, but keep metric names precise

Stakeholders should ask in normal language. The system should map that language to approved metrics.

Examples:

```text
"volume"        -> daily executed volume in USD
"revenue"       -> net trading fee revenue after rebates
"active asset"  -> asset with at least one executed trade in report window
"stale source"  -> source with freshness lag above SLA
```

Put those definitions in the MCP metadata or catalog.

For crypto, ambiguous terms are dangerous:

```text
volume can mean base units, quote units, USD notional, or executed volume
price can mean last trade, mid price, oracle price, VWAP, or close
asset can mean symbol, canonical asset ID, chain contract, or provider ID
exchange can mean venue, platform, account, or legal entity
```

The MCP should expose `explain_metric` so the agent can clarify:

```text
Question: "What was SOL volume yesterday?"
Agent: "Using daily executed volume in USD from marts.daily_exchange_volume."
```

If the metric is ambiguous, the tool should require clarification instead of guessing.

## Return provenance with every answer

Every answer should include where it came from.

At minimum:

```text
tables used
time window
freshness status
row count
query ID
run ID if available
metric definitions
SQL summary or full SQL for review
```

Example response footer:

```text
Source: marts.daily_exchange_volume
Window: 2026-07-21 to 2026-07-27
Freshness: current as of 2026-07-28 08:03 UTC
Rows read: 48,210
Query ID: ch_query_9be2
```

This makes stakeholder answers auditable. It also teaches users to trust the right thing: not the model's confidence, but the data trail.

## Guardrails that matter

The useful guardrails are boring:

```text
read-only database user
allowlisted schemas and tables
no raw tables by default
row and byte limits
execution timeout
required time filters
result-size limits
query audit logs
user identity propagation
freshness metadata
metric definitions
refusal rules
Slack or incident alerts for repeated failures
```

Also add a kill switch:

```text
disable MCP server
revoke ClickHouse user
rotate credentials
lower query limits
disable stakeholder group access
```

Do not wait until the first runaway query to design the off switch.

## Common pitfalls

Pitfall: exposing production raw tables.

Raw tables are full of provider quirks, duplicated payloads, nested JSON, and fields without business meaning. Agents will overfit to column names and return nonsense.

Pitfall: relying on prompt instructions for safety.

"Only run SELECT" in a prompt is not a permission model. Use read-only database roles and MCP validation.

Pitfall: no metric catalog.

If "revenue" has five meanings, the LLM will pick one. The answer may look correct and still be wrong.

Pitfall: no query cost limits.

Natural language hides query complexity. "Show recent wallet behavior" can become a massive scan.

Pitfall: no freshness visibility.

A correct SQL query over stale data is still a bad answer.

Pitfall: letting the agent summarize too much.

Automated insights can drift into storytelling. For business metrics, the answer should show numbers, definitions, and caveats before interpretation.

Pitfall: stakeholder access without training.

People need to know what the system can answer, what it cannot answer, and when to ask data engineering for a reviewed report.

## Automated insights

Once the query layer is safe, the same MCP can support automated insights.

Examples:

```text
daily volume changed by more than 20 percent
freshness lag increased by provider
top assets changed rank by spread
portfolio exposure moved because of price, balance, or mapping change
revenue changed because of volume mix or fee rate
```

The insight job should use the same governed tools:

```text
query approved marts
compare against prior period
attach metric definitions
include freshness status
write insight summary to a review queue
send Slack digest if threshold is crossed
```

For example:

```text
[insight] ETH volume fell 18 percent week over week
Driver: Binance ETH/USDT volume down 24 percent
Freshness: current
Source: marts.daily_exchange_volume
Action: review market-data and venue breakdown dashboard
```

Automated insight is useful when it shortens investigation time. It is risky when it becomes a confident narrative without traceable numbers.

## A practical rollout plan

Start narrow:

```text
1. Pick five stakeholder questions.
2. Build or select the marts that answer them.
3. Document metric definitions and table grain.
4. Create a ClickHouse read-only LLM role over those marts.
5. Add query limits and required time filters.
6. Build MCP tools for table discovery, metric lookup, freshness, and read-only query.
7. Connect the MCP server to Claude Code.
8. Test with internal data engineering users.
9. Open access to a small stakeholder group.
10. Review audit logs weekly and tighten the catalog.
```

Do not start by connecting the agent to the whole warehouse. That creates impressive demos and fragile operations.

The first version should answer boring questions correctly:

```text
What was daily volume by asset yesterday?
Which data sources are stale?
Which exchange balances failed today?
Which assets drove the portfolio exposure change?
```

If those work with provenance, limits, and audit logs, expand from there.

## The rule

AI-assisted analytics works when the model is not guessing from a database dump.

The safe version has three layers:

```text
curated marts       business-safe data
read-only MCP       controlled access
LLM client          natural-language interface
```

For crypto data, the guardrails are not optional. Symbols are ambiguous. Prices have multiple meanings. Provider data goes stale. Production ClickHouse can be expensive to scan.

Give stakeholders natural-language access, but make the system boring underneath:

```text
read-only
allowlisted
limited
audited
documented
freshness-aware
```

That is how natural-language analytics becomes useful instead of becoming another way to ask production a dangerous question.

## References

- [Model Context Protocol documentation](https://modelcontextprotocol.io/docs)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [ClickHouse: How to set up ClickHouse for agentic analytics](https://clickhouse.com/blog/how-to-set-up-clickhouse-for-agentic-analytics)
- [ClickHouse query optimization guide](https://clickhouse.com/resources/engineering/clickhouse-query-optimisation-definitive-guide)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
- [What Makes a Mart Agent-Safe](/posts/2026-07-23-what-makes-a-mart-agent-safe)
- [MCP Is Becoming the API Layer for Internal Data](/posts/2026-07-24-mcp-api-layer-internal-data)
- [AI Agents Are Only as Good as Their Data Marts](/posts/2026-07-24-ai-agents-only-as-good-as-data-marts)
