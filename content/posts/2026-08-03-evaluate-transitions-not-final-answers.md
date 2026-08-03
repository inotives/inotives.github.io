---
title: "Evaluate Workflow Transitions, Not Final Answers"
date: 2026-08-03
tags: [ai-agents, evaluation, agent-workflows, agent-rig]
summary: "Final-answer scoring misses how an agent workflow actually behaves. Evaluate the transitions between planning, work, review, returns, and approval to find the loops, missing evidence, and handoffs that create operational risk."
series: building-ai-systems
---

# Evaluate Workflow Transitions, Not Final Answers

An agent finishes a coding task. The diff looks plausible. The final message says tests passed. A conventional evaluation marks the run successful.

Then the reviewer finds a missing migration rollback. Or the worker changed the right line but left a sibling caller broken. Or the task sat in review because the loop could not tell what to do next.

The answer was not the whole system. It was one output at the end of a sequence.

For agent workflows, evaluate the transitions as well as the final result. A transition is a state change with an owner and an acceptance condition: planned to ready, ready to in progress, in progress to review, review to accepted, or review back to work. Those changes tell you whether the system is making reliable progress.

## A final answer hides the route taken

Two runs can produce the same patch and have very different operational quality.

```text
Run A: plan -> worker -> review -> accepted
Run B: plan -> worker -> review -> returned -> worker -> review -> accepted
```

Run B is not automatically bad. A reviewer return may be exactly what caught a real defect. But if the same return happens on every task because the worker never runs the relevant test, the final acceptance rate conceals a broken completion rule.

Final-answer evaluation asks, "Did this end in the right place?" Transition evaluation asks, "What did it take to get there, and can we trust that path next time?"

## Treat task status as observable behavior

AgentRig's task lifecycle gives this a concrete shape. A task file holds the goal, dependencies, status, notes, and verification evidence. The planner creates it, a worker claims it, and a reviewer accepts or returns it.

That means the status history is not administrative clutter. It is an evaluation trace.

```yaml
task_id: task-0042
transitions:
  - from: ready
    to: in_progress
    actor: worker
  - from: in_progress
    to: review
    actor: worker
    evidence: uv run pytest tests/test_ticker_ingestion.py
  - from: review
    to: returned
    actor: reviewer
    reason: shared insert path was not tested
  - from: returned
    to: review
    actor: worker
    evidence: retry test added and passed
  - from: review
    to: accepted
    actor: reviewer
```

You do not need model judges to see a pattern in this record. If tasks reach review without evidence, the worker contract is weak. If reviewers return work without a reproducible finding, the review contract is weak. If `returned -> review` repeats many times, the task scope or the return is probably ambiguous.

## Start with four transition questions

Keep the first evaluation set small. For each task, ask:

1. Did every required transition happen?
2. Did the transition carry the evidence the next owner needed?
3. Did a return converge to acceptance within a reasonable number of passes?
4. Did a human gate occur before an irreversible action?

These questions cover the behavior that causes the expensive failures: skipped review, unverifiable completion, endless rework, and autonomous actions taken at the wrong boundary.

They also avoid a common trap in agent evaluation. A model can write a convincing explanation of a passing test. It cannot make a missing test command become evidence.

## Define transition contracts before scoring them

An evaluation is only as useful as the contract behind it. Do not score a worker for failing to provide information the task never required.

For a normal code task, a simple contract might be:

```yaml
transition: in_progress -> review
requires:
  - changed_files
  - verification_command
  - verification_result
  - concise implementation note
reject_if:
  - task status changed without verification
  - claimed result is broader than the changed files support
```

For a data task, the evidence might include a live ingestion run, a dbt test, and a direct mart inspection. The contract should name those pieces up front. A reviewer then checks the task against a stable boundary instead of relying on memory or taste.

## Returns are labeled failure data

Structured review returns are more valuable than a generic pass or fail. They explain which transition failed and why.

```yaml
status: returned
category: incomplete_verification
finding: The migration succeeds forward but has no tested rollback path
required_fix: Add and run the down-migration verification
next_action: worker_fix_and_verify
```

Over time, categories make the workflow diagnosable. You may find that most returns are `incomplete_verification`, `scope_drift`, or `shared_boundary_regression`. Each pattern points to a different fix:

- incomplete verification: strengthen the worker's done condition;
- scope drift: improve planning or task boundaries;
- shared boundary regression: require callers to be checked around a shared helper.

This is more useful than asking whether the reviewer was "strict." The return is a small, labeled example of work the system did not yet complete safely.

## Measure convergence, not raw speed

It is tempting to optimize for tasks closed per hour. That can reward workers that mark work ready for review early and push the cost onto reviewers.

Track a few measures together:

- first-pass review acceptance rate;
- median review passes before acceptance;
- return category by task type;
- time spent waiting at a human gate;
- tasks stopped by a loop or budget guardrail.

Read them as a system. A high first-pass rate with no review evidence may mean review is superficial. A lower first-pass rate can be healthy if the first review catches real defects and returns converge quickly. The goal is safe progress with predictable cost, not a flattering dashboard.

## Test the graph with deliberately awkward tasks

Happy-path tasks are poor evaluation cases. Use a small set that forces important transitions:

```text
1. A task with a dependency that is not ready.
2. A change that passes a unit test but breaks a sibling caller.
3. A data backfill that needs live proof before review.
4. A production action that must stop for approval.
```

These tests reveal whether the graph can block unsafe work, record a useful return, and resume from a checkpoint. They are closer to the situations that make a real agent loop costly.

The set should remain small and versioned. When a production failure appears, add a task shape that would have caught it. Remove cases that no longer distinguish a good run from a bad one.

## Use model judges carefully

Model-based evaluation has a place. It can help judge whether a planning note is clear, whether a review finding is specific, or whether a handoff contains enough context. It should not be the sole authority for transitions with objective proof.

If a task claims a database migration works, run the migration. If it claims a test passed, record the command and exit result. If it claims an approval happened, keep the approval record.

Use a model judge for the parts that require interpretation. Use deterministic checks for the parts that can fail plainly.

## Begin with one transition

Pick the highest-risk transition in your current workflow. For many coding agents, it is `in_progress -> review`. Define the evidence required there, collect it for ten tasks, and group reviewer returns by category.

You will learn more from those ten transitions than from a hundred polished final messages. The workflow's weak point will show up where evidence goes missing, work bounces, or a status change has no trustworthy reason.

Good agent systems do not merely produce answers. They leave a trail of permitted, verifiable progress.

## References

- [AgentRig](https://github.com/inotives/agent-rig)
- [A Review Return Needs a Schema](/posts/a-review-return-needs-a-schema)
- [Multi-Agent Graph Engineering Is a Workflow, Not a Swarm](/posts/multi-agent-graph-engineering-agent-rig)
- [The Checkpoint Is the Real Agent Interface](/posts/checkpoints-are-the-real-agent-interface)
- [Scalable Agentic Systems: Seven Loop Types, Layered Guardrails, and When Humans Should Pull the Plug](/posts/scalable-agentic-systems-loop-prevention)
