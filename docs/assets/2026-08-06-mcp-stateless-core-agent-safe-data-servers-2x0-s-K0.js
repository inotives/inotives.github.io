var e=`---
title: "MCP Goes Stateless: Load Balancers, Auth, Caching, and Multi-Round Trips"
date: 2026-08-06
tags: [mcp, ai-agents, api-design, security, data-engineering]
summary: "MCP 2026-07-28 removes protocol sessions and the initialize handshake. This guide explains why that makes load balancing simpler, how headers and cache metadata help gateways, how OAuth authorization works per request, and how Multi Round-Trip Requests replace server-initiated calls."
series: building-ai-systems
---

# MCP Goes Stateless: Load Balancers, Auth, Caching, and Multi-Round Trips

The July 2026 MCP release makes the protocol stateless at its core. The old \`initialize\` handshake and protocol-level session are gone. Each request now carries the information a server needs to handle that request.

That is more than transport cleanup. It changes how an MCP server behaves behind a load balancer, how a gateway can apply policy, where authorization belongs, and how an agent should handle a tool call that needs another piece of input.

For an agent-safe crypto data server, the result is a simpler split: MCP handles one scoped request; a task checkpoint holds the agent's workflow state; an API gateway authenticates and enforces policy; the mart response carries its own freshness and provenance.

## Why stateful MCP made infrastructure awkward

Before 2026-07-28, a client started an MCP session with \`initialize\`, received a protocol version and capabilities, then sent \`notifications/initialized\`. The server could assign an \`Mcp-Session-Id\` and retain state associated with that connection.

That creates a problem as soon as there is more than one server instance:

\`\`\`text
                         +--> MCP server A holds session 9c1
client -> load balancer -+
                         +--> MCP server B does not know session 9c1
\`\`\`

If the first request lands on server A and the next one lands on B, B may not know the negotiated capabilities or session state. Teams work around that in two ways:

- configure sticky sessions so the load balancer keeps sending a client back to A;
- move session state into a shared store that every server can read.

Both add operational cost. Sticky sessions make traffic less evenly distributed and make recovery harder when an instance disappears. A shared session store adds a distributed dependency, expiry rules, synchronization questions, and another place where stale authority can survive.

Long-lived bidirectional streams add another wrinkle. Connections consume resources while the server waits for an event or prepares a server-to-client request. Autoscaling and ordinary request metrics become less representative of the actual work.

The important distinction is this: application state is still useful. A long-running agent may need a task ID, a review return, and a durable checkpoint. The problem was treating that application state as protocol transport state.

## The stateless request model

In MCP 2026-07-28, there is no \`initialize\` or \`notifications/initialized\` exchange. The client sends a normal request and includes protocol and client details in \`_meta\`. A server can process the first request as soon as it arrives.

\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "get_market_snapshot",
    "arguments": {
      "canonical_asset_id": "bitcoin",
      "observed_at": "2026-08-06T09:00:00Z"
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "crypto-analysis-agent",
        "version": "1.0"
      }
    }
  }
}
\`\`\`

The server validates the request's protocol version and capabilities, validates authorization, reads the mart, and returns a result. Any healthy server instance can handle the next request.

\`\`\`text
request 1 -> load balancer -> server A
request 2 -> load balancer -> server B
request 3 -> load balancer -> server C
\`\`\`

No sticky routing is required. No protocol session needs replication. This is ordinary HTTP infrastructure again.

Do not confuse this with an instruction to erase workflow state. The agent's task record should still say why it queried Bitcoin, whether the answer became evidence, and what happens next. The MCP request should carry only the parameters and identity required for that one tool call.

## \`Mcp-Method\` and \`Mcp-Name\` move intent to the edge

The JSON-RPC body has always contained a method such as \`tools/call\` and a tool name such as \`get_market_snapshot\`. In the new Streamable HTTP transport, the client also sends them as HTTP headers:

\`\`\`text
POST /mcp HTTP/1.1
Authorization: Bearer <access token>
Mcp-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: get_market_snapshot
Content-Type: application/json
\`\`\`

The headers mirror the body. A conforming server rejects a request when the header and body disagree. That check matters. A gateway may route on \`Mcp-Name\`, but the server must still confirm that the JSON-RPC request actually asks for that tool.

Putting this small amount of intent in headers helps infrastructure that should not have to parse arbitrary JSON:

\`\`\`text
gateway rule:  Mcp-Name = get_market_snapshot -> crypto-read pool
rate limit:    Mcp-Method = tools/call -> 60 calls/minute per client
WAF policy:    deny Mcp-Name = execute_sql at the public endpoint
audit log:     record method, tool name, caller, response status, latency
\`\`\`

This does not make headers an authorization system. Header names can be forged just like JSON fields. It gives gateways, rate limiters, and firewalls a standard, inspectable operation label, while the server performs the authoritative body match and access check.

For a mart-only server, the policy can stay small:

\`\`\`yaml
tool: get_market_snapshot
allow:
  principal: market-data-reader
  schemas: [mart]
  operations: [read]
deny:
  tools: [execute_sql, write_raw_table, apply_migration]
limits:
  max_range_days: 31
  max_calls_per_minute: 60
\`\`\`

The gateway can route and meter the call early. The tool implementation still checks the principal, arguments, and mart boundary before touching data.

## Cache metadata is useful, but it is not access control

List and resource-read results can now include \`ttlMs\` and \`cacheScope\`. The design resembles HTTP \`Cache-Control\`:

\`\`\`json
{
  "resultType": "complete",
  "tools": ["get_market_snapshot", "list_mart_metrics"],
  "ttlMs": 3600000,
  "cacheScope": "public"
}
\`\`\`

\`ttlMs\` says how long a client may consider that exact response fresh. \`cacheScope\` is either \`public\` or \`private\`.

The obvious use is a tool catalog. The names and descriptions of public, read-only market-data tools may be shared for an hour. That avoids repeated \`tools/list\` calls and keeps prompt caches more stable across reconnects.

The security rule is more important than the performance gain: a response marked \`public\` can be reused outside the authorization context that fetched it. Only use it when the result contains no user-specific or scope-specific information. A portfolio-specific resource, an account-specific tool list, or a response whose visibility changes by role must be \`private\` or not cached.

\`\`\`yaml
public:
  resource: crypto-mart-schema
  ttlMs: 3600000
  reason: same read-only schema for every permitted caller

private:
  resource: available-portfolios
  ttlMs: 30000
  reason: depends on the caller's account scope
\`\`\`

\`cacheScope\` is a cache hint, not a substitute for per-resource authorization. Servers must apply access control before returning a result, even when they call it public. Clients must also cache only an identical method-and-parameter request.

Do not cache a response generated through a Multi Round-Trip Request. It depends on additional inputs outside a normal cache key.

For financial data, cache metadata and data freshness are separate. A tool description can be cached for an hour. A BTC price response still needs \`observed_at\`, \`ingested_at\`, \`fresh_until\`, and a source run ID. A cache hint does not make an old price safe for a trading alert.

## Authorization becomes ordinary per-request API security

Stateless MCP does not mean unauthenticated MCP. It means the server authenticates and authorizes every request, like a conventional HTTP API.

For a remote server, a good baseline is:

\`\`\`text
TLS protects the transport.
Bearer access tokens identify the authorized caller.
The gateway validates token signature, expiry, issuer, audience or resource.
The MCP server maps scopes and claims to tools and argument limits.
The database uses a separate read-only role with mart-only access.
\`\`\`

The 2026-07-28 authorization specification hardens the OAuth flow in several useful ways.

- Clients use OAuth 2.0 Resource Indicators: the authorization request and token request identify the exact MCP server resource the token is for.
- Clients validate a returned authorization response's \`iss\` value before redeeming the code, reducing authorization-server mix-up attacks.
- Protected Resource Metadata and scope challenges give clients a standard way to discover authorization requirements and handle insufficient scope.
- A server can return \`WWW-Authenticate\` with the required scope when a client has a valid token that lacks permission for a runtime operation.

The operational recommendation is simple. Do not mint one broad token for every MCP tool. Give a data-analysis agent a token or scope that reaches read-only mart tools. Give a release agent a different scope that can prepare a release but still requires an explicit human approval edge before publishing.

\`\`\`text
market-data.read     -> get_market_snapshot, list_mart_metrics
portfolio.read       -> get_portfolio_summary for permitted accounts
backfill.preview     -> create a dry-run correction preview
backfill.apply       -> unavailable until an approval workflow issues it
\`\`\`

The token travels on every request. The server does not rely on an earlier handshake to remember who the caller was. Store any long-running application state under a task ID or job ID, and reauthorize access to it when the client polls.

## Multi Round-Trip Requests replace server-initiated calls

Stateful MCP could keep a stream open and send a server-initiated request when it needed client input. The new protocol uses Multi Round-Trip Requests, or MRTR.

The pattern is a controlled retry of the original request:

\`\`\`text
1. Client calls a tool.
2. Server needs extra input and returns resultType: input_required.
3. Client obtains that input from the user or an approved local capability.
4. Client retries the original request with inputResponses and requestState.
5. Server returns resultType: complete.
\`\`\`

Here is a crypto example. An agent asks a tool to preview a historical reconciliation between two price providers. The server sees an ambiguous asset mapping: one provider's \`USDC\` refers to a canonical Ethereum token and the other refers to a bridged version.

The server should not guess.

\`\`\`json
{
  "resultType": "input_required",
  "requestState": "reconcile-6f2a",
  "inputRequests": [
    {
      "id": "asset-choice",
      "message": "Choose the canonical asset mapping for provider_b:USDC",
      "options": ["ethereum-usdc", "bridged-usdc"]
    }
  ]
}
\`\`\`

The client presents the choice to the appropriate human or policy-controlled component. It then retries the same tool call with the response and the returned state:

\`\`\`json
{
  "inputResponses": {
    "asset-choice": "ethereum-usdc"
  },
  "requestState": "reconcile-6f2a"
}
\`\`\`

Any healthy server instance can process the retry. If the server needs durable correlation data, it stores that data under \`reconcile-6f2a\` in its application store, not in an MCP transport session.

MRTR is useful for user consent, a missing parameter, an account selector, or a local capability that must be invoked before a tool can finish. It is not a replacement for a long-running job. Use the formal Tasks extension when work has a durable lifecycle such as an export or a backfill preview; use the agent workflow's checkpoint when the result requires review or approval.

## Other breaking changes worth planning for

The stateless core is the headline, but a migration should account for the related changes.

| Change | What it means for an implementation |
|---|---|
| \`initialize\` and \`notifications/initialized\` removed | Put version, capabilities, and client identity in every request's \`_meta\`. |
| \`Mcp-Session-Id\` removed | Delete session affinity and move durable state to an application store. |
| Results require \`resultType\` | Handle \`complete\` and \`input_required\`; older result shapes are not enough. |
| MRTR replaces server-initiated Roots, Sampling, and Elicitation | Rework client interactions as retryable requests with \`inputResponses\`. |
| Legacy HTTP+SSE is deprecated | Plan a move to Streamable HTTP during the stated migration window. |
| Roots, Sampling, and Logging are deprecated | Do not adopt them in new implementations; use their replacement patterns. |
| Tasks are an extension | Negotiate and implement \`io.modelcontextprotocol/tasks\` only when asynchronous server work needs it. |

There is no need to migrate every server in one weekend. Run the new SDKs in staging, ensure header/body validation is in place, remove reliance on sessions, and test real authorization failures before changing production traffic.

## A safe migration for a crypto mart server

For a small MCP server over curated data marts, the migration plan can stay narrow:

1. Upgrade the SDK and support \`2026-07-28\` in a staging environment.
2. Replace session-derived caller state with a bearer token validated on every request.
3. Add \`Mcp-Method\` and \`Mcp-Name\` gateway rules, then verify the server rejects mismatches.
4. Mark only globally safe tool catalogs and schema resources as \`public\` cache entries. Keep account and entitlement results private.
5. Return freshness, provider, and source-run metadata from every market-data answer.
6. Use MRTR for missing human choices, and Tasks for server-side work that truly runs asynchronously.
7. Keep changes to published prices, raw tables, and production backfills behind a workflow approval checkpoint.

The protocol is now easier to load-balance. That does not remove the need for policy. It makes the policy easier to place at the right layers: gateway for routing and coarse limits, server for tool and argument checks, database for least privilege, and agent workflow for review and approval.

## The core lesson

Stateful MCP made the transport carry more responsibility than it should. Stateless MCP returns it to a simpler job: move a self-contained request to a server and return a result.

That lets infrastructure scale normally. More importantly, it forces the important state into places that can be inspected and governed: task files, application records, OAuth scopes, tool policies, data marts, and approval checkpoints.

For agent systems, that is a healthy trade. Keep the protocol stateless. Keep the workflow durable. Keep authority explicit.

## References

- [MCP 2026-07-28 specification release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP Is Becoming the API Layer for Internal Data](/posts/mcp-api-layer-internal-data)
- [What Makes a Mart Agent-Safe](/posts/what-makes-a-mart-agent-safe)
- [Tool Output Is Untrusted Input](/posts/tool-output-is-untrusted-input)
`;export{e as default};