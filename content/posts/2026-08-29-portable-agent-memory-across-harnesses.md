---
title: "One Memory Core, Many Agent Harnesses: What Portability Actually Requires"
date: 2026-08-29
tags: [ai-agents, agent-memory, mcp, evaluation, developer-tools]
summary: "A shared MCP server is a useful starting point for portable agent memory, but it is not enough. This article designs one memory core with thin adapters for Codex, Claude Code, and OpenCode, covering context injection, lifecycle triggers, isolation, permissions, evidence, and black-box evaluation."
series: building-ai-systems
---

An agent team rarely uses one harness forever. A developer may use Codex locally, another may use Claude Code, and a repository may standardise on OpenCode. If each harness grows its own memory implementation, the team soon has three incompatible stores, three different consolidation jobs, and three ways for old context to become unreliable.

The tempting answer is "use MCP." That is necessary, but incomplete. MCP gives the model a common way to call `recall` and `remember`. It does not tell a harness when to retrieve context, how to observe a tool result, what happens before compaction, where to run background consolidation, or how to isolate one evaluation run from the next.

Portable memory needs one core and small harness adapters. The core owns memory semantics. Each adapter translates the harness's lifecycle into a small set of core operations.

## Start with the boundary, not the database

The first decision is what the memory core promises. Keep it independent of a particular agent, model, or event format.

```text
memory core
  - append source evidence
  - retrieve bounded evidence for a query and scope
  - consolidate eligible evidence into durable memory
  - correct, expire, or revoke memory
  - expose provenance, policy decision, and diagnostics
```

The core should not know whether a request arrived through a Codex hook, a Claude Code plugin, or an OpenCode event. It should receive an explicit contract instead:

```json
{
  "store_id": "project-felts/run-2026-08-29-01",
  "scope": {
    "repository": "inotives/felts",
    "agent_role": "data-investigator",
    "user_id": "operator-17"
  },
  "query": "Why did the BTC/USDT provider disagreement alert fire?",
  "budget": {
    "max_items": 6,
    "max_tokens": 1200
  }
}
```

`store_id` is not incidental plumbing. It is the isolation boundary. A production workspace, a personal sandbox, a pull-request review, and an evaluation run should not read or write the same memory merely because they share a repository name.

## MCP for the model, a CLI for operations

The model needs typed, discoverable tools. A human and an adapter need inspectable operational commands. One core should therefore expose both surfaces.

| Consumer | Surface | Why it exists |
| --- | --- | --- |
| Model during a turn | MCP tools such as `recall`, `remember`, and `get_memory_item` | Typed schema, permission boundary, visible tool calls |
| Hook or adapter | CLI or local API such as `memory consolidate` | Lifecycle jobs should not require the model to invoke shell commands |
| Developer or operator | CLI such as `memory query`, `memory stats`, and `memory doctor` | Debugging, recovery, and inspection |
| Evaluation runner | Fresh store path plus harness command | The runner tests the integration as a user experiences it |

Avoid giving the model a general `bash` instruction that happens to call a memory CLI. That requires shell permission, has no tool schema, and makes the model responsible for invoking a maintenance command correctly. The MCP server is the in-loop capability; the CLI is the operational surface around it.

## Define memory operations before adapters

A small operation set keeps adapters thin.

```text
recall(query, scope, budget) -> evidence[]
remember(observation, source, scope) -> receipt
consolidate(store_id, boundary) -> report
correct(memory_id, replacement, reason) -> receipt
revoke(memory_id, reason) -> receipt
status(store_id) -> health and counts
```

Each returned evidence item needs more than text:

```json
{
  "memory_id": "mem_01J...",
  "content": "Price investigations must query the documented mart, not raw provider tables.",
  "kind": "policy",
  "source": {
    "type": "decision-record",
    "uri": "docs/decisions/price-investigation.md",
    "revision": "a91c7d2"
  },
  "scope": "repository:inotives/felts",
  "created_at": "2026-08-17T10:00:00Z",
  "expires_at": null,
  "confidence": 0.96
}
```

This is where a memory system becomes auditable. A retrieval result without source, scope, and revision is an attractive sentence with no way to check whether it is still true.

## MCP is the common floor, not the complete integration

Codex, Claude Code, and OpenCode can all connect MCP servers. That lets the same `recall` and `remember` schemas appear in each tool list. It is the strongest common capability and should carry the critical path.

```text
agent prompt
  -> model calls recall through MCP when it needs durable context
  -> core returns bounded, scoped evidence
  -> model calls documented domain tools
  -> adapter observes work and sends eligible evidence to remember
```

The portability trap is forced prompt injection. One harness may permit a plugin to alter system context before every model call. Another may only allow context at user-prompt time. Another may have a pre-compaction event but no reliable session-end hook. A design that depends on the richest hook available will work beautifully in one harness and quietly degrade in the others.

Make model-pulled retrieval the baseline. Let richer adapters add well-labelled context injection as an optimisation, not a condition for correctness.

## The adapters have different jobs

An adapter should contain configuration plus small translation logic. It should not reimplement ranking, summarisation, persistence, retention, or access control.

| Concern | Codex adapter | Claude Code adapter | OpenCode adapter |
| --- | --- | --- | --- |
| Register memory tools | Configure the shared MCP server | Bundle or configure the same MCP server | Configure MCP or register tools through a plugin |
| Retrieve context | Prompt-time hook or explicit model `recall` | Prompt-time hook or explicit model `recall` | Explicit `recall`; plugin can additionally transform system context per turn |
| Observe useful work | Hook or transcript-derived adapter event | Tool and lifecycle hooks | Plugin events for tools, messages, sessions, and compaction |
| Consolidate | Turn-stop and pre-compaction baseline | Stop, compaction, and session lifecycle hooks | Event-driven task, idle, or compaction triggers |
| Enforce scope | Harness permissions plus core scope checks | Harness permissions plus core scope checks | Per-agent and per-tool permissions plus core scope checks |
| Drive evaluations | Non-interactive run with a fresh store | Headless prompt run with a fresh store | JSON run or server session with a fresh store |

Codex's official customization surfaces include MCP, hooks, skills, plugins, project guidance, and configuration. Claude Code exposes MCP, hooks, and plugin packaging. OpenCode offers MCP and a TypeScript plugin system with message, tool, session, and compaction events, as well as per-agent permissions. The available detail differs, so the adapter must target the common lifecycle floor and use richer hooks only as optional improvements.

## Retrieval: remember less, return less

Memory systems often fail because they have two unbounded flows: every interaction is stored, then too much context is returned. Portability will not repair either problem.

Use an explicit admission policy for `remember`:

- retain source-backed decisions, constraints, and stable preferences;
- retain reusable procedures only after they have a clear outcome;
- retain a short incident summary with links to raw evidence;
- reject transient model speculation, credentials, and unreviewed assumptions;
- attach an expiry or review date to facts likely to change.

Use an explicit retrieval budget for `recall`. The core can use lexical search, embeddings, a knowledge graph, or a hybrid ranker, but its output should be a small evidence packet. A 1,200-token packet with six source links is usually more useful than a twenty-thousand-token transcript dump.

This is where Strata Memory and agent-harness memory can meet. Strata's draft, knowledge, and intelligence tiers provide a good curation lifecycle. A portable memory core can retrieve approved Strata knowledge as evidence while keeping raw drafts and private notes outside an agent's default scope.

## Consolidation needs a safe lifecycle

Some memory systems call background consolidation "dreaming." The name is less important than the trigger and the evidence boundary.

The safe baseline is:

```text
turn completes or context compacts
  -> adapter records candidate observations
  -> core consolidates asynchronously
  -> core emits proposed memory with source references
  -> policy accepts automatically, queues review, or rejects it
```

Run consolidation outside the model's active tool loop. A failed summarisation job should not keep a coding task alive, and a background job must not inherit broad write permissions from the agent that triggered it.

Do not depend on a true "session ended" event. Interactive terminals close unexpectedly, background agents can be interrupted, and harnesses expose different lifecycle signals. A turn-complete and pre-compaction trigger are the portable minimum. If a harness offers a reliable final session event, its adapter can add a last consolidation pass.

Idempotency matters here. Give each observation a stable ID, record the source event range, and make `consolidate` safe to rerun. Otherwise a retry after a crash turns one incident conclusion into five nearly identical memories.

## Permissions belong in two places

A harness can control whether a model may invoke a memory tool. The memory core must separately control whether that invocation can access or change a particular store.

```text
harness permission: may this agent call memory.recall?
        +
core authorization: may this scoped identity read this item?
        =
effective access
```

Both checks are needed. A read-only code-review agent might be allowed to call `recall` but only against repository-wide architecture notes. It should not retrieve another engineer's private draft, write new long-term preferences, or run a destructive retention command.

Treat memory write operations as risk tiers:

| Operation | Typical policy |
| --- | --- |
| Recall approved repository knowledge | Allow |
| Record an immutable source observation | Allow with scope and redaction checks |
| Promote an inferred preference or procedure | Queue review or require high-confidence evidence |
| Change shared policy memory | Ask for approval |
| Revoke or delete durable memory | Ask, log reason, preserve a tombstone where appropriate |

The tool schema should make the risky choice visible. `remember(text)` is too vague. `propose_memory(content, kind, source_refs, scope, retention)` gives a policy engine something concrete to validate.

## Isolation is a product feature

Use a distinct store for each environment and evaluation run:

```text
memory/prod/felts
memory/staging/felts
memory/local/alice/felts
memory/eval/codex/price-disagreement/v3/run-0042
```

Do not share a production memory store with a benchmark. An evaluation should start from a known fixture, run the actual harness integration, and leave behind a trace that can be inspected. A store path or store ID passed through configuration is simple and works across harnesses.

It also makes rollback practical. If a new memory-consolidation policy degrades outcomes, compare it against a prior store snapshot or fixture rather than trying to untangle changes inside a shared global history.

## Evaluate the whole integration as a black box

Unit tests for the retriever are useful, but they do not prove that a harness actually uses memory correctly. The evaluator should not import the core and force a private `consolidate()` method. It should interact through the same harness command, MCP tools, hooks, and store configuration that a real user receives.

For each harness, run a scenario such as this:

1. Start with a clean, fixture-backed store.
2. Ask the agent to investigate an exchange-price disagreement.
3. Verify that it calls `recall` or receives a documented injected context.
4. Verify it queries the approved `get_price_disagreement` tool instead of raw tables.
5. Interrupt the run after a tool result, resume it, and inspect the trace.
6. Run a second task that requires the approved policy and verify correct retrieval.
7. Test a denied scope, a stale memory item, and a malformed tool result.

Track more than final-answer quality:

| Metric | What it catches |
| --- | --- |
| Retrieval precision and source coverage | Relevant memory without unsupported claims |
| Scope-denial rate | Cross-user or cross-project leakage |
| Tool trajectory correctness | Whether retrieved policy changes the actual action |
| Context budget | Memory that overwhelms the task prompt |
| Consolidation duplication | Retry and lifecycle bugs |
| Resume behaviour | Lost or contradictory state after interruption |
| Cost and latency | A memory layer that is too slow or expensive to keep enabled |

The comparison must remain fair. Use the same task fixtures, tool schemas, core version, and store isolation for Codex, Claude Code, and OpenCode. Harnesses will not have identical prompt rendering or token accounting, so report those differences rather than hiding them behind a single aggregate score.

## A practical rollout

Build the portable floor first.

1. Implement a core with one store contract, typed MCP `recall` and `remember`, and a CLI for operations.
2. Add `store_id`, scope, source references, retention, and token budgets before adding a vector database.
3. Build one adapter for the harness the team already uses daily.
4. Create black-box fixtures and prove isolation, denial, retry, and resume behaviour.
5. Add the second adapter using only the common contract.
6. Add richer per-harness injection or lifecycle features only after the shared path is stable.

This order avoids an expensive mistake: a sophisticated memory engine that only works because one harness happened to offer a convenient hook.

## The durable lesson

Memory portability is not a protocol problem alone. It is a lifecycle and governance problem.

MCP can give every model the same `recall` and `remember` tools. A portable core supplies stable memory semantics, provenance, budgets, isolation, and correction. Adapters convert each harness's events and permissions into those semantics. Evaluation proves that the full system behaves correctly when a turn is interrupted, a tool fails, or a memory item should not be visible.

That is the useful division of labour: one core owns what memory means; each harness adapter owns when that meaning meets a particular agent loop.

## References

- [Cross-harness memory integration research](https://github.com/kenhuangus/agent-memory-harness/blob/main/docs/harnesses/01-cross-harness-comparison.md)
- [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers)
- [OpenCode plugin documentation](https://opencode.ai/docs/plugins)
- [OpenCode agent documentation](https://opencode.ai/docs/agents)
- [OpenAI Codex manual: Model Context Protocol](https://developers.openai.com/codex/concepts/customization/mcp/)
- [OpenAI Codex manual: hooks](https://developers.openai.com/codex/config-advanced/#hooks)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [Claude Code hooks documentation](https://code.claude.com/docs/en/hooks)
- [Claude Code plugins documentation](https://code.claude.com/docs/en/plugins)
- [Strata Memory](https://github.com/inotives/strata-memory)
- [TencentDB Agent Memory and Strata Memory comparison](/posts/2026-08-26-tencentdb-agent-memory-vs-strata-memory)
