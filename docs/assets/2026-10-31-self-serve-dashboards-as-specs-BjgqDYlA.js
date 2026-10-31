var e=`---
title: "Dashboards as specs: letting an agent design self-serve dashboards"
date: 2026-10-31
tags: [ai-agents, mcp, dashboards, data-visualization, api-design, analytics, crypto]
series: building-ai-systems
summary: "Instead of having an agent write dashboard code, give it a narrow contract: a dashboard is a spec of SQL cards, each card picks a chart type from a fixed library, filters arrive as query string values, and an MCP server lets the agent draft and test while a person publishes. A stablecoin-flows example shows how the pieces fit."
---

In [an earlier note](/notes/2026-10-27-agent-built-dashboards-from-analytical-databases) I described letting a coding agent build a custom dashboard: it inspects an analytical database through MCP, then writes an API, HTML and charting code. That works well for one tailored page. It does not scale to the request I hear most often from analysts: "can I just make my own dashboard?"

If every new dashboard is new code, every new dashboard needs a developer, a review and a deploy. If analysts get a BI tool, they get a second permission model and a second definition of every metric. I wanted a third option. The agent should be able to design a dashboard for an analyst, but it should not write application code at all. It should fill in a small, well-checked contract, and the platform should do the rest.

The idea that made this work is simple: **a dashboard is a spec, not an endpoint.**

![A new chart is a card in a spec. Built-in and agent-drafted specs are stored as versioned JSON; two API routes serve every dashboard through a query guard on the gold tables, and a fixed chart library renders the rows.](/assets/images/dashboard-specs-architecture.svg)

## Every dashboard is a spec

Take a crypto treasury desk. It wants to watch stablecoin deposits and withdrawals: net flow by week, which chains the money moves on, and the biggest days. In a typical codebase, each of those charts would become an API endpoint and a React component. With specs, the whole page is one JSON document:

\`\`\`json
{
  "title": "Stablecoin flows",
  "description": "USDT and USDC deposits and withdrawals by chain, for the treasury desk",
  "audience": ["treasury"],
  "filters": [
    { "id": "period", "type": "period", "label": "Period", "default": "last_3_months" },
    { "id": "chain", "type": "choice", "label": "Chain", "default": "ALL",
      "options": [
        { "value": "ALL", "label": "All chains" },
        { "value": "ethereum", "label": "Ethereum" },
        { "value": "tron", "label": "Tron" },
        { "value": "solana", "label": "Solana" }
      ] }
  ],
  "cards": [
    {
      "id": "net-flow",
      "type": "diverging_bars",
      "title": "Net flow by week, USD",
      "format": "usd",
      "sql": "select strftime(date_trunc('week', flow_date), '%Y-%m-%d') as x, asset as series, sum(signed_amount_usd) as value from agg_daily_stablecoin_flows where flow_date between $period_from and $period_to and ($chain = 'ALL' or chain = $chain) group by all order by x"
    },
    {
      "id": "by-chain",
      "type": "rank_bars",
      "title": "Deposits by chain, USD",
      "format": "usd",
      "sql": "select chain as label, sum(amount_usd) as value, count(*) || ' deposits' as note from fct_stablecoin_transfers where direction = 'in' and flow_date between $period_from and $period_to group by all order by value desc"
    }
  ]
}
\`\`\`

A card is three things: a title, a chart type, and one SQL query on the curated Gold tables. Filters sit above the cards. The audience is a list of roles.

Every page is served by the same two routes: one returns the spec, the other runs one card. Adding a chart means adding a card to a spec. The site's own pages can be specs too. I keep those in the repository and review them like code, while analysts' dashboards live as versioned JSON in storage. Both go through the same routes and the same checks, so there is only one way a number reaches a screen.

## The chart library is a column contract

The part that makes an agent useful here is the chart library. The agent never draws a chart. It picks a chart type, and each type names the columns its SQL must return:

| Chart type | Columns the SQL returns | Good for |
| --- | --- | --- |
| \`stats\` | \`label\`, \`value\` | Headline figures, such as total deposits this period |
| \`line\` / \`multi_line\` | \`x\`, \`value\` (+ \`series\`) | A trend, or a few trends to compare |
| \`stacked_bars\` | \`x\`, \`series\`, \`value\` | A total over time and what it is made of |
| \`diverging_bars\` | \`x\`, \`series\`, \`value\` | Money in above zero, money out below |
| \`rank_bars\` | \`label\`, \`value\` | Largest first, such as volume by chain |
| \`sankey\` | \`source\`, \`target\`, \`value\` | Flows, such as exchange to chain to wallet type |
| \`heatmap\` | \`date\`, \`value\` | Activity per day across a period |
| \`scatter\` | \`x\`, \`y\` (+ \`label\`, \`size\`) | Each asset's trades against its volume |

So the agent's job becomes shaping data, which it is good at, instead of writing layout and chart code, which is where generated dashboards usually drift. It writes \`as x\`, \`as series\`, \`as value\`, and the renderer handles axes, colours, number formats, empty states and the limit of six series per chart. Every dashboard looks like it belongs to the same product, because it does.

![The agent writes SQL whose column names match a chart type. Diverging bars need x, series and value; the API checks the columns before the library draws inflows above zero and outflows below.](/assets/images/dashboard-specs-chart-contract.svg)

The contract is also checkable. When a card runs, the API compares the returned columns with what its chart type needs, and a mismatch is an error with a clear message instead of a broken chart. I also keep one working sample card per chart type, run against the real Gold tables. A chart library page shows them to people, and the same list goes to the agent. Adding a chart type means adding a renderer, a column list and a sample. Nothing else changes.

## Filters travel as query string values

Self-serve dashboards need filters, and filters are where SQL injection usually sneaks in. The rule I use is strict: **the viewer sends values, never SQL.**

A filter is defined in the spec. A \`period\` filter gives card SQL two parameters, \`$period_from\` and \`$period_to\`. A \`choice\` filter gives one, such as \`$chain\`, from a fixed list or from a query that returns the allowed values. The browser only sends the picked values in the query string:

\`\`\`http
GET /dashboards/stablecoin-flows/cards/net-flow?period=last_3_months&chain=tron
\`\`\`

The API checks each value against the spec. \`period\` must be one of the named ranges, or an explicit \`2026-07-01..2026-09-30\`. \`chain\` must be one of the options. It then binds the values as named parameters. They are never pasted into the SQL text, so \`chain=tron' or 1=1\` is just a value that is not on the list, and it is refused.

![A request carries period and chain values in its query string. The API checks them against the spec, binds them as parameters, runs the card in the viewer's scope and caches the result; a value outside the options is refused.](/assets/images/dashboard-specs-filter-request.svg)

Because a card's result depends only on the data run, the spec version, the card and the filter values, it caches cleanly. Most dashboard traffic is the same few periods, so the warehouse does very little repeated work. When the nightly pipeline publishes a new run, the cache key changes with it.

The query string also makes a filtered view shareable. \`?period=this_year&chain=ethereum\` is a link someone can paste into a chat, and it opens the same view for anyone allowed to see it.

## What the agent gets through MCP

The agent connects to a hosted MCP server with a token issued to one analyst. Every tool runs as that person, with their roles at that moment. If someone removes a role from the analyst, the agent loses it on its next call.

| Tool | What it does |
| --- | --- |
| \`list_tables\`, \`describe_table\` | Gold tables this analyst may query, with columns and sample rows |
| \`run_query\` | One read-only SELECT, to explore the data |
| \`dashboard_guide\` | Chart types and their columns, formats, filters, audiences and an example spec |
| \`create_draft\`, \`update_draft\` | Save a private draft; every save is a new version |
| \`preview_card\` | Run one card as the analyst, or as an audience role |
| \`check_draft\` | The publish checks, without publishing |
| \`preview_url\` | The link where the analyst reviews the draft |

The server also sends short instructions describing the workflow: explore, read the guide, draft, preview as each audience role, check, then show the analyst what was built with a summary of each card's figures and the preview link.

There is deliberately no publish tool. The agent can draft and test as much as it likes, but publishing is a person's decision in the web app. The API enforces this as well: an agent token calling the publish endpoint gets a 403, so a clever prompt cannot route around it.

![The agent explores tables, reads the guide, drafts and tests through MCP tools bound to one analyst's roles, then hands back a summary and preview link. The analyst reviews and publishes.](/assets/images/dashboard-specs-agent-loop.svg)

In practice the conversation looks like this. The analyst asks for "stablecoin flows for the treasury desk, by week and by chain, last quarter by default". The agent finds \`agg_daily_stablecoin_flows\` and \`fct_stablecoin_transfers\`, runs a few queries to check the grain and units, picks \`diverging_bars\` for net flow and \`rank_bars\` for chains, and drafts the spec. It previews the cards as the \`treasury\` role, notices that role cannot read the raw transfers table, and rewrites the second card on an aggregate it can read. Then it hands back the link. The analyst checks one total against a figure they trust and publishes.

## The guardrails do the real work

None of this is safe unless the boundary is enforced in code. Card SQL from any source, whether a person, their agent or a built-in page, passes the same four layers:

1. **Parse, don't run.** The query is parsed first. In DuckDB, \`json_serialize_sql\` returns the syntax tree without running anything. It must be exactly one SELECT, with no table functions such as file readers, and under a length limit.
2. **Check the tables.** Every table the query reads must belong to the caller's roles. Roles are data: a set of areas plus the tables, or table patterns such as \`agg_*\`, its SQL may query.
3. **Run in a small box.** The query runs on a read-only copy of Gold that holds only those tables, with file access disabled, a 10-second limit and a row cap.
4. **Check before publishing.** A dashboard publishes only if every card works for every audience role. Published dashboards are checked again after each data run, so a renamed column shows up as a failed check, not a silent blank chart.

![Four layers between card SQL and a published dashboard: parse without running, check tables against the role scope, run in a read-only scoped copy with limits, and check every card for every audience role before and after publishing.](/assets/images/dashboard-specs-guardrails.svg)

Two more details matter more than they look. Specs are **append-only versions**: every save, by a person or an agent, adds a version, and any version can be published or restored. An agent's bad edit is never destructive. And a dashboard runs as **the viewer's roles**, not the author's. An analyst cannot publish a dashboard that shows a business audience rows they could not query themselves.

## Where this fits

| You need | Better fit |
| --- | --- |
| One page with unusual interactions or embedded product features | An agent-built custom app, as in the earlier note |
| Many analysts making their own views over the same governed data | Specs with a fixed chart library |
| Heavy self-serve exploration, pivoting and ad-hoc slicing | A BI tool on a semantic layer |
| Operational pages the platform team owns | Built-in specs, reviewed like code |

Specs do limit expression. An analyst cannot invent a new chart type in a prompt. I think that limit is the point. Each new type is a small, reviewed addition that every dashboard then gets for free, and the agent's creativity goes into choosing the question, the grain and the right chart. That is where a good analyst's time goes too.

## A sensible first experiment

Start with three chart types: \`stats\`, \`line\` and \`rank_bars\`. Write one built-in page as a spec and serve it through the two routes. Add a \`period\` filter with bound parameters. Then expose \`list_tables\`, \`run_query\`, \`dashboard_guide\`, \`create_draft\` and \`preview_card\` over MCP to one analyst, and keep publishing manual.

Ask the agent for a dashboard you already have elsewhere, and compare its numbers with the existing one. If they match, and the analyst can tweak the draft without filing a ticket, you have the core of self-serve. The chart library and the guardrails can grow from there.

## References

- [Model Context Protocol: tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [DuckDB: SQL to and from JSON (\`json_serialize_sql\`)](https://duckdb.org/docs/stable/data/json/sql_to_and_from_json.html)
- [DuckDB: prepared statements and named parameters](https://duckdb.org/docs/stable/sql/query_syntax/prepared_statements.html)
- [OWASP: SQL injection prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [From BI canvas to code: building dashboards with an agent and an analytical database](/notes/2026-10-27-agent-built-dashboards-from-analytical-databases)
- [MCP as the live data layer for enterprise agents](/notes/2026-09-25-mcp-live-data-layer-enterprise-agents)
- [MCP vs API: two ways software systems connect](/notes/2026-10-17-mcp-vs-api)
`;export{e as default};