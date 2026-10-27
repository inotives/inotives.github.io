var e=`---
title: "From BI canvas to code: building dashboards with an agent and an analytical database"
date: 2026-10-27
tags: [ai-agents, analytics, dashboards, mcp, data-visualization, frontend]
series: building-ai-systems
summary: "An agent can use a governed MCP connection to inspect analytical data, then build a custom dashboard with an API, HTML, and charting libraries. A market-data example shows the build loop, the serving architecture, and when traditional BI is still the better fit."
---

For years, my first move when someone asked for a dashboard was to open a BI tool: Tableau, Looker, Metabase, or Power BI. Connect a dataset, choose a chart, arrange tiles, share a link. That workflow still works. It is especially good when analysts need to change reports themselves and the organization already has a governed semantic layer.

There is another option now. Give a coding agent a safe way to inspect an analytical database, describe the questions the dashboard must answer, and have it build a small web application. The interface can use ordinary HTML and CSS, a JSON API, and charting code. The agent gets from a question to a working first draft quickly; the team still owns the numbers, permissions, and final design.

This is an emerging workflow, not a claim that BI tools are obsolete. ClickHouse already documents MCP-connected agent analytics, while MotherDuck describes agents that explore schemas and build data views. Those are vendor examples of what is possible, not evidence that every team should replace its reporting stack. [ClickHouse's agentic data stack](https://clickhouse.com/blog/the-agentic-data-stack), [MotherDuck agent skills](https://motherduck.com/blog/motherduck-agent-skills/)

![Two ways to publish the same analytical mart: a BI tool or an agent-built application. In the agent path, MCP helps the agent inspect data while the deployed UI uses an API.](/assets/images/agent-built-dashboard-two-paths.svg)

## A market dashboard that needs more than tiles

Take a market-monitoring dashboard over a curated Gold mart. The product team wants to see 30-day trading volume, the latest price move for each symbol, and the share of volume by market. Clicking a symbol should open a detail view with its observation time, missing-data warning, and a link to the source run. The page should work on a phone during a morning check.

A conventional BI dashboard can cover much of this. A custom application becomes attractive when the team wants the chart, navigation, explanatory text, and operational controls to behave as one product. The same page might combine a trend chart with an incident annotation and a "show rejected batches" panel for operators. Those interactions are easier to shape directly in code than to fit into a fixed dashboard canvas.

The database still supplies the facts. The approved contract could expose \`gold.daily_market_volume\` and \`gold.latest_symbol_price\`, with metric definitions, units, grain, freshness, and permitted filters. If the agent mistakes daily volume for a running total, a beautiful chart will still be wrong.

## Let MCP help the agent learn the data

MCP is the connection between the coding agent and a controlled set of data tools. The agent can discover what tools exist, request schemas or metric definitions, run bounded sample queries, and inspect returned results. An MCP server may wrap an existing analytical API or query a database with a read-only identity. MCP does not define the dashboard layout or make a query trustworthy by itself. The [MCP client tools documentation](https://ts.sdk.modelcontextprotocol.io/v2/clients/calling) describes tool discovery and calls; the data server decides which operations to expose.

For this dashboard, I would offer narrow tools such as \`describe_metric\`, \`sample_market_volume\`, and \`get_latest_symbol_prices\`. Their output should include the reporting window, timezone, unit, query or dataset version, and \`as_of\` timestamp. The agent should not receive a broad production credential or a tool that can run arbitrary write SQL. This follows the same curated-data boundary discussed in [MCP as the live data layer for enterprise agents](/notes/2026-09-25-mcp-live-data-layer-enterprise-agents).

Then give the agent a brief that makes the data and review requirements explicit:

\`\`\`text
Build a responsive market overview from the approved Gold metrics.
Show daily volume for the last 30 complete days and the latest price per symbol.
Label USD values, dates, timezone, and the as-of time.
Use an API between the browser and the analytical database.
Do not put database credentials or MCP access in browser code.
Compare displayed totals with a saved query result before calling the page done.
\`\`\`

The useful loop is short: inspect the contract, query a small sample, sketch the page, implement the API and charts, compare rendered values with the source query, then review the page at desktop and phone widths. The agent can write code and revise it quickly. It cannot decide that a metric definition is correct because the chart looks plausible.

![The build loop: approved metrics pass through a read-only MCP server to a coding agent, which creates an API and dashboard; query checks and visual review validate the result.](/assets/images/agent-built-dashboard-build-loop.svg)

## The deployed dashboard has its own path

The agent's MCP connection is useful while building and reviewing the application. The published dashboard does not need to send every visitor's request through that coding session. A small backend can expose stable endpoints such as:

\`\`\`http
GET /api/market-overview?window=30d
\`\`\`

\`\`\`json
{
  "as_of": "2026-10-27T00:00:00Z",
  "timezone": "UTC",
  "volume_unit": "USD",
  "daily_volume": [{"date": "2026-10-26", "value": 18400000}],
  "symbols": [{"symbol": "BTC", "price_usd": 68250, "change_24h_pct": 1.8}]
}
\`\`\`

The example numbers above are illustrative. In a real app, the backend queries the approved mart, applies the user's authorization, bounds the date range and result size, and returns a documented response shape. The browser renders that response. It never receives a warehouse token. If a conversational assistant is part of the finished product, it may also use MCP at runtime, but that is a separate feature and permission boundary.

This split makes changes reviewable. The SQL or metric definition can be tested against known totals. The API contract can be tested independently. A chart can then be checked for missing dates, axis units, and empty states without asking the agent to infer what the data meant.

## Choose the chart for the question

For a 30-day time series, Chart.js is a practical default: a line chart with a clear time axis, tooltip, and responsive container. D3 is useful when the interaction or visual encoding needs more control, such as linked brushing across a time range and a symbol breakdown. Three.js can render a 3D scene with WebGL when spatial structure is part of the question. A rotating 3D bar chart for the same 30 numbers mostly makes comparison harder. [Chart.js getting started](https://www.chartjs.org/docs/latest/getting-started/), [What is D3?](https://d3js.org/what-is-d3), [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer)

With Chart.js installed, the line chart can consume the API contract directly:

\`\`\`html
<canvas id="daily-volume" role="img" aria-label="Daily trading volume in USD"></canvas>
\`\`\`

\`\`\`js
import Chart from 'chart.js/auto'

const response = await fetch('/api/market-overview?window=30d')
const { daily_volume } = await response.json()

new Chart(document.querySelector('#daily-volume'), {
  type: 'line',
  data: {
    labels: daily_volume.map(row => row.date),
    datasets: [{
      label: 'Daily volume (USD)',
      data: daily_volume.map(row => row.value),
    }],
  },
})
\`\`\`

The production page also needs a loading state, an API error state, and a readable table of the same values. The snippet shows the binding between the approved response and the visual, not the whole page.

![Illustrative market dashboard with a labelled 30-day volume line, market-share bars, as-of time, and a selected symbol detail panel. Values are sample data.](/assets/images/agent-built-dashboard-chart-example.svg)

The browser gives us a large design surface: HTML structure, CSS layout, SVG, Canvas, animation, and WebGL can share a page. That freedom also adds work. A Chart.js canvas needs an accessible name or a text alternative; a data table should remain available for readers who cannot use the chart. Motion needs a purpose and a reduced-motion path. A chart that looks good in a screenshot may have tiny touch targets or an unreadable mobile axis. [Chart.js accessibility guidance](https://www.chartjs.org/docs/latest/general/accessibility.html)

The chart above is deliberately ordinary. The point of custom code is not to make every visual novel. It is to let the interface follow the question, including the details a generic tile tends to hide: freshness, provenance, caveats, and the path from an overview to a specific record.

## When a BI tool still wins

| Need | Likely starting point |
| --- | --- |
| Analysts need to create many reports without code | Existing BI platform |
| Governed metrics, sharing, scheduled delivery, and administration are already in place | Existing BI platform |
| One workflow needs a tailored interaction, brand, or embedded product experience | Agent-built web dashboard |
| A quick prototype must test an unfamiliar data story | Agent-built draft, with numerical review |
| Many teams need to maintain the same reporting estate | Compare total ownership cost before choosing custom code |

An agent reduces the cost of a first version. It does not remove the cost of hosting, accessibility, authentication, query performance, dependency updates, and someone owning the page after the original prompt is forgotten. For a repeatable monthly management pack, the BI tool might remain the cheaper choice. For an operational screen with unusual interactions, code can earn its keep.

## A sensible first experiment

Pick one dashboard that people currently export to a spreadsheet because the existing view cannot answer their follow-up question. Give the agent a read-only MCP connection to one approved mart and a written metric contract. Build one API endpoint and two charts. Before sharing it, compare the numbers with saved SQL results, inspect the mobile layout, check keyboard and screen-reader paths, and verify that unauthorized users cannot request restricted data.

If that small page helps someone make a decision faster, extend it. The interesting change is that building a useful analytical interface can start with a conversation and end as maintainable code. The hard part remains the same: making the data and the interface worth trusting.

## References

- [Model Context Protocol TypeScript SDK: calling tools](https://ts.sdk.modelcontextprotocol.io/v2/clients/calling)
- [ClickHouse: the agentic data stack](https://clickhouse.com/blog/the-agentic-data-stack)
- [MotherDuck: agent skills for analytics](https://motherduck.com/blog/motherduck-agent-skills/)
- [Chart.js documentation and accessibility](https://www.chartjs.org/docs/latest/)
- [D3: data-driven documents](https://d3js.org/what-is-d3)
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer)
- [MCP vs API: two ways software systems connect](/notes/2026-10-17-mcp-vs-api)
`;export{e as default};