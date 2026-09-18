var e=`---
title: "How to Engineer an AI Agent That Works in a Real Business"
date: 2026-09-01
tags: [ai-agents, ai-engineering, llm, orchestration, evaluation, business]
summary: "A practical engineering process for moving an AI agent from a promising demo to a dependable business system: scope, prompts, models, memory, tools, orchestration, interface, and evaluation."
series: building-ai-systems
---

# How to Engineer an AI Agent That Works in a Real Business

An AI agent can look impressive in a demo and still be useless on a Tuesday morning.

The demo has one clean question, a friendly operator, and a forgiving audience. The business version arrives late, receives incomplete data, touches systems with permissions, must explain its work, and has a cost ceiling. Somebody needs to own the result when it is wrong.

That gap is why an agent is not a prompt with a few tools attached. It is a small software product with a workflow, data contracts, authority boundaries, and measurable outcomes.

This is the engineering sequence I would use for a real business agent. The steps overlap in practice, but starting in this order prevents a familiar failure: building an elaborate agent before anyone has agreed on the job it is allowed to do.

To keep the discussion concrete, use a running example: a crypto-market operations agent that prepares a daily exception report. It identifies stale prices, large provider disagreements, and missing asset mappings; opens a review item when the data needs a human decision; and publishes a concise report to the operations team. The same process works for support triage, sales research, finance operations, or internal IT.

## 1. Define purpose and scope before choosing a framework

Start with the business workflow, not the model. Ask four questions.

**What use case is worth automating?** Describe the trigger, the input, the decision or action, and the output. "Monitor data quality" is too vague. "At 08:00 UTC, check the previous day’s market-data load and create review items for unresolved identity, freshness, and price-disagreement exceptions" is a job.

**Who needs the result?** A data steward may need evidence and a row-level review link. A portfolio manager needs a short statement of whether the report is safe to use. Those are different products, even if they share the same analysis.

**What does success mean?** Pick measures that map to the business. For the operations agent, success might mean: 95% of real exceptions appear in the report, fewer than 5% of review items are false alarms, and the report arrives before the team’s daily decision window. "The answer sounds good" is not a metric.

**What constraints are non-negotiable?** Include data access, spending, response time, retention, compliance, approval requirements, and actions the agent must never take. A reporting agent may read the mart and create a ticket but never modify raw market data. A support agent may draft a refund response but cannot issue the refund.

Write this down as a one-page operating contract. It should state the owner, users, trigger, inputs, allowed actions, prohibited actions, expected output, service level, and escalation path. This becomes the reference for every later design decision.

## 2. Design the system prompt as an operating procedure

The system prompt is where the business contract becomes runtime behavior. It is not brand copy for the agent.

Give the agent a clear role and goal, but spend more attention on the procedure. In the running example, a useful prompt says which checks to perform, what evidence to collect, which source wins when two providers disagree, and when to stop and create a review item. It should say that tool output is untrusted input, because external text can contain bad data or instructions that do not belong to the task.

Guardrails work best when they are specific and testable:

\`\`\`text
You may read curated market-data marts and create review items.
You may not write to raw tables, alter schemas, execute arbitrary SQL,
or publish a report when freshness is unknown.

When a canonical asset ID is missing, return REVIEW_REQUIRED with the
provider identifier, observed name, and source record. Do not guess from a symbol.
\`\`\`

The prompt should also define the output schema. A structured report is easier to validate, render, compare across runs, and hand to another system than a page of prose.

\`\`\`json
{
  "run_id": "2026-09-01T08:00:00Z",
  "status": "review_required",
  "exceptions": [
    {
      "type": "stale_price",
      "canonical_asset_id": "bitcoin",
      "evidence": {"observed_at": "2026-09-01T06:15:00Z"},
      "recommended_action": "check provider ingestion"
    }
  ]
}
\`\`\`

Keep instructions versioned in the repository. A production incident often comes down to a prompt change that nobody can reconstruct. Treat a prompt release like code: review it, link it to an evaluation run, and keep a rollback path.

## 3. Choose the LLM for the job, then set its operating limits

There is no universally right model. A real selection has at least four variables: capability, reasoning effort, context capacity, and cost or latency.

Start with a representative task set. Include ordinary cases, ugly edge cases, ambiguous inputs, and cases where the correct action is to refuse or escalate. Run candidate models against the same task set with the same prompt, tools, and output validator. Otherwise you are comparing vibes.

Reasoning level is a product setting, not a badge of intelligence. A simple classification of a support email may need a fast, inexpensive model. Investigating a financial reconciliation exception may justify slower, deeper reasoning. Set a time and token budget for each workflow stage. Do not let an agent spend ten minutes thinking about a task that a human must act on in two.

Context windows deserve the same discipline. More context is not automatically better. Old tickets, irrelevant documents, and a long agent transcript can drown the actual instruction. Retrieve only the case material needed for the decision, label its source and time, and summarize durable facts into a compact state record.

Record a model policy alongside the agent:

\`\`\`yaml
classification:
  model: fast-model
  reasoning: low
  timeout_seconds: 10
investigation:
  model: high-accuracy-model
  reasoning: medium
  timeout_seconds: 90
fallback:
  action: create_review_item
\`\`\`

The fallback is more valuable than pretending every request needs an answer. When a provider is down, the model cannot meet confidence requirements, or the deadline expires, return an explicit incomplete status and route it somewhere accountable.

## 4. Build memory as separate stores with separate jobs

"Add a vector database" is not a memory design.

Working memory is the short-lived state for one run: the request, tool results, decisions, retries, and a compact task summary. It should expire or be attached to the durable task record. This is where you keep the agent from losing the thread halfway through an investigation.

Episodic memory is a history of prior cases and outcomes. For the operations agent, that might include that a particular provider routinely sends delayed data at month-end, plus the review decision made last time. Store the evidence, decision, owner, and timestamp. An episode without provenance becomes folklore.

Vector retrieval is useful for unstructured material: policies, runbooks, resolved tickets, and product documentation. It helps the agent locate relevant text. It is not the source of truth for operational state.

Structured data belongs in a structured database. Task statuses, approval records, canonical asset mappings, permissions, quotas, and review queues need exact queries, constraints, and audit history. Files remain useful for larger artifacts such as source documents, generated reports, and exports. Store their metadata and checksum in the database rather than hoping a filename stays meaningful.

The practical pattern is boring and reliable:

\`\`\`text
working state     -> task record or short-lived store
case history      -> relational database
documents         -> object/file storage + vector index
facts and policy  -> curated database or versioned repository
\`\`\`

Give each retrieved memory a source, timestamp, permission scope, and retention rule. Without those fields, the agent cannot tell a current policy from a stale anecdote.

## 5. Add tools and integrations in order of trust

Tools are where the agent meets the business. They are also where a small mistake becomes a database write, a customer email, or a bill.

Start with the narrowest integration that solves the task. A local function is enough for deterministic work such as validating a date range or calculating a variance. An ordinary API is appropriate when the agent needs a stable service boundary. An MCP server is useful when several agent clients need the same well-described tools, resources, and access policy. A specialist AI agent can be exposed as a tool only when it truly owns a separate workflow and returns a structured, reviewable result.

Do not give an early agent a universal \`execute_sql\` function or an unrestricted shell. Give it \`list_stale_prices\`, \`get_provider_disagreement\`, and \`create_data_review\`. Each tool should have a small input schema, an output schema, authorization checks, idempotency behavior, rate limits, and an audit record.

This is the difference between:

\`\`\`text
agent -> "write whatever you need" -> production database
\`\`\`

and:

\`\`\`text
agent -> create_data_review(exception_id, evidence) -> review queue
\`\`\`

The second design is slower only in the places where a business should be slow.

## 6. Orchestrate a workflow, not a swarm

An agent needs a route through work. Sometimes that is one request and one response. More often it is a workflow with triggers, parameters, durable state, retries, and an owner for exceptions.

For the daily report, the orchestration could be:

\`\`\`text
scheduler -> validate input snapshot -> run checks -> classify exceptions
          -> create reviews where needed -> render report -> notify operations
\`\`\`

Every transition should be observable. Give the run an ID. Persist the input snapshot, model and prompt version, tool calls, output, error, and final status. Then the team can answer a basic operational question: "Why did this report say the ETH feed was late?"

Routes keep behavior simple. A clean input may go directly to a report. A missing mapping goes to a human review queue. A failed provider call retries with bounded backoff, then produces an incomplete report rather than silently fabricating a result. Use a message queue when work can run asynchronously or must survive a worker restart. Use a scheduled trigger for predictable recurring work and an event trigger when an upstream system has already detected a meaningful change.

Agent-to-agent delegation belongs here too, but it should be explicit. The operations agent might send a complex on-chain anomaly to a forensics specialist. It should pass a case schema and receive an artifact with evidence and a status. Do not replace a readable workflow with five agents chatting in a loop.

## 7. Choose an interface that matches the human decision

The interface is part of the control system.

A chat interface is good for exploratory work and follow-up questions. A web application works when a reviewer needs filters, evidence, bulk actions, and an audit trail. An API endpoint fits when another system is the user. Slack or Discord can be effective for notifications and lightweight approvals, but they are poor places to bury a complex case record.

Put the important controls where the user works: show what data the agent used, what it plans to do, its confidence or uncertainty, and the approval action. Link from a Slack alert to the actual review page rather than asking someone to approve a production decision with a thumbs-up emoji.

The daily report agent might publish a short Slack summary with a link to a web review queue. The analyst sees the affected assets, raw observations, the rule that fired, previous resolution history, and clear choices: confirm, suppress with a reason, or escalate. That is a business interface. A chat transcript is not.

## 8. Test and evaluate the whole system

Testing starts before launch and continues after it. Model quality alone is not enough because failures also come from tools, retrieval, orchestration, permissions, and interface handoffs.

Use unit tests for deterministic code: validators, output-schema checks, data transformations, permission rules, and idempotency keys. Test the tools separately from the model. If \`create_data_review\` can create duplicate records on retry, no prompt will save it.

Build an evaluation set from real, anonymised business cases. Include successful runs, ambiguous cases, known bad inputs, adversarial tool output, and examples that should escalate. Score the output against a rubric that the business owner recognises: correct exception detection, evidence completeness, safe action selection, false-positive rate, and usefulness to the reviewer.

Measure operations as well as quality: end-to-end latency, tool failure rate, queue age, cost per completed case, escalation rate, and the percentage of runs that finish with a valid structured output. Slice these metrics by workflow version, model, customer segment, and input source. An average can hide the one provider or user group where the agent fails.

Release changes gradually. Run a new prompt or model in shadow mode against live inputs, compare it with the current version, then send a small percentage of cases through it. Review failures, change one variable at a time, and keep the evidence from every evaluation run.

## The sequence is the product

The common mistake is to start with the cleverest part: the model, the framework, or a multi-agent diagram. Businesses buy outcomes, not agent architecture.

Start with a bounded job and a named owner. Make the prompt an operating procedure. Pick a model with an explicit cost and latency budget. Give it structured memory and narrow tools. Run it through a durable workflow. Put humans in a suitable interface. Measure its work against real cases.

Do that well and the agent becomes another dependable part of the business process. Skip it and you have a demo that keeps needing a human operator to rescue it.

## References

- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [OpenAI: Evaluations guide](https://platform.openai.com/docs/guides/evals)
- [OpenAI: Agent builder](https://platform.openai.com/docs/guides/agents)
- [LangSmith: evaluation concepts](https://docs.smith.langchain.com/evaluation)
`;export{e as default};