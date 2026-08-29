var e=`---
title: "Tool Selection Is Now a Retrieval Problem, Not a Prompt Problem"
date: 2026-08-29
tags: [ai-agents, tool-calling, retrieval, mcp, evaluation]
summary: "As agent tool catalogues grow, listing every capability in a prompt stops working. Reliable tool use needs catalog design, candidate retrieval, constrained arguments, abstention, policy checks, and trajectory-level evaluation."
series: building-ai-systems
---

Early agents had four tools: search, read, write, and shell. Putting all four definitions in a prompt was fine. Production agents collect tools the way companies collect internal APIs. Soon the same agent can query marts, inspect incidents, open tickets, run deployments, send messages, search documentation, and call dozens of MCP servers.

At that point, tool use has two separate jobs:

1. Select the one or few capabilities relevant to the request.
2. Produce valid, grounded arguments for the selected capability.

Adding a longer system prompt helps neither job for very long. The model has to compare similar descriptions, carry more schemas in context, and distinguish tools that differ only in policy or scope. Tool selection becomes an information-retrieval problem. Argument production becomes a structured decoding problem.

## Why a large tool list degrades an agent

Imagine a data operations agent with these tools:

\`\`\`text
get_price_disagreement(run_id, symbol)
get_provider_freshness(provider, window)
get_raw_response_status(response_id)
query_daily_market_mart(symbol, date)
query_raw_provider_table(sql)
open_data_incident(summary, severity)
\`\`\`

The first four are ordinary read-only operations. The fifth is intentionally unsafe for the agent. The sixth has a side effect and needs a stronger policy check.

A prompt containing all six schema definitions can still work. Replace six with sixty near-duplicates across a company, then add MCP tools from ticketing, observability, documentation, and deployment systems. Selection has become a ranking task:

\`\`\`text
user request -> retrieve candidate tools -> select one -> fill arguments -> policy check -> execute
\`\`\`

The agent should not spend its context window repeatedly reading tool schemas it cannot safely invoke. An unselected tool should be unavailable to the decoder for that turn, not merely less likely to be chosen.

## The catalog is a retrieval index

Tool retrieval starts with a catalog. A tool needs more than a short function name.

\`\`\`json
{
  "name": "get_price_disagreement",
  "description": "Read the recorded price gap between approved providers for one pipeline run. This tool is read-only. Use it to investigate a disagreement alert.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "run_id": {
        "type": "string",
        "description": "Ingestion run identifier from the alert"
      },
      "symbol": {
        "type": "string",
        "enum": ["BTC/USDT", "ETH/USDT"],
        "description": "Canonical market symbol"
      }
    },
    "required": ["run_id", "symbol"]
  },
  "metadata": {
    "domain": "market-data",
    "risk": "read",
    "scopes": ["production-mart", "staging-mart"],
    "owner": "data-platform"
  }
}
\`\`\`

The description should state what the tool does, when to use it, and its boundary. "Gets data" is not enough. A model cannot infer that \`query_raw_provider_table\` is disallowed simply because a safer mart tool exists.

The Model Context Protocol defines a tool around a name, description, JSON input schema, optional output schema, and annotations. That gives a common interchange format. The retrieval index should add operational metadata that every client treats as policy input: domain, owner, risk, allowed scopes, freshness expectation, and deprecation status.

## Retrieve candidates before the model chooses

The retrieval stage receives the user request, task state, identity, and allowed scopes. It returns a small candidate set, usually between three and eight tools.

\`\`\`text
request: "Why did the BTC/USDT disagreement alert fire?"

candidate ranking:
  1. get_price_disagreement                 0.94
  2. get_provider_freshness                 0.76
  3. get_raw_response_status                0.62
  4. query_daily_market_mart                0.48

excluded by policy:
  query_raw_provider_table
  open_data_incident
\`\`\`

The selector can combine several signals:

| Signal | What it contributes |
| --- | --- |
| Lexical match | Exact names, identifiers, and domain terms such as \`run_id\` or \`freshness\` |
| Semantic similarity | Paraphrases and related intent |
| Current task state | Tools relevant after the previous tool result |
| Identity and scope | Whether the caller is permitted to see or invoke the tool |
| Risk and cost | Prefer a read-only, bounded tool before a destructive or expensive one |
| Tool health | Remove tools that are disabled, stale, or currently failing |

Do policy filtering before ranking when possible. There is no reason to show a deployment tool to a data-quality reviewer who cannot invoke it. This reduces both risk and ambiguity.

Needle uses this pattern in a compact runtime: once a catalog has more than five tools, it embeds tools and the query, renders only the top five candidates, and rebuilds its grammar for that subset. OpenLocalAgent similarly retrieves across a large schema catalog before producing a constrained call. The implementation details differ; the system principle is the same.

## Selection and arguments are different tests

A tool call can fail in at least four ways:

| Failure | Example | Fix belongs in |
| --- | --- | --- |
| Wrong tool | Opens an incident when the agent should inspect the disagreement first | Catalog, ranking, and policy |
| Right tool, wrong arguments | Uses \`ETH/USDT\` for a BTC alert | Schema, entity grounding, and validation |
| Valid call, wrong scope | Reads a raw production table | Authorization and tool design |
| Correct call, unsafe result use | Treats an old provider status as current | Freshness contract and agent policy |

Teams often collapse all four into "the model made a mistake." That prevents useful debugging. A better evaluation records tool selection, arguments, policy decision, result version, and the next action in the trajectory.

## Constrain arguments instead of repairing JSON

JSON parsing is the weakest possible definition of a valid tool call. This payload parses:

\`\`\`json
{
  "symbol": "BTC/USDT",
  "run_id": "latest",
  "include_secrets": true
}
\`\`\`

It may still violate the tool contract. Good schemas narrow the available values, require identifiers that actually exist, and distinguish human text from policy-sensitive fields.

\`\`\`python
from typing import Annotated, Literal

@tool
def get_price_disagreement(
    run_id: Annotated[str, Field(pattern=r"^run_[0-9a-z_-]+$")],
    symbol: Literal["BTC/USDT", "ETH/USDT"],
):
    "Read one approved provider-disagreement record. This tool cannot query raw tables."
\`\`\`

Schema-guided decoding or grammar-constrained decoding can ensure that generated output conforms to the declared shape. It cannot establish whether the selected \`run_id\` refers to the current incident. Validate that against trusted state after decoding.

The safest system combines four layers:

\`\`\`text
candidate retrieval
  -> constrained tool and argument generation
  -> server-side authorization and semantic validation
  -> result with freshness and provenance metadata
\`\`\`

The tool server is the final authority. An LLM should never be the only permission check.

## Abstention is a feature

A selector should be able to say "none of these tools apply." If every request must map to a tool, the agent will force a plausible action onto an unrelated question.

OpenLocalAgent publishes a useful distinction in its tool-calling evaluation: full-call accuracy means both the correct tool and every argument are grounded exactly. It also measures abstention with a score threshold. In its published 18-tool example, adding the threshold reduced full-call accuracy slightly while providing an abstention result for requests that should not be routed automatically. With 1,000 distractor tools, full-call accuracy dropped further. Those figures are implementation-specific, but the lesson travels: a real catalog has distractors, and a safe system must measure refusal alongside selection.

For the market-data agent, abstention conditions can be explicit:

- the alert does not include a recognised run ID;
- the request concerns an unsupported symbol;
- retrieval scores are too close to distinguish two tools;
- the only candidates have side effects beyond the user's scope;
- the necessary tool is unhealthy or its data is stale.

The response can ask for the missing identifier, route to a human, or call a low-risk discovery tool. A confident guess is usually the worst option.

## Tool results should help the next retrieval

Selection continues after the first turn. A result changes the next question.

\`\`\`text
turn 1: get_price_disagreement(run_92, BTC/USDT)
result: 125 bps gap; Coinbase observation is 18 minutes old

turn 2 candidates:
  1. get_provider_freshness(coinbase, 30m)
  2. get_raw_response_status(coinbase-response-184)
  3. open_data_incident(...), only if policy threshold is exceeded
\`\`\`

This is stateful retrieval. The query should include the current objective, prior successful calls, result summaries, and remaining allowed actions. It should not blindly retrieve from the original user sentence again.

Keep result summaries small and typed. A verbose unstructured tool response consumes the same context budget the catalog is trying to save. MCP output schemas and structured content give tool authors a way to return stable fields and resource links rather than pages of prose.

## Evaluate the whole selector, not a demo

An evaluation set should contain more than happy-path prompts. Build cases from real tool catalogues and known failures.

| Case | Expected outcome |
| --- | --- |
| Direct investigation request | Correct read-only tool and grounded arguments |
| Ambiguous request | Clarifying question or low-risk discovery tool |
| Unsupported request | Abstain without selecting a similar tool |
| One thousand irrelevant tools | Correct candidate remains retrievable under distractors |
| Denied raw-table request | Tool absent from candidates or rejected server-side |
| Stale result | Agent reports freshness limit and chooses an appropriate next action |
| Repeated failed tool call | Loop guard stops identical retries and preserves the failure evidence |

Track these metrics separately:

\`\`\`text
candidate recall@k       was the correct tool in the retrieved set?
tool@1                   did the selector rank it first?
full-call accuracy       was the tool and every argument grounded correctly?
abstention precision     did the system decline when it should?
policy-block rate        were disallowed tools filtered or blocked?
trajectory success       did the sequence reach the correct operational result?
\`\`\`

Candidate recall is the retrieval metric. Tool@1 is the ranking metric. Full-call accuracy is the structured-generation metric. Trajectory success is the agent-system metric. They should not be replaced by one number.

## How to introduce tool retrieval without a rewrite

Start with the unsafe or confusing parts of the existing catalog.

1. Inventory tools and assign each an owner, domain, risk tier, and scope.
2. Remove duplicate or vague tools. A smaller catalog is the cheapest ranking improvement.
3. Rewrite descriptions around intent and boundaries, then add precise input and output schemas.
4. Add policy filtering before the model sees candidates.
5. Retrieve a small candidate set and log the ranking, selected tool, and outcome.
6. Add abstention thresholds before enabling side-effecting tools.
7. Turn production mistakes into regression fixtures.

Do not begin by training a custom retriever. Keyword search with strong tool metadata may be enough for a domain catalog. Add embeddings when paraphrases and synonym-heavy requests prove that lexical retrieval is missing relevant tools. The evaluation set should decide the next investment.

## The durable lesson

Prompt engineering still matters. A clear tool description and a short agent instruction improve every layer of this system. But prompts do not substitute for a catalog, a retriever, a schema, or a policy engine.

An agent with two tools needs good descriptions. An agent with two hundred tools needs retrieval. An agent with access to production systems needs retrieval plus constraints, authorization, and a test suite that includes the moment the correct answer is "do nothing."

## References

- [OpenLocalAgent](https://github.com/SangbumChoi/OpenLocalAgent)
- [OpenLocalAgent tool-calling benchmark and design](https://github.com/SangbumChoi/OpenLocalAgent#reliable-tool-calling-on-your-tools--no-training-required)
- [Needle 2](https://github.com/cactus-compute/needle)
- [Needle tool retrieval API](https://github.com/cactus-compute/needle/blob/main/doc/apis.md#tool-retrieval)
- [Model Context Protocol tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [Right tools, right time: context over capability](/posts/2026-07-06-right-tools-right-time-context-over-capability)
- [Needle 2: a 14MB model for tool calling](/posts/2026-08-25-needle-tiny-tool-calling-model)
`;export{e as default};