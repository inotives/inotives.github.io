var e=`---
title: "MCP Is Becoming the API Layer for Internal Data"
date: 2026-07-24
tags: [mcp, ai-agents, internal-tools, data-engineering, postgres, data-marts]
series: data-engineering
summary: "MCP gives agents a practical way to use internal data without handing them the whole database. The useful pattern is curated tools over safe marts, metadata, and narrow actions."
---

# MCP Is Becoming the API Layer for Internal Data

Most internal data was not designed for agents.

It was designed for dashboards, SQL notebooks, batch jobs, BI tools, and humans who already know which tables are safe. The database has raw vendor payloads, staging tables, marts, admin tables, logs, audit trails, experiments, old views nobody wants to delete, and a few tables with names that made sense six months ago.

Then someone connects an agent to the database and asks it to answer questions.

That is where things get messy.

The useful pattern is not "give the agent database access." The useful pattern is giving the agent an API layer over the parts of the database that are safe to use.

MCP is starting to fit that job.

## MCP is more than tool plumbing

MCP often gets described as a way to give agents tools. That is true, but too small.

For internal data, MCP can become the interface between an agent and the business meaning of a system. It can expose a curated query, a catalog lookup, a freshness check, a lineage trace, or a narrow operational action. The agent does not need to know every table. It needs the few safe moves it can make.

That matters because internal databases are full of traps:

\`\`\`text
raw exchange payloads
current-only asset mappings
stale price tables
wide customer tables
columns with unclear time semantics
tables where symbol looks like identity
old marts kept around for compatibility
\`\`\`

A direct SQL tool exposes all of that. An MCP server can expose a smaller surface:

\`\`\`text
get_portfolio_exposure(as_of)
get_asset_price(canonical_asset_id, as_of)
check_dataset_freshness(dataset_name)
search_data_catalog(query)
explain_report_lineage(report_id)
list_open_quality_issues(status)
\`\`\`

Those are APIs. They just happen to be APIs built for agents.

## The agent should not discover safety at runtime

If the agent has to inspect the whole database before deciding which table is safe, the boundary is already weak.

The safety decision should happen before the tool is exposed.

For a crypto analytics project, the MCP server might connect to Postgres, but the agent should only see curated operations:

\`\`\`text
Tool: get_portfolio_exposure
Input:
  portfolio_id
  as_of
Output:
  canonical_asset_id
  display_symbol
  exposure_quantity
  exposure_usd
  price_observed_at
  freshness_status
  quality_status
\`\`\`

Behind that tool, the implementation can query a mart like \`analytics.agent__portfolio_exposure\`. The agent does not need raw balances, exchange account tables, or ingestion payloads.

This is boring by design.

The best internal data API for agents is usually not flexible. It is narrow, named, documented, and hard to misuse.

## Curated views beat raw table access

Raw SQL access feels powerful because it can answer anything.

That is also the problem.

An agent with broad SQL access can join on the wrong key, scan too many rows, expose sensitive fields, or answer from stale data because the table looked plausible. The model may even write good SQL for the wrong table.

MCP lets the team put curated database views behind tool names:

\`\`\`text
analytics.agent__asset_prices
analytics.agent__portfolio_exposure
analytics.agent__data_freshness
analytics.agent__open_quality_issues
analytics.agent__report_lineage
\`\`\`

Then the MCP tools become stable contracts:

\`\`\`text
get_asset_prices
get_portfolio_exposure
get_data_freshness
get_quality_issues
get_report_lineage
\`\`\`

The database can change underneath. Staging tables can be refactored. Raw providers can be replaced. The agent-facing contract stays small.

This is the same reason normal software teams put APIs in front of databases. Agents do not remove that need. They make it more obvious.

## Metadata belongs in the API layer

A normal API returns data.

An agent-facing internal API should return data plus enough metadata to know how to use it.

For example, a portfolio exposure tool should not return only numbers:

\`\`\`json
{
  "portfolio_id": "main",
  "as_of": "2026-07-24T10:00:00Z",
  "freshness_status": "fresh",
  "rows": [
    {
      "canonical_asset_id": "bitcoin",
      "display_symbol": "BTC",
      "exposure_quantity": "1.25",
      "exposure_usd": "151250.00"
    }
  ]
}
\`\`\`

It should also return answer rules:

\`\`\`json
{
  "dataset": "analytics.agent__portfolio_exposure",
  "point_in_time_safe": true,
  "max_age_minutes": 15,
  "allowed_for_agent_use": true,
  "refusal_reason": null,
  "lineage_run_id": "run_20260724_1000"
}
\`\`\`

That metadata is not decoration. It changes behavior.

If \`freshness_status\` is \`stale\`, the agent should refuse current exposure questions or clearly qualify the answer. If \`point_in_time_safe\` is false, the agent should not answer historical questions from that tool. If \`allowed_for_agent_use\` is false, the agent should stop.

This is where MCP becomes more than a database adapter. It becomes the place where data contracts, catalog metadata, and agent behavior meet.

## Safe actions still need boundaries

Not every MCP tool has to be read-only. Some internal workflows need actions.

For example:

\`\`\`text
create_quality_review_task(quarantine_row_id)
mark_mapping_reviewed(mapping_id)
request_backfill(dataset_name, start_date, end_date)
open_lineage_investigation(report_id)
\`\`\`

These can be useful. They can also go wrong quickly.

The rule is simple: actions should be narrow and reversible where possible. Do not expose \`run_sql\` and call it an action layer. Expose the specific action the workflow needs.

For a quarantined crypto row, an MCP tool might allow the agent to create a review task:

\`\`\`json
{
  "quarantine_row_id": "q_9821",
  "reason": "unmapped_asset",
  "suggested_owner": "data",
  "source_run_id": "run_20260724_0900"
}
\`\`\`

That is safer than letting the agent update the asset mapping table directly.

The agent can route work. It should not silently rewrite source-of-truth tables unless the system has approval, audit logs, rollback, and clear ownership.

## The useful MCP server is small

A bad MCP server mirrors the database.

It exposes too many tools, too many tables, too many parameters, and one generic escape hatch called something like \`query_database\`.

That feels convenient for demos. In production, it turns the agent into an unbounded analyst with unclear permissions.

A better MCP server starts small:

\`\`\`text
search_catalog
get_dataset_contract
check_freshness
get_portfolio_exposure
get_asset_mapping
list_quality_issues
get_report_lineage
\`\`\`

Each tool should have:

\`\`\`text
clear input schema
bounded output size
documented data source
freshness semantics
allowed-use rules
audit logging
stable error codes
\`\`\`

That is enough for a useful first version.

If the agent keeps needing a new query, do not immediately expose raw SQL. Add a new curated tool or view when the workflow repeats enough to deserve one.

## A concrete crypto example

Say an analyst asks:

\`\`\`text
Why did ETH exposure change between yesterday's report and today's report?
\`\`\`

A weak setup gives the agent SQL access and hopes for the best. The agent hunts through tables:

\`\`\`text
raw_balances
stg_exchange_balances
asset_prices
asset_map
portfolio_report_final
\`\`\`

It might compare the wrong report versions. It might use today's asset mapping for yesterday's rows. It might ignore quarantined balances. It might miss that today's price run was stale.

A stronger MCP layer gives the agent a safer path:

\`\`\`text
get_report_versions(portfolio_id, date_range)
compare_portfolio_exposure(report_id_a, report_id_b)
get_report_lineage(report_id)
list_quality_issues(run_id)
check_freshness("agent__portfolio_exposure")
\`\`\`

Now the agent can answer with context:

\`\`\`text
ETH exposure increased because wallet balances rose by 2.4 ETH between report versions.
The price input was fresh for both reports.
One Arbitrum balance row was quarantined and excluded from today's mart because its asset mapping was missing.
\`\`\`

That answer is only possible because the MCP layer exposed the right data shape. The model still has to reason, but the dangerous parts were constrained before reasoning started.

## MCP makes local agents more practical

This is especially useful for local agents.

Local coding agents are good at reading files, running tests, inspecting logs, and helping with data pipelines. The missing piece is often safe access to internal data.

MCP can give them that access without handing over a production database connection with broad privileges.

For a solo project, the setup can be modest:

\`\`\`text
Postgres role: agent_reader
Schema: analytics
Views: agent__*
MCP tools: one per common workflow
Logs: JSONL with tool name, inputs, row count, run ID
Limits: max rows, max date range, allowed datasets
\`\`\`

That is not enterprise architecture. It is a small guardrail that makes the agent more useful and less surprising.

The agent should be able to debug a broken report by walking through catalog docs, freshness status, lineage, run logs, and quality issues. It should not need to poke random tables until something looks right.

## The practical rule

Treat MCP as an internal data API, not a shortcut around one.

Expose curated marts, metadata, and narrow actions. Keep raw tables behind the pipeline. Keep unsafe fields out of agent tools. Make freshness and point-in-time behavior visible. Log every call.

When the agent has a clean API layer, it can do real work:

\`\`\`text
answer questions
refuse unsafe requests
debug stale reports
surface data quality issues
trace numbers back to runs
open review tasks
\`\`\`

When it only has a database connection, it has power without enough shape.

MCP is useful because it gives that shape a place to live.

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
- [What Makes a Mart Agent-Safe](/posts/2026-07-23-what-makes-a-mart-agent-safe)
- [AI Agents Are Only as Good as Their Data Marts](/posts/2026-07-24-ai-agents-only-as-good-as-data-marts)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [Data Lineage for Small Crypto Pipelines](/posts/2026-07-24-data-lineage-small-crypto-pipelines)
`;export{e as default};