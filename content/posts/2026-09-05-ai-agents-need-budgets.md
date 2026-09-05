---
title: "AI Agents Need Budgets, Not Just Rate Limits"
date: 2026-09-05
tags: [ai-agents, cost-control, observability, orchestration, reliability, ai-engineering]
summary: "Rate limits protect shared services; per-task budgets protect a business case from runaway reasoning, retrieval, tool retries, latency, and cost. This guide shows how to set and operate those limits."
series: building-ai-systems
---

# AI Agents Need Budgets, Not Just Rate Limits

An agent can fail while looking busy.

It retrieves another document, asks the model to reconsider, calls the same API after a timeout, expands the context, and tries a different tool. Each step seems reasonable. Together they can turn a routine business case into a ten-minute, ten-dollar investigation that still ends with no reliable answer.

Rate limits do not solve that problem. A rate limit says how much traffic a shared system accepts over time. It protects the model provider, database, or API from too many requests across all callers. A budget says how much one case may consume before the workflow takes a safe, explicit next step.

For business agents, every task needs both.

Use a crypto-data operations agent as the running example. It examines a daily market-data load for stale prices, provider disagreement, and missing asset mappings. A normal run should finish in seconds. An ambiguous token mapping can trigger retrieval from the catalog, several provider calls, chain metadata lookup, and repeated reasoning. The system needs to stop that investigation before it consumes the daily operations window, then give a data steward a useful handoff.

## Rate limits protect the platform; budgets protect the case

These controls operate at different levels:

| Control | Question it answers | Example |
| --- | --- | --- |
| Rate limit | How much traffic may this client send to a shared service? | 60 MCP tool calls per minute per agent service |
| Concurrency limit | How many tasks may run at once? | 10 investigations across the operations queue |
| Per-task budget | How much may this one task consume before it stops? | 30 seconds, 2 model calls, 6 tool calls, $0.05 |
| Organisation spend limit | How much may the whole team spend in a period? | $2,000 of inference spend per day |

The first two prevent a noisy agent from overwhelming infrastructure. The last one is finance control. The per-task budget prevents a single unusual input from monopolising attention and cost.

Do not replace one with another. A team can stay beneath every API rate limit while thousands of agent cases each run longer than they should. It can also give every task a $1 budget and still overload a database by running a thousand of them concurrently.

## Set five budgets for every business workflow

The exact numbers depend on the business deadline and risk. The categories are stable.

**Elapsed time.** How long can this task run before the result arrives too late to matter? A support-routing answer may have a 10-second target. A compliance investigation can wait several minutes. Set an absolute deadline, not merely a timeout around one model call.

**Inference budget.** Cap model calls, input and output tokens, and money. Model usage may be metered after a request completes, so reserve a conservative allowance before an expensive step and record actual usage afterward. Do not rely on a vague instruction such as "be concise."

**Context and retrieval budget.** Limit retrieved documents, excerpts, bytes, and tool-result size. Context is both a cost and a quality limit. An agent that pulls in twenty partly relevant policy documents is less likely to find the one current rule that decides the case.

**Tool-call and retry budget.** Limit total calls, calls by tool, and retries per error class. A 429 or transient connection reset can justify a bounded retry with backoff. A 400 validation error, a denied permission, or a missing canonical identifier needs a workflow decision, not five more calls.

**Workflow-depth budget.** Limit planner iterations, sub-agent delegation, and queue hops. A task that sends itself between a research agent, validator, and planner without producing new evidence is a loop with more nouns.

Put the policy in versioned configuration alongside the workflow:

```yaml
routine_exception:
  max_elapsed_seconds: 30
  max_model_calls: 2
  max_input_tokens: 12000
  max_output_tokens: 1500
  max_tool_calls: 6
  max_retries_per_tool: 1
  max_retrieval_items: 8
  max_context_chars: 24000
  max_cost_usd: 0.05
  on_exhaustion: publish_incomplete_report

high_risk_investigation:
  max_elapsed_seconds: 180
  max_model_calls: 6
  max_tool_calls: 20
  max_retries_per_tool: 2
  max_retrieval_items: 20
  max_cost_usd: 1.00
  on_exhaustion: create_review_item
```

The policy is a product decision. A $1 investigation may be excellent value for a high-severity reconciliation exception and absurd for classifying a routine support email.

## Decide the terminal state before the agent starts

"Stop when the budget is exhausted" is incomplete. The workflow needs to tell the user what stopping means.

Good terminal states are structured and useful:

```text
complete              evidence meets the rule and output is valid
review_required       a human must resolve an ambiguity or approve an action
incomplete_evidence   a deadline or budget ended investigation before confidence was sufficient
retry_later           a transient dependency failed within a bounded retry policy
blocked               access, input, or policy prevents further progress
```

For the market-data agent, exhausting the mapping-investigation budget should create a review item with the provider ID, chain, contract address, attempted sources, evidence collected, and the reason the budget ended. "I ran out of tokens" is an internal diagnostic, not a handoff.

The agent should not quietly start a new task with a fresh budget. A new budget needs an explicit event: a human request, a material new data arrival, or a scheduled retry after the dependency recovers. Otherwise the system has reinvented an infinite loop with an accounting reset.

## The budget controller belongs outside the model

Put a deterministic controller around the agent runtime. It owns a task ledger and checks every call before it happens.

```text
task starts
  -> load budget policy and reserve task ID
  -> before model call: check time, calls, token/cost allowance
  -> before tool call: check total, per-tool, retry, and deadline allowance
  -> after each result: record actual usage and evidence gained
  -> on limit: cancel pending work and emit the configured terminal state
```

The model may choose a tool from its allowed set. It must not decide that this is an exceptional case deserving another five calls. The controller can allow an approved escalation path, but the policy should make that path explicit.

Record budget use in the task state:

```json
{
  "task_id": "load_2026_09_05_0800:exception:42",
  "budget_policy": "routine_exception:v3",
  "elapsed_ms": 18240,
  "model_calls": 2,
  "tool_calls": {
    "get_price_exception": 1,
    "get_asset_mapping": 1,
    "search_catalog": 2
  },
  "retrieval_items": 6,
  "cost_usd": 0.031,
  "terminal_state": "review_required"
}
```

This record makes budget exhaustion diagnosable. The team can see whether an agent spent its allowance on useful evidence, a slow provider, a bad retrieval query, or a planner loop.

## Real-world case 1: support triage should not become a research project

A customer-support agent receives an email asking why an invoice changed. Its first job is classification and routing, not an open-ended billing investigation.

Give the routing task a small budget: one fast model call, two account lookups, one invoice lookup, and ten seconds. If the email clearly matches a known billing issue, the agent creates the right support case with evidence. If the invoice data is inconsistent, it creates `review_required` for billing operations rather than repeatedly querying the CRM and policy store.

The escalation can receive a larger, separately authorised budget. That distinction protects both speed and quality. A customer sees a prompt acknowledgement; a specialist gets a structured case rather than an agent that delayed the queue while chasing certainty it could not reach.

## Real-world case 2: crypto-data ambiguity needs an evidence budget

An operations agent sees `USDC` from a provider it has not processed before. It finds an address, but the chain is unclear and the catalog has two plausible mappings. More context will not necessarily resolve the identity.

The agent may spend its investigation budget on one provider metadata call, one chain registry lookup, and a bounded catalog search. If those sources disagree, it stops. The review item includes the conflicting candidate IDs and the raw source record. It does not guess because a generic symbol is familiar.

This keeps the agent useful without turning a data-quality workflow into a costly attempt to infer identity from weak evidence. It also makes the budget a data-governance control: it prevents the system from converting uncertainty into an arbitrary correction after enough retries.

## Real-world case 3: incident triage has a deadline budget

During a production incident, an agent can inspect logs, metrics, recent deployments, and the incident record. Time is more important than token efficiency, but the task still needs a ceiling.

Set a 90-second investigation deadline and a small number of parallel read-only queries. At the limit, the agent produces an incident brief: hypotheses, evidence, failed checks, and what a human should inspect next. It must not continue consuming resources while operators wait for a recommendation.

If the agent requests a restart or rollback, that action travels through a separate approval and action-gateway workflow. The investigation budget never grants production authority.

## Budget exhaustion is a signal, not an embarrassment

Teams often treat an exhausted budget as an agent failure. Sometimes it is a healthy outcome: the system has correctly identified that the task is too ambiguous, expensive, or slow for automation.

Track it by task type and cause:

| Metric | What it reveals |
| --- | --- |
| Budget exhaustion rate | Workflows that are undersized, too ambiguous, or looping |
| Cost per completed case | Whether increased reasoning produces business value |
| Cost per useful resolution | Whether the agent merely finishes or actually helps |
| Tool retries per case | Flaky dependencies or poor error classification |
| Context consumed per outcome | Retrieval quality and prompt discipline |
| Escalation acceptance rate | Whether budget-limited handoffs contain enough evidence |

High exhaustion in a new workflow may mean the budget is too small. It may also mean the agent is being asked to solve a problem that needs a better data model, a missing API, or human judgement. Increase a limit only after looking at the task ledger and review outcomes.

## Change budgets through the same release process as models

Raising a budget can change behavior as materially as choosing a stronger model. More tool calls may create more queue items. A longer timeout may breach a customer-service target. A larger context limit may increase cost and reduce accuracy by introducing irrelevant instructions.

Version budget policies, replay them against historical cases, and canary them. The candidate should show why extra spend improves the business metric that justified it. If a $0.20 increase reduces unresolved high-severity data exceptions by half, that may be a good trade. If it only turns `review_required` into longer prose, it is not.

## The practical rule

Every agent task should know its deadline, maximum useful effort, and safe ending state before the first model call.

Rate limits keep shared systems available. Budgets keep individual cases bounded. Together they make agent behavior predictable enough for a real business: the system either completes a defined job, hands off evidence, or stops cleanly. It does not keep spending because the model has another idea.

## References

- [OpenAI: rate limits](https://platform.openai.com/docs/guides/rate-limits)
- [AWS Builders' Library: timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Google SRE: error budget policy](https://sre.google/workbook/error-budget-policy/)
- [How to Roll Out an Agent Change Without Breaking Operations](/posts/2026-09-03-roll-out-agent-change-without-breaking-operations)
- [When an AI Agent Makes a Wrong Move: An Incident Response Playbook](/posts/2026-09-03-agent-incident-response-playbook)
