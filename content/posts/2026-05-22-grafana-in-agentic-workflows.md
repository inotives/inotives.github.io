---
title: "Grafana in Agentic Workflows: Observability, Dashboards via MCP, and Common Patterns"
date: 2026-05-22
tags: [grafana, observability, agentic-workflows, mcp, ai-agents, dashboards, monitoring, data-engineering]
summary: "Why Grafana is the observability layer for production agents. How to set up Grafana MCP, create dashboards with Codex, and common data-agentic workflow patterns for monitoring, cost tracking, and incident response."
---

## Why Grafana for Agentic Workflows

Every production agent system needs observability. Agents make decisions, call tools, generate content, and interact with users in ways that traditional APM is not designed to handle. When an agent produces a wrong answer, you need to reconstruct its reasoning path, tool calls, token usage, and the exact prompt that caused the failure — across multiple turns.

Grafana Cloud's AI Observability (public preview as of April 2026) treats agent sessions and conversations as **first-class telemetry signals** alongside metrics, logs, and traces. This means every LLM call, tool invocation, and agent turn is captured as a distributed trace in Tempo, with metrics in Prometheus, and logs in Loki — all correlated in one pane.

The Grafana MCP server (`mcp-grafana`) is what connects this observability platform to your agents. It exposes the full Grafana surface — dashboards, datasources, alerts, incidents — as MCP tools any MCP-compatible agent can call.

## Two Grafana MCP Servers

Grafana ships two MCP servers for different deployment models:

| Feature | OSS MCP Server | Cloud MCP Server |
|---|---|---|
| Installation | Local binary, Docker, uvx | None (fully hosted) |
| Auth | Service account token | OAuth 2.1 browser flow |
| Scope | Service account-scoped | User-scoped (your RBAC) |
| Deploy target | Any Grafana instance | Grafana Cloud only |
| Transport | stdio, SSE, streamable-http | Streamable HTTP only |

The OSS server is for self-hosted Grafana. The Cloud server is a remote endpoint at `https://mcp.grafana.com/mcp` — no installation, just point your agent at it and authorize in the browser.

## Setup

### OSS MCP Server

Install via uvx (zero-install, auto-caches):

```json
{
  "mcpServers": {
    "grafana": {
      "command": "uvx",
      "args": ["mcp-grafana"],
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_SERVICE_ACCOUNT_TOKEN": "glsa_..."
      }
    }
  }
}
```

Or via Docker:

```json
{
  "mcpServers": {
    "grafana": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "GRAFANA_URL",
        "-e", "GRAFANA_SERVICE_ACCOUNT_TOKEN",
        "grafana/mcp-grafana",
        "-t", "stdio"
      ],
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_SERVICE_ACCOUNT_TOKEN": "glsa_..."
      }
    }
  }
}
```

Create a service account in Grafana (Administration > Users > Service Accounts) with an Editor role, generate a token, and set it as `GRAFANA_SERVICE_ACCOUNT_TOKEN`.

### Cloud MCP Server with Codex CLI

Codex has a one-liner:

```bash
codex mcp add grafana --transport http https://mcp.grafana.com/mcp
```

Or with your stack URL for auto-redirect:

```bash
codex mcp add grafana \
  --transport http \
  --header "X-Grafana-URL: https://your-stack.grafana.net" \
  https://mcp.grafana.com/mcp
```

For TOML config (`~/.codex/config.toml`):

```toml
[mcp_servers.grafana]
command = "mcp-grafana"
args = []
env = { GRAFANA_URL = "http://localhost:3000", GRAFANA_SERVICE_ACCOUNT_TOKEN = "glsa_..." }
```

### Cloud MCP Server with Claude Code

```bash
claude mcp add grafana \
  --transport http \
  --header "X-Grafana-URL: https://your-stack.grafana.net" \
  https://mcp.grafana.com/mcp
```

## Creating Dashboards with Codex

Once the MCP server is configured, creating a dashboard is a natural-language prompt. The agent uses the Grafana MCP tools under the hood.

### Example: Create a Dashboard from Scratch

Prompt in Codex:

> "Create a Grafana dashboard called 'Agent Cost Tracker' with a Prometheus panel showing token usage per model over the last 7 days, broken down by provider. Use my Grafana MCP server."

The agent will:

1. Call `list_datasources` to find the Prometheus datasource
2. Call `search_dashboards` to check for existing dashboards with the same name
3. Call `update_dashboard` with the full panel JSON — or `patch_dashboard` for targeted changes

### Example: Clone and Modify

> "Get dashboard by UID 'abc123', add a new panel showing p95 latency for the 'summarizer' agent, and save it as a new dashboard called 'Summarizer Performance'."

The agent uses:
- `get_dashboard_by_uid` to retrieve the source JSON
- `update_dashboard` to create the new dashboard with the modified JSON

### Example: Investigate and Fix

> "Query Prometheus for the top 5 slowest Loki queries in the last hour. Create an annotation on the 'Loki Performance' dashboard at the time of the slowest query."

The agent chains:
1. `query_prometheus` — execute the PromQL
2. `search_dashboards` — find the target dashboard
3. `create_annotation` — mark the incident time on the panel

### Token-Conscious Design

The Grafana MCP server includes tools specifically designed to minimize context consumption:

| Tool | Context saved | Why |
|---|---|---|
| `get_dashboard_summary` | Large | Returns title, panel count, types, variables — no full JSON |
| `get_dashboard_property` | Large | Extract specific fields via JSONPath instead of the whole blob |
| `patch_dashboard` | Large | Apply targeted changes without round-tripping the full dashboard JSON |
| `get_dashboard_panel_queries` | Medium | Get queries+datasource info without panel render JSON |

Use these instead of raw `get_dashboard_by_uid` + manual JSON manipulation when working in token-constrained environments.

## MCP Tools Reference

The Grafana MCP server exposes tools organized by category:

### Dashboards & Folders

| Tool | What it does |
|---|---|
| `search_dashboards` | Find dashboards by query string |
| `get_dashboard_by_uid` | Full dashboard JSON (context-heavy) |
| `get_dashboard_summary` | Compact metadata summary |
| `get_dashboard_property` | JSONPath extraction of specific fields |
| `get_dashboard_panel_queries` | Panel queries with template variable substitution |
| `update_dashboard` | Create or update (full JSON or patch) |
| `create_folder` | Create a folder |
| `get_panel_image` | Render panel as PNG |

### Datasources & Querying

| Tool | What it does |
|---|---|
| `list_datasources` | All configured datasources with type filtering |
| `list_prometheus_metric_names` | Discover available metrics with regex |
| `list_prometheus_metric_metadata` | Metadata about scraped metrics |
| `list_prometheus_label_names` / `values` | Label discovery |
| `query_prometheus` | PromQL instant or range queries |
| `query_prometheus_histogram` | Histogram percentile queries |
| `list_loki_label_names` / `values` | Log label discovery |
| `query_loki_logs` | LogQL queries |
| `query_loki_patterns` | Common log pattern detection |

### Alerting & Incidents

| Tool | What it does |
|---|---|
| `alerting_manage_rules` | List, filter, create, update alert rules |
| `get_annotations` / `create_annotation` / `update_annotation` | Annotation CRUD |
| `list_incidents` / `get_incident` / `create_incident` | Incident management |
| `add_activity_to_incident` | Timeline notes |
| `list_sift_investigations` / `get_sift_analysis` | Sift RCA investigations |
| `find_error_pattern_logs` | Search Loki for elevated error patterns |
| `find_slow_requests` | Search Tempo for slow traces |

### Assistant & Infrastructure

| Tool | What it does |
|---|---|
| `ask_assistant` | Route a prompt to Grafana Assistant |
| `describe_infrastructure` | Pre-built service topology summaries |
| `generate_deeplink` | Dashboard/panel/explore deeplinks |

## Instrumenting Agents for Observability

The Grafana MCP server gives agents access to observability data, but your agents themselves need to *emit* observability data. This is the other half of the loop.

OpenLIT provides a single-call instrumentation:

```python
import openlit
openlit.init()
```

This single call instruments the entire agent pipeline — planning steps, tool calls, LLM completions — as OpenTelemetry spans. Metrics and traces flow into Grafana Cloud's managed Prometheus and Tempo, where pre-built dashboards automatically populate:

- **GenAI Observability** — latency, token counts, cost per model/provider
- **AI Agents** — agent names, actions, tool call sequences, reasoning paths
- **MCP Observability** — tool invocation duration, protocol health, error tracking
- **Vector DB Observability** — retrieval latency, chunk counts
- **GPU Monitoring** — utilization, memory, temperature

For MCP servers specifically, you instrument both the client and the server:

```python
from mcp import Server
import openlit

openlit.init()

server = Server("my-tool-server")
# ... tool definitions ...
# Every tool call is now traced end-to-end
```

The traces show the full path: agent → MCP server → tool → downstream API, all correlated.

## Common Data-Agentic Workflow Patterns

### 1. Incident Response Loop

The most mature pattern. An alert fires → an agent investigates → it creates a dashboard annotation → it proposes a fix.

```
Alert fires (grafana) → MCP notifies agent → agent queries Prometheus
  → agent queries Loki for recent errors → agent queries Tempo for slow traces
  → agent creates annotation on dashboard → agent posts summary to Slack
```

With Grafana Assistant, this is automated: the SRE agent surfaces root cause signals, correlates across telemetry types, and guides remediation without human context-switching.

### 2. Cost Tracking per Agent

Each agent version (identified by its system prompt + tool set) generates trace data. AI Observability automatically classifies and catalogs agent versions. The pattern:

```
Agent emits OTel spans → Grafana records token count + cost per model
  → Pre-built dashboard shows cost/agent/day → alert when cost exceeds threshold
  → Agent optimizes by switching to cheaper model for low-risk tasks
```

You can drill into any conversation to see the full thread: tool calls, execution traces, token usage, cost breakdown, scores, and annotations. This surfaces which tools are expensive and which models are overkill for specific tasks.

### 3. Automated Dashboard Hygiene

Dashboards rot. Panels break when datasources are renamed, queries drift as schemas change, unused dashboards accumulate.

```
Agent scans all dashboards (search_dashboards) → checks each panel query
  → identifies broken datasource refs → generates deeplinks for review
  → patches dashboard metadata (AI-generated titles, descriptions)
  → suggests archival for dashboards untouched in 90 days
```

The MCP tools `get_dashboard_panel_queries` and `patch_dashboard` make this surgical — no need to round-trip the full dashboard JSON for a title fix.

### 4. Infrastructure-Aware Agent

An agent that understands topology makes better decisions. The `describe_infrastructure` tool returns pre-built summaries of service groups including topology, metrics, and dependencies.

```
User: "Why is the checkout service slow?"
Agent: Calls describe_infrastructure → sees checkout depends on payments API
  → queries Tempo for payments traces → identifies rate limiting
  → suggests scaling payments worker pool
```

### 5. MCP Reliability Monitoring

MCP servers are the new black box in agentic systems. Without visibility, you send a request and hope a tool answers. The MCP observability dashboard tracks:

- **Tool performance** — call latency histograms, success rates, invocation counts per tool
- **Protocol health** — session stability, connection metrics, handshake failures
- **Resource usage** — context window size, memory, data access patterns
- **Error tracking** — failed operations with trace IDs and exception details

The pattern: an agent's tool call fails → the trace shows the MCP span with the error → the agent can retry with a different fallback strategy, all captured in the same trace.

### 6. Grafana Cloud CLI (GCX)

Announced at GrafanaCON 2026, GCX brings the full Grafana Cloud surface into the agent's CLI environment. An agent can provision datasources, configure alert rules, query telemetry, and correlate alerts with recent git commits — all from the dev environment without context-switching into a browser.

```
GCX → agent queries live observability → correlates with recent deploys
  → proposes rollback or fix → opens PR
```

This closes the loop between code and production: observability data drives the next action, and the agent never leaves the CLI.

## The o11y-bench Standard

Grafana open-sourced o11y-bench at GrafanaCON 2026 — a benchmark for evaluating AI agents on observability workflows. Built on Harbor, it runs against a real Grafana stack and measures how agents perform on:

- Querying metrics, logs, and traces
- Investigating incidents
- Making targeted dashboard changes
- Navigating the MCP tool surface

It measures actual actions in the system, not just output quality. For teams evaluating agent frameworks for observability tasks, this is the first standardized benchmark.

## Summary

Grafana serves two roles in agentic workflows: it is the **observability backend** for agents (via OpenLIT + AI Observability) and the **MCP tool surface** agents use to interact with observability data (via `mcp-grafana`). The MCP server gives agents read/write access to dashboards, datasources, alerts, and incidents through structured tools designed to minimize context consumption.

For data-agentic workflows, the mature patterns are: incident response automation, per-agent cost tracking, dashboard hygiene, infrastructure-aware agents, and MCP reliability monitoring. Grafana's GCX CLI and o11y-bench benchmark are indicators that the platform is investing heavily in agent-native interfaces.

## Sources

- Grafana AI Observability: https://grafana.com/products/cloud/ai-observability/
- AI Observability for Agents: https://grafana.com/blog/ai-observability-for-agents-in-grafana-cloud/
- Grafana MCP Server docs: https://grafana.com/docs/grafana/latest/developer-resources/mcp/
- Codex CLI + Grafana MCP: https://grafana.com/docs/grafana/latest/developer-resources/mcp/clients/codex/
- Monitor MCP servers with OpenLIT: https://grafana.com/blog/ai-observability-MCP-servers/
- Observe agents with OpenLIT: https://grafana.com/blog/ai-observability-ai-agents/
- Grafana Cloud MCP Server: https://grafana.com/docs/grafana-cloud/machine-learning/assistant/configure/cloud-mcp/
- GrafanaCON 2026 announcements: https://grafana.com/press/2026/04/21/grafana-labs-targets-the-ai-blind-spot/
- mcp-grafana repo: https://github.com/grafana/mcp-grafana
- Prior note — Postgres in agentic workflows: /notes/postgres-in-agentic-workflows
- Prior note — prompt engineering: /notes/prompt-optimizer-and-llm-tokens
