---
title: "The Checkpoint Is the Real Agent Interface"
date: 2026-08-01
tags: [ai-agents, agent-workflows, state-management, orchestration]
summary: "Agent state describes a run. A checkpoint makes that run recoverable. Durable checkpoints turn retries, reviews, and handoffs into ordinary workflow steps instead of fragile conversations."
series: building-ai-systems
---

# The Checkpoint Is the Real Agent Interface

An agent run feels simple until it stops halfway through. The model hits a rate limit. A reviewer rejects the proposed change. A worker produces a patch, then the next process has no idea why it was made. Someone closes the terminal and expects the run to continue tomorrow.

At that point, a prompt is useless and an in-memory object is gone. What remains is the checkpoint.

I think of a checkpoint as the durable record of a workflow at one decision boundary. It holds the state needed to resume, the evidence needed to judge the last action, and the rule for what may happen next. It is not a backup taken every few seconds. It is a deliberate handoff point.

That distinction matters. A system that saves every token can still be impossible to resume safely. A good checkpoint saves the small amount of information the next worker, reviewer, or human actually needs.

## A run needs a place to land

The useful unit of an agent workflow is not the chat transcript. It is a transition:

```text
planned -> implemented -> reviewed -> accepted
                       \-> returned -> implemented
```

Each arrow changes ownership and expectations. The worker can write code. The reviewer can inspect a bounded diff and return a finding. The planner can decide whether that finding changes the task. A checkpoint records which state the work reached before someone takes the next action.

Without it, a retry often becomes a fresh attempt with stale instructions. The new worker may repeat a failed command, overwrite useful work, or treat a reviewer note as optional context. That is how a short autonomous run becomes a long cleanup job.

## Checkpoint the decision, not the conversation

For a coding workflow, a checkpoint can be a task file plus a few durable artifacts:

```yaml
task_id: task-0042
status: review_required
goal: Add idempotent ticker ingestion
branch: task-0042-idempotent-ingestion
changed_files:
  - src/ingest/tickers.py
  - tests/test_ticker_ingestion.py
verification:
  - command: uv run pytest tests/test_ticker_ingestion.py
    result: passed
review:
  required: true
  notes_file: tasks/task-0042.md
next_action: reviewer_inspect_diff
```

The checkpoint does not need the worker's full chain of thought. It needs the goal, the current state, the files and commands that matter, and the next permitted transition. A reviewer can begin from that record. A replacement worker can resume from it. A human can decide in under a minute whether the run is safe to continue.

This is why plain-language notes matter. A failed test output without context is evidence, but it is not a handoff. Add the root cause that was found, the narrow fix attempted, and the remaining uncertainty. Future work should start from the decision already made, not reconstruct it from logs.

## Checkpoints make retries boring

A retry should not mean "run the agent again." It should mean "move from this known state through this allowed edge."

Take a data-quality workflow. A worker validates a daily price feed and finds duplicate provider records. It writes a checkpoint such as:

```yaml
run_date: 2026-08-01
status: blocked
failure: duplicate provider records for BTC/USDT
evidence:
  query: "select symbol, count(*) from stg_prices group by 1 having count(*) > 1"
  rows: 2
decision: preserve raw records; deduplicate in staging after provider identity check
next_action: inspect_provider_snapshot
```

The next step is specific. It does not delete data because the workflow remembers that raw records are evidence. It does not blindly rerun the same validation. It inspects the provider snapshot, then either confirms the staging rule or returns the issue for a contract change.

That is the practical value of a checkpoint: it turns recovery into normal control flow.

## Human approval belongs at a checkpoint

Human review is often bolted on as a vague instruction: "ask before doing anything risky." That creates a pause with no contract. What counts as risky? What did the agent already change? What information should the reviewer see?

A checkpoint gives approval a real shape. For an irreversible action, the agent should stop with a proposed action, scope, evidence, and a limited set of valid responses.

```yaml
status: awaiting_approval
action: apply production backfill
scope: 2026-07-01 through 2026-07-31
estimated_rows: 1842031
rollback: restore partition from immutable raw snapshot
approval_options: [approve, reject, narrow_scope]
```

The reviewer is not being asked to re-run the investigation. They are being asked to make one decision with the facts already gathered. If they reject it, the workflow records why and returns to a defined state. If they narrow the scope, the agent has a bounded new instruction instead of an ambiguous comment.

## The checkpoint is where observability becomes useful

Logs tell you what happened. A checkpoint tells you what the workflow believes happened and what follows from it. You need both.

Keep large logs, model traces, and raw tool outputs outside the checkpoint. Link to them or attach stable identifiers. Put the conclusion in the checkpoint itself:

```yaml
status: returned
reason: migration passed locally but lacks a rollback plan
evidence_ref: runs/2026-08-01/validation.log
next_action: worker_add_rollback
```

This keeps the operational record small enough to inspect and stable enough to compare across runs. It also makes evaluation less mystical. You can measure how often tasks return from review, which transitions fail, and whether a retry reaches a different state.

## Design checkpoints around ownership

The easiest way to overbuild this is to invent one universal state schema. Do not. Start with the workflow you have and identify where ownership changes:

- planner to worker
- worker to reviewer
- reviewer back to worker
- agent to human before an irreversible action

For each handoff, record only what the recipient must know to act safely. A worker needs the task and accepted constraints. A reviewer needs the diff, verification, and claimed outcome. A human approver needs the impact, scope, and rollback path.

The fields will differ. The rule does not: the checkpoint must be durable, legible, and sufficient to resume without guessing.

## Start with one checkpoint

If an agent workflow currently relies on a long prompt and a terminal session, add one checkpoint after its first meaningful unit of work. Make it a file, database row, or workflow-state record. Include status, evidence, and next action. Then force retries to read it before doing anything else.

That one boundary exposes the missing contracts quickly. You will find steps that cannot explain their output, approvals with no scope, and retries that have no definition of success. Good. Those are workflow problems, not prompt problems.

State is the interface inside an agent system. The checkpoint is the interface between one run and the next person or process that must trust it.

## References

- [From Loop Engineering to Graph Engineering](/posts/graph-engineering-ai-workflows)
- [State Is the Real Agent Interface](/posts/state-is-the-real-agent-interface)
- [LangGraph persistence documentation](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- [Temporal documentation: durable execution](https://docs.temporal.io/encyclopedia/durable-execution)
