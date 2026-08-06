var e=`---
title: "MCP's Stateless Core Changes How We Build Agent-Safe Data Servers"
date: 2026-08-06
tags: [mcp, ai-agents, data-engineering, crypto-data]
summary: "MCP 2026-07-28 removes transport sessions from the protocol core. For agent-safe data servers, that means MCP can scale as ordinary request/response infrastructure while workflow state, authorization, freshness, and provenance stay explicit and durable."
series: building-ai-systems
---

# MCP's Stateless Core Changes How We Build Agent-Safe Data Servers

The Model Context Protocol's 2026-07-28 release removes the session from its protocol core. MCP requests are now self-describing request/response interactions instead of steps in a transport-level conversation.

That sounds like a protocol detail. For an MCP server that gives agents access to internal or crypto market data, it changes the architecture.

A stateful server encourages a dangerous shortcut: keep the agent's identity, task, previous query, and access assumptions inside a long-lived connection. That connection becomes an accidental memory store. It is hard to load-balance, difficult to audit, and easy to confuse with authorization.

The stateless core creates a cleaner split. MCP transports a scoped request. Durable workflow state belongs in a task record, checkpoint, or agent-memory system. Access policy belongs in the server and gateway. Data freshness and provenance belong in the response.

## The server should not remember the agent's job

Consider a crypto analytics agent answering, "What was BTC's 24-hour volume at 09:00 UTC?"

With a session-shaped design, the server may remember the previous asset, date range, or user role. A retry sent to another instance can lose that context. A stale connection can retain more authority than the current task should have.

With a stateless design, every request has what the server needs to make one bounded decision:

\`\`\`yaml
tool: get_market_snapshot
arguments:
  canonical_asset_id: bitcoin
  observed_at: 2026-08-06T09:00:00Z
  metrics: [price_usd, volume_usd_24h]
request_context:
  graph_id: crypto-analysis
  run_id: run-8f31
  node_id: market-data-reader
\`\`\`

The server validates the arguments, checks the caller's scope, queries a read-only mart, and returns a response. It does not need to remember what the agent asked five minutes ago.

The agent's task file or checkpoint can still record why the query was made and what to do with the result. That state remains available when the agent retries, a reviewer takes over, or a different worker resumes the task.

## Stateless transport is not stateless workflow

Removing transport sessions does not remove state from an agent system. It forces the right question: where should each kind of state live?

\`\`\`text
MCP request:        one tool call and its scoped identity
Task checkpoint:    goal, status, evidence, and next action
Agent memory:       durable knowledge and past decisions
Data mart:          current or point-in-time facts with freshness metadata
\`\`\`

This is useful for the workflows described in the graph-engineering and checkpoint articles. A worker may call the same MCP tool several times, but the graph owns the run. A reviewer can inspect the task evidence without relying on a server's private session history.

For a long-running backfill investigation, the task record should carry the correction window and report version. The data server should receive only the parameters required for a single mart query. Keeping those concerns separate makes retries ordinary.

## Header-based routing makes policy visible

The new release requires Streamable HTTP requests to carry \`Mcp-Method\` and \`Mcp-Name\` headers. A gateway, rate limiter, or web application firewall can use those headers to route and meter MCP traffic without parsing a JSON body first.

That gives an agent-safe data server a practical policy boundary:

\`\`\`text
Mcp-Method: tools/call
Mcp-Name: get_market_snapshot

route:     read-only crypto mart gateway
limit:     60 calls per minute per caller
timeout:   3 seconds
deny:      raw schemas, write tools, and unapproved date ranges
\`\`\`

The header does not authorize a request by itself. The server must still validate identity and arguments. It does make the requested capability visible to infrastructure that should not have to understand every tool payload.

This is especially helpful when a single gateway fronts several MCP servers. A pricing server and a portfolio-rebalance server should not share the same rate limits or approval rules merely because both speak MCP.

## Cache metadata, not financial certainty

The 2026-07-28 specification also lets list and resource responses provide \`ttlMs\` and \`cacheScope\`. That is useful for slowly changing metadata:

\`\`\`yaml
resource: crypto-mart-schema
ttlMs: 3600000
cacheScope: public
\`\`\`

An agent can cache column descriptions, accepted metric names, and provider documentation for an hour. That reduces repeated discovery calls and makes the server cheaper to operate.

Market data needs a different rule. Do not attach a generous cache policy to a response just because it is easy. A snapshot should state when it was observed, when it was ingested, and how long it remains fit for the current question:

\`\`\`yaml
canonical_asset_id: bitcoin
price_usd: 104200.10
observed_at: 2026-08-06T09:00:00Z
ingested_at: 2026-08-06T09:00:08Z
fresh_until: 2026-08-06T09:05:00Z
source_run_id: ingest-2026-08-06-0900
\`\`\`

The MCP cache hint governs transport behavior. Freshness metadata governs whether an answer is valid for a trading alert, a dashboard, or a historical report. They solve different problems.

## Tasks are now a formal extension

The release moves Tasks out of the experimental core into the \`io.modelcontextprotocol/tasks\` extension. That matters when a tool cannot complete inside one request, such as a large export, a backfill preview, or a reconciliation job.

The temptation is to make every data query an MCP task. Resist it. Most mart queries should remain small, read-only calls. Use a task when the work has a real lifecycle, durable evidence, and a result worth polling.

For example:

\`\`\`text
agent requests: preview_provider_reconciliation(asset=bitcoin, range=24h)
server returns: task ID and a bounded scope
task completes: discrepancy records and a source-run reference
agent records: evidence in its workflow checkpoint
human approves: any historical correction or published override
\`\`\`

The MCP task represents asynchronous server work. It should not replace the agent workflow's planner-worker-reviewer graph. A server-side task can produce evidence for the graph; the graph decides whether to act on it.

## Migrate without widening access

The old session-shaped behavior may be convenient, especially for local servers. Do not use a protocol migration as an excuse to add broad tools or implicit context.

Start by making each existing tool request complete on its own:

1. Put caller identity and required capability claims on every request.
2. Pass explicit asset IDs, time ranges, and metric names rather than relying on prior calls.
3. Move workflow context into a task/checkpoint record.
4. Return freshness, source, and refusal metadata with every data answer.
5. Keep database roles read-only and schemas mart-only.

The result is easier to deploy on ordinary HTTP infrastructure and easier to review. It also follows the security rule that tool output is untrusted input. The server returns evidence. The agent workflow, under its own policy, decides what that evidence permits next.

## The useful architecture is still small

A first version needs one stateless MCP server, a small set of typed read-only tools, and a durable place for workflow state. It does not need a general query executor, a shared conversation cache, or a second memory system hidden inside the data service.

\`\`\`text
agent graph -> task checkpoint -> stateless MCP tool -> curated mart
                    |                                  |
                    +-------- evidence and provenance --+
\`\`\`

MCP's stateless core makes scaling simpler. The important design decision remains the same: give agents narrow, inspectable access to data, and keep the authority to act outside the retrieved result.

## References

- [The MCP 2026-07-28 specification release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP Is Becoming the API Layer for Internal Data](/posts/mcp-api-layer-internal-data)
- [What Makes a Mart Agent-Safe](/posts/what-makes-a-mart-agent-safe)
- [AI-Assisted Analytics with MCP and ClickHouse](/posts/ai-assisted-analytics-mcp-clickhouse)
- [Tool Output Is Untrusted Input](/posts/tool-output-is-untrusted-input)
`;export{e as default};