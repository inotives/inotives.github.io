---
title: "State Is the Real Agent Interface"
date: 2026-07-30
tags: [ai, agents, state, langgraph, workflows, graph-engineering]
series: building-ai-systems
summary: "Prompts, tools, and models matter, but state is the interface that lets an agent workflow survive retries, handoffs, review, and recovery. Scalable AI systems need typed state, small node contracts, durable checkpoints, and clear rules for what each step may read and write."
---

# State Is the Real Agent Interface

People talk about prompts as the agent interface.

That is only partly true.

Prompts tell an agent how to behave. Tools tell it what it can do. The model gives it reasoning power.

State is what lets the workflow hold together.

In a serious agent system, state carries:

```text
the user request
the current task
the facts already gathered
the tools already called
the draft output
the validation result
the approval status
the error history
the final decision
```

Without state, every step has to reconstruct what happened from chat history, logs, or prompt stuffing. That works for demos. It breaks when the workflow gets long, branches, pauses, retries, or hands work to another agent.

Graph engineering makes this obvious. In a graph workflow, nodes do work and edges choose the next step. But nodes need a shared object to read from and write to.

That object is the real interface.

## Why state matters more than prompts

A prompt is a request.

State is the working record.

Example:

```text
Prompt: "Investigate why the BTC volume report changed yesterday."
```

The agent still needs structured state:

```text
metric_name: daily_exchange_volume_usd
asset_id: btc
report_date: 2026-07-29
freshness_status: fresh
tables_used: marts.daily_exchange_volume
query_id: ch_query_123
possible_drivers: venue mix, asset price effect, missing source
validation_status: passed
answer_status: draft
```

If that information only lives in a message transcript, every later step has to parse it again. The reviewer agent might miss the freshness status. The final writer might forget the metric definition. A retry might query a different table.

State makes the workflow explicit.

## What good agent state looks like

Good state is typed, small, and inspectable.

Bad state:

```text
messages: huge conversation transcript
scratchpad: random notes
context: pasted logs and half-written SQL
```

Better state:

```yaml
request:
  user_id: "u_123"
  text: "Why did BTC volume drop yesterday?"
  received_at: "2026-07-30T09:00:00Z"

task:
  type: "metric_investigation"
  status: "in_progress"
  risk_level: "read_only"

metric:
  name: "daily_exchange_volume_usd"
  entity_filters:
    asset_id: "btc"
  time_window:
    start: "2026-07-29"
    end: "2026-07-29"

evidence:
  queries: []
  sources: []
  freshness_status: null

output:
  draft: null
  validation_status: null
  final: null
```

This is easier to debug than a 40-message transcript. Each node can update only the fields it owns.

## Node contracts

The cleaner the state, the simpler the node contracts.

Example graph:

```text
classify_request
-> resolve_metric
-> check_freshness
-> query_metric
-> analyze_change
-> validate_answer
-> final_response
```

Each node has a clear input and output.

`resolve_metric` reads:

```text
request.text
task.type
```

It writes:

```text
metric.name
metric.definition
metric.allowed_dimensions
```

`check_freshness` reads:

```text
metric.name
metric.time_window
```

It writes:

```text
evidence.freshness_status
evidence.data_cutoff_at
```

`query_metric` reads:

```text
metric.name
metric.entity_filters
metric.time_window
```

It writes:

```text
evidence.queries
evidence.sources
evidence.rows
```

This is what makes the workflow maintainable. A node is not a vague "agent step." It is a function over state.

LangGraph's `StateGraph` makes this model explicit: nodes read a shared state and return partial updates to that state. You can build the same discipline without LangGraph, but the concept is the important part.

## Example: coding agent state

A coding agent should not hold everything in a prompt.

Its state should track the real workflow:

```yaml
request:
  text: "Fix the failing freshness test."
  repo: "felts"

repo_context:
  branch: "task-0042"
  files_read:
    - "models/marts/schema.yml"
    - "models/staging/coingecko/stg_coingecko__prices.sql"
  relevant_symbols: []

diagnosis:
  failing_command: "dbt test --select freshness"
  error_summary: "source freshness uses ingested_at but loader writes loaded_at"
  root_cause: null

changes:
  files_modified: []
  patch_summary: null

verification:
  commands_run: []
  status: "not_started"
```

Now each step can be controlled:

```text
inspect repo
diagnose failure
edit file
run test
summarize result
```

If the agent crashes after editing but before testing, the state tells the next run what happened. If a reviewer asks why a file changed, the state has the diagnosis and command history.

That is much better than hoping the transcript is complete.

## Example: data quality review state

For crypto data quality, state should carry the decision trail.

Example:

```yaml
review_task:
  id: "dq_2026_07_30_001"
  reason: "missing_asset_mapping"
  severity: "critical"
  source: "binance_balances"
  run_id: "run_2026_07_30_080000"

affected_data:
  provider_asset_id: "ETH"
  canonical_asset_id: null
  account_id: "acct_42"
  report_date: "2026-07-30"
  row_count: 12

proposal:
  action: "create_mapping"
  canonical_asset_id: "eth"
  confidence: "high"
  evidence:
    - "provider symbol ETH"
    - "exchange asset metadata"
    - "existing canonical asset eth"

approval:
  status: "pending"
  reviewer: null
  approved_at: null
```

The agent can propose a correction. It should not silently apply it.

State makes the boundary clear:

```text
agent writes proposal
human writes approval
pipeline writes correction run result
```

The interface is not "the agent said it was ETH." The interface is a structured proposal with evidence and approval fields.

## Example: human checkpoint state

Human-in-the-loop workflows need durable state.

Bad pattern:

```text
agent waits in memory for someone to approve
process dies
approval is lost
workflow restarts from scratch
```

Better pattern:

```yaml
approval:
  required: true
  reason: "will publish corrected NAV report"
  status: "waiting"
  requested_at: "2026-07-30T10:12:00Z"
  reviewer_group: "finance_data_review"
  approved_by: null
  approved_at: null
```

The workflow can pause. Later, a human updates the approval state. The graph resumes from the checkpoint.

This is why persistence matters. LangGraph's persistence model stores checkpoints of graph state, which can support interrupts, replay, and recovery. The same idea applies even if you build your own runtime: pause and resume should use durable state, not a sleeping process.

## State is not memory

Memory and state overlap, but they are not the same thing.

Memory is long-lived context:

```text
project decisions
user preferences
schema conventions
past incidents
known caveats
```

State is the current workflow record:

```text
current request
current step
current evidence
current output
current approval
```

Mixing them creates problems.

If every workflow loads all memory into state, the state becomes huge and stale. If every temporary workflow note becomes memory, the system learns junk.

Keep the split:

```text
memory informs the run
state records the run
logs audit the run
```

## Reducers and concurrent updates

As workflows get more complex, multiple nodes may write to the same state field.

Example:

```text
research_agent writes evidence.sources
sql_agent writes evidence.queries
review_agent writes validation.findings
```

If each update overwrites the field, evidence disappears.

Use append-style fields for accumulations:

```yaml
evidence:
  sources: []
  queries: []
  tool_calls: []
  warnings: []
```

Use overwrite fields for single truth values:

```yaml
task:
  status: "in_progress"

output:
  final: null
```

LangGraph calls these merge rules reducers: each state key can define how updates are combined. The lesson is general. Decide which fields append, which fields overwrite, and which fields require review.

## What should not go in state

State should not become a warehouse for everything.

Avoid storing:

```text
large raw logs
full source files
entire database query results
secret values
unbounded message history
temporary debug noise
PII that the workflow does not need
```

Store references instead:

```text
log_id
query_id
file_path
artifact_path
run_id
dashboard_url
```

This keeps state cheap, inspectable, and safe.

If a node needs a large artifact, it can load it by reference. The state should say what artifact was used, not carry the whole artifact forever.

## State makes evals easier

Evals are easier when outputs are structured.

Instead of judging a final answer only, evaluate each state transition:

```text
Did classify_request choose the right task type?
Did resolve_metric pick the approved metric?
Did check_freshness block stale data?
Did query_metric use the required time filter?
Did validate_answer catch missing provenance?
```

Each node can have its own eval because each node has clear input and output state.

That is hard to do when the system is a single prompt loop with one big transcript.

## State makes handoffs real

Multi-agent workflows fail when handoff is only prose.

Bad handoff:

```text
"I looked into it and it seems fine."
```

Good handoff state:

```yaml
handoff:
  from_agent: "data_analyst"
  to_agent: "reviewer"
  reason: "answer ready for validation"
  evidence_ids:
    - "query_ch_123"
    - "freshness_check_456"
  open_questions: []
  risk_level: "read_only"
```

The reviewer agent does not need to parse a rambling summary. It reads the state contract.

This is how planner, worker, reviewer, and publisher agents can cooperate without sharing one giant prompt.

## A practical state design checklist

Before building an agent workflow, define:

```text
request fields
task fields
evidence fields
tool result references
approval fields
output fields
error fields
ownership of each field
merge rules for repeated updates
checkpoint boundaries
retention rules
```

Then ask:

```text
Can a human inspect this state?
Can another agent resume from it?
Can we replay from a checkpoint?
Can we see who approved a risky step?
Can we delete or expire sensitive fields?
```

If the answer is no, the workflow is not production-shaped yet.

## The rule

Prompts are instructions.

Tools are capabilities.

State is the interface.

It is what nodes read. It is what nodes write. It is what gets checkpointed, reviewed, resumed, replayed, and audited.

Scalable agent systems do not rely on one giant prompt remembering everything. They use small nodes, explicit state, durable checkpoints, and clear contracts for what changes at each step.

That is why state is the real agent interface.

## References

- [LangGraph StateGraph reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph reducers](https://langchain-ai.github.io/langgraph/how-tos/state-reducers/)
- [Building LangGraph: Designing an Agent Runtime from first principles](https://www.langchain.com/blog/building-langgraph)
- [LlamaIndex workflow events](https://docs.llamaindex.ai/en/latest/api_reference/workflow/events/)
- [From Loop Engineering to Graph Engineering](/posts/2026-07-30-graph-engineering-ai-workflows)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Why Agents Should Propose Changes, Not Apply Them](/posts/2026-07-26-why-agents-should-propose-changes-not-apply-them)
