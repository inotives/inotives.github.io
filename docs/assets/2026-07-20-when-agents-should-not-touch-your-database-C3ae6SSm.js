var e=`---
title: "When Agents Should Not Touch Your Database"
date: 2026-07-20
tags: [ai-agents, database-security, data-engineering, mcp, postgres, crypto]
series: data-engineering
summary: "Database access is one of the easiest ways to make agents useful and one of the fastest ways to make them dangerous. The right default is not full access. It is narrow, read-only, observable access to the data shape the agent actually needs."
---

# When Agents Should Not Touch Your Database

Giving an agent database access feels like a shortcut.

The data is already there. The schema is already there. SQL is expressive. The agent can answer real questions instead of pretending from stale docs.

Then the agent writes a query against production, scans a table it did not need, leaks a field it should never have seen, or explains a stale mart as if it were current.

The problem is not "agents plus databases." Agents should query data. The problem is treating a database connection as a harmless tool.

It is not harmless. It is a production interface.

## Do not start with direct table access

The lazy version is safer and usually better: give the agent a small read-only interface first.

That can be a view, a stored procedure, an MCP tool, a narrow API endpoint, or a query helper that only exposes approved datasets. The shape matters less than the boundary.

An agent does not need the whole database to answer "what changed in BTC exposure this week?" It needs a small set of curated facts:

- canonical asset id
- display symbol
- quantity
- value in USD
- as-of timestamp
- source freshness status

If those fields are in a mart, give the agent the mart. Do not give it raw exchange payloads, customer tables, auth tables, and every migration table because that was easier than making a view.

Raw access is not a feature. It is deferred design work.

## When agents should not touch it

There are obvious no-go zones.

Agents should not get write access to production data unless the whole workflow is built around approval, audit, rollback, and idempotency. "The model probably will not run \`delete\`" is not a control.

Agents should not query secrets, credentials, session tokens, private keys, auth tables, password hashes, or integration tokens. Read-only does not help if reading the table is already the breach.

Agents should not get broad customer PII just because some support workflow might need a name or email. Give the workflow the fields it needs, not the table where those fields happen to live.

Agents should not query trading, compliance, or financial reporting tables without freshness and lineage metadata. In crypto, stale data can be worse than missing data because it still looks like a number.

Agents should not query raw vendor payloads for user-facing answers. Raw data is source truth, not consumer truth. It may be incomplete, duplicated, unmapped, stale, or semantically weird.

That list sounds restrictive. Good. The first database tool should be boring enough that a bad prompt cannot turn it into an incident.

## Read-only is necessary, not sufficient

Read-only access prevents direct writes. It does not prevent bad reads.

A read-only agent can still:

- dump too many rows
- infer private information
- join on the wrong key
- use stale data
- run expensive queries
- expose internal-only fields
- mix raw and curated data without knowing the difference

This is why the useful boundary is not "read-only database user." It is "read-only, allowlisted, row-limited, observable, semantically described access."

For Postgres, that usually means a dedicated role with no default table access:

\`\`\`sql
create role agent_reader nologin;

grant usage on schema analytics to agent_reader;
grant select on analytics.agent_portfolio_summary to agent_reader;
grant select on analytics.agent_asset_prices to agent_reader;
\`\`\`

No blanket grants. No \`public\` schema free-for-all. No "we will clean it up later."

## Views are cheap guardrails

A view is often enough.

Instead of letting an agent discover your whole warehouse, publish a small agent-facing schema:

\`\`\`text
agent.portfolio_summary
agent.asset_prices
agent.data_freshness
agent.source_lineage
\`\`\`

Those views should contain the joins you trust, the field names you want the agent to see, and the timestamps it needs to avoid stale answers.

This also solves the crypto symbol problem. Do not make the agent choose between \`symbol\`, \`coingecko_id\`, \`asset\`, \`coin_id\`, and \`contract_address\`. Give it \`canonical_asset_id\` for joins and \`display_symbol\` for humans.

The agent-facing view is where data contracts, freshness checks, and identity rules meet.

## MCP tools should be narrower than SQL

SQL is powerful. That is exactly why it should not always be the agent interface.

For common workflows, a purpose-built MCP tool is safer:

\`\`\`text
get_portfolio_exposure(account_id, as_of)
get_asset_price(canonical_asset_id, as_of)
get_freshness_status(dataset)
search_transactions(account_id, date_range, limit)
\`\`\`

Each tool can validate inputs, cap result size, attach freshness metadata, log calls, and refuse unsafe queries. A raw SQL tool can do some of that, but only by re-creating a policy layer around arbitrary text.

Use raw SQL for internal analysis agents with trusted operators. Use narrow tools for production workflows and customer-facing answers.

That split keeps the powerful tool available without pretending every agent deserves it.

## The minimum controls

For agent database access, I want these controls before production:

- dedicated database role
- read-only grants
- allowlisted schemas, views, or functions
- query timeout
- row limit
- audit log with prompt, query, caller, and result size
- freshness metadata in the response
- no secrets or credential tables in scope

That is the small set. Add more when the data is sensitive or the action is risky.

For crypto reporting, I would add two more:

- block stale marts from agent use
- require canonical asset ids in agent-facing tables

Those two rules prevent a lot of polished nonsense.

## What this looks like in a local project

In a local analytics project, I would not build a giant policy engine.

Start with one schema:

\`\`\`text
agent/
  portfolio_summary
  asset_prices
  data_freshness
\`\`\`

Then expose only that schema through the agent tool. If the agent needs a new answer, add a view or a narrow tool. That feels slower for the first request and faster for every request after it, because the agent stops rediscovering business logic through table names.

This fits \`market-pipe\` well. Raw CoinGecko data can stay raw. Staging can normalize source fields. Marts can enforce identity and freshness. Agent-facing views can expose the few shapes that are safe to query.

The agent gets a useful interface. The database keeps its internal mess.

## The approval boundary

Write operations are a different category.

If an agent can create, update, or delete production data, treat it like a workflow system, not a chat feature. You need:

- explicit user approval before mutation
- idempotency keys
- transaction boundaries
- rollback or compensating actions
- durable audit logs
- dry-run previews

Without those, the agent should not write. It can draft SQL. It can prepare a migration. It can open a pull request. It should not execute the change against production because the prompt sounded confident.

This is not anti-agent. It is pro-sleep.

## The practical rule

Agents should touch the narrowest database surface that can answer the question.

For exploration, use read-only SQL against a sandbox or replica. For production workflows, use views and narrow tools. For customer-facing answers, require curated marts, freshness status, and identity-safe fields. For writes, require approval and audit.

The database is different from the rest of the tool list. It is where the real state lives.

Treat it that way.

## References

- [PostgreSQL privileges](https://www.postgresql.org/docs/current/ddl-priv.html)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification)
- [Postgres in Agentic Workflows](/posts/2026-05-21-postgres-in-agentic-workflows)
- [Securing Your Local AI Agent](/posts/2026-06-20-securing-your-local-ai-agent)
- [Agent Reach for Databases](/posts/2026-06-18-dbx-agent-reach-for-databases)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-20-freshness-data-quality-dimension)
`;export{e as default};