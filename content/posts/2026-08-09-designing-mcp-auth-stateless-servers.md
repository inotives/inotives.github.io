---
title: "Designing MCP Authentication for Stateless Servers"
date: 2026-08-09
tags: [mcp, authentication, oauth, ai-security, api-design]
summary: "Stateless MCP moves authentication and authorization onto every request. This guide presents a practical design ladder, from a local single-user server to OAuth resource-server flows and enterprise policy enforcement, with examples for an agent-safe crypto data server."
series: building-ai-systems
---

# Designing MCP Authentication for Stateless Servers

When MCP removes protocol sessions, authentication stops being something a server remembers from an earlier handshake. Every request has to establish who is calling, which resource the token is for, and what the caller may do.

That is a good change. It matches how ordinary HTTP APIs scale. It also exposes a common mistake in agent systems: treating a connection, a client name, or a remembered conversation as proof of authority.

`clientInfo` in MCP `_meta` is useful for compatibility and diagnostics. It is not identity. `Mcp-Name` tells a gateway which tool the request claims to call. It is not permission. A bearer token, workload identity, or local operating-system boundary establishes the caller. Server-side policy decides what that caller may do.

This article lays out four designs, from simple local trust to an enterprise-ready resource server. The right choice depends on the data, users, network exposure, and consequence of the available tools.

## Start with the stateless request boundary

For HTTP MCP, think of every request as a normal protected API call:

```text
POST /mcp
Authorization: Bearer <access token>
Mcp-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: get_market_snapshot
```

The server or its protected edge validates the token on every call. The authorization decision should consider at least:

```text
who:        authenticated subject or workload
resource:   the MCP server the token was issued for
scope:      permitted operation
tool:        requested MCP method and name
arguments:   requested account, asset, date range, or other sensitive scope
tenant:      organizational or account boundary when relevant
```

The body still needs validation. `Mcp-Method` and `Mcp-Name` are mirrors that let a gateway route and apply coarse policy without parsing JSON. A conforming server must reject a mismatch between the headers and JSON-RPC body.

## Design 1: local single-user MCP

The easiest secure design has no remote HTTP endpoint at all. A local agent process starts a local MCP server over stdio or a loopback-only transport. The operating-system user and process boundary are the first identity layer.

```text
your desktop agent
       |
       | stdio or localhost-only connection
       v
local MCP server -> read-only local data or scoped credentials
```

Use this when one person runs one trusted client on one machine. It is a good fit for a local documentation search server or a local coding helper.

The policy still matters:

```yaml
principal: local-developer
allow:
  tools: [search_docs, read_project_file]
  paths: [workspace]
deny:
  tools: [publish_release, read_browser_cookies]
```

Do not expose the same server on `0.0.0.0` and assume the local setup remains safe. Once another process, device, or user can reach it, move to a real request-level authentication design.

This design is easy because it relies on local process trust. Its ceiling is equally clear: it has no good story for multiple users, a hosted service, cross-device access, or central audit.

## Design 2: an internal server with a scoped workload token

The next step is a private HTTP MCP server used by a known service or agent runtime. Give that runtime a short-lived service token and validate it on every request.

```text
agent runtime -> bearer token -> internal gateway -> MCP mart server
```

For a crypto analytics worker, the token could carry a narrow scope:

```json
{
  "sub": "agent-runner:market-data-reader",
  "aud": "https://mcp.example.internal/crypto-data",
  "scope": "market-data.read",
  "exp": "2026-08-09T11:15:00Z"
}
```

The server then maps scope to tools and argument limits:

```yaml
market-data.read:
  allow:
    - get_market_snapshot
    - list_mart_metrics
  constraints:
    schemas: [mart]
    max_range_days: 31
  deny:
    - execute_sql
    - write_raw_table
    - apply_migration
```

This works well for a single organization with an internal identity provider or a workload-identity system. It is simple to operate, and every call remains independently valid behind a round-robin load balancer.

It is not enough to put one permanent API key in an environment variable and call it done. Use short-lived credentials, rotate them, validate expiry and issuer, and keep the MCP endpoint private. A long-lived, all-powerful token simply turns a stateless server into a high-value secret target.

## Design 3: OAuth resource server for multi-user MCP

When an MCP client acts on behalf of a person, use the MCP authorization flow and OAuth rather than inventing a login exchange inside a tool call.

The MCP server is an OAuth protected resource. The client discovers where authorization happens, sends the user through authorization-code flow with PKCE, receives a token for this MCP server, and includes that token on each MCP request.

```text
1. Client calls the MCP server without a token.
2. Server returns 401 and points to Protected Resource Metadata.
3. Client discovers the authorization server and its capabilities.
4. User authorizes the client with PKCE.
5. Client requests a token for this MCP resource.
6. Client sends the bearer token on every MCP request.
```

The resource binding in step 5 is important. MCP clients include OAuth's `resource` parameter in both authorization and token requests. The value identifies the specific MCP server that should accept the token. The server validates that the token was issued for its own audience, rather than accepting a token intended for another service.

For a portfolio MCP server, scopes may look like this:

```text
market-data.read       read public or organization-level market marts
portfolio.read         read the caller's permitted portfolios
reconciliation.preview create a read-only discrepancy preview
report.publish         publish a report after a separate approval check
```

The client does not need every scope at sign-in. If it calls `report.publish` with only `portfolio.read`, the server can reply with a `WWW-Authenticate` challenge that says `error="insufficient_scope"` and names the scope needed for that operation. The client asks for the additional scope only when the user requests the capability.

That is better than giving every chat client production access up front.

## OAuth details worth getting right

The 2026-07-28 MCP authorization specification hardens several parts of the OAuth flow. They are worth treating as implementation requirements, not optional polish.

### Discover the real authorization server

An MCP server must expose OAuth Protected Resource Metadata. A client can find it through a `WWW-Authenticate` response that includes `resource_metadata`, or at an RFC 9728 well-known location.

The metadata tells the client which authorization servers protect the MCP resource. The client then discovers the authorization server's endpoints and supported capabilities from authorization-server metadata.

Do not hard-code an authorization endpoint in every client if discovery is available. It makes issuer changes and multi-environment deployments harder to manage.

### Bind the token to the MCP resource

The OAuth `resource` parameter prevents a token meant for one API from being replayed against another. The client includes the canonical MCP server URI while requesting authorization and a token. The MCP resource server validates the token audience or equivalent resource binding on every request.

```text
token for https://mcp.example.internal/crypto-data
  -> accepted by crypto-data MCP
  -> rejected by portfolio MCP
```

This is one of the most useful protections in an agent stack. Agents often connect to many services. A token stolen from, cached by, or accidentally logged by one integration should not automatically open another one.

### Validate the authorization-server issuer

Before redirecting a user for authorization, the client records the issuer from validated authorization-server metadata together with its PKCE verifier and state. When the authorization response returns, the client validates the response's `iss` value against that expected issuer.

This protects against authorization-server mix-up attacks, where a client receives a response from a different issuer than the one it intended to use.

### Keep tokens out of tool output and logs

Tokens are credentials, not agent context. Do not return them in MCP tool results, store them in task files, put them in review notes, or pass them through to another MCP server.

Token passthrough is explicitly unsafe. If the crypto-data MCP server needs to call a downstream provider, use its own least-privilege credential or a separate token minted for that provider's resource. Do not forward the caller's MCP access token and hope the downstream service interprets it safely.

## Design 4: enterprise gateway, policy engine, and workload identity

The enterprise design keeps OAuth at the edge and adds independent policy checks close to the data.

```text
user or agent client
        |
        | OAuth token bound to the MCP resource
        v
identity-aware gateway
  - validates signature, issuer, expiry, resource, and coarse scopes
  - rate limits by subject, tenant, Mcp-Method, and Mcp-Name
  - emits audit records
        |
        | mutually authenticated internal identity
        v
MCP server
  - validates body/header match
  - applies tool and argument policy
  - enforces tenant and account ownership
        |
        v
read-only mart role or downstream workload credential
```

The gateway is useful, but it must not become a blind token-forwarding proxy. Either let the MCP server validate the access token as a resource server too, or ensure the backend is reachable only through the gateway and receives a signed, mutually authenticated internal identity assertion. An unauthenticated backend behind a public gateway is one routing error away from bypass.

For financial or regulated data, add these controls:

```text
Tenant isolation:      every query carries and validates tenant/account ownership
Tool-level ABAC:       policy checks subject, tool, arguments, data classification, and time
Database least privilege: separate roles for marts, raw data, previews, and writes
Short token lifetime:  reduce the value of a leaked bearer token
Audit trail:           caller, token subject, tool, arguments summary, result class, latency, decision
Approval edge:         require a separate workflow approval before any write, publish, or backfill
```

For example, `portfolio.read` may permit a caller to read only portfolios in `tenant_42`. The JWT claim is not enough on its own. The MCP tool must add that tenant predicate to every query or use a database role with row-level controls. Never let an agent supply a tenant ID and trust that it belongs to the token holder.

## Auth designs compared

| Design | Best for | Identity source | Main strength | Ceiling |
|---|---|---|---|---|
| Local process trust | One developer, local tools | OS user and process | Very low operational cost | No multi-user or remote story |
| Internal workload token | Private service-to-service MCP | Workload identity or short-lived JWT | Simple stateless scaling | Limited user delegation and central policy |
| OAuth resource server | User-facing or multi-client MCP | Authorization code + PKCE | Standard discovery, resource binding, step-up scopes | Requires an identity provider and token lifecycle |
| Enterprise policy plane | Sensitive, multi-tenant, regulated data | OAuth plus gateway and workload identity | Defense in depth, audit, tenant controls | More infrastructure and policy maintenance |

Choose the least complex design that matches the server's exposure and authority. A local search server does not need an enterprise identity plane. A production portfolio server should not rely on a local API key.

## Stateless concerns beyond the token

Bearer-token validation is per request, but other state still needs a home.

```text
Agent task state:          task file or workflow store
Long-running export:       MCP Tasks extension or job store
MRTR requestState:         short-lived server record bound to subject and tenant
Approval decision:         durable workflow record with scope and expiry
Refresh token:             secure client-side storage, never MCP tool state
```

Bind `requestState` to the authenticated subject, requested tool, and a short expiry. A value returned during one user's MRTR flow must not be accepted as an input continuation for another user. The same rule applies to task IDs and job polling: reauthorize every read and status request.

## A practical crypto-server policy

Here is a small policy that separates safe analysis from consequential work:

```yaml
roles:
  market_data_agent:
    scopes: [market-data.read]
    tools: [get_market_snapshot, list_mart_metrics]
    constraints:
      schemas: [mart]
      max_range_days: 31

  reconciliation_reviewer:
    scopes: [reconciliation.preview]
    tools: [preview_provider_reconciliation]
    constraints:
      assets: assigned_task_only

  backfill_operator:
    scopes: [backfill.preview]
    tools: [preview_backfill]
    requires:
      task_status: approved_for_preview

  production_approver:
    scopes: [backfill.apply]
    tools: [apply_backfill]
    requires:
      approval_record: current_and_scoped
```

The policy says what the system can do before a model starts reasoning about it. The model may propose a historical correction. It cannot make the required scope, approval record, or database permission appear by itself.

## Start with one boundary

Do not turn authentication into a grand rewrite. Pick the most consequential remote MCP server.

1. Remove any assumption that a session proves identity.
2. Validate a short-lived bearer token on every request.
3. Bind that token to the server resource and map scopes to narrow tools.
4. Challenge for extra scope when a user requests a more powerful operation.
5. Add an approval gate before the first irreversible action.

That is enough to make a stateless server behave like a trustworthy API. The enterprise layers can follow when the number of users, tenants, systems, or consequences demands them.

## References

- [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP authorization security considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [MCP Goes Stateless: Load Balancers, Auth, Caching, and Multi-Round Trips](/posts/mcp-stateless-core-agent-safe-data-servers)
- [Tool Output Is Untrusted Input](/posts/tool-output-is-untrusted-input)
- [Policy as Code Will Be the Core Skill of AI Engineering](/posts/policy-as-code-core-ai-engineering-skill)
