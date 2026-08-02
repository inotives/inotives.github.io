---
title: "A Review Return Needs a Schema"
date: 2026-08-02
tags: [ai-agents, code-review, agent-workflows, quality-assurance]
summary: "A reviewer return should be a structured handoff, not a vague rejection. A small schema for evidence, root cause, fix direction, and next action lets workers recover without replaying the whole run."
series: building-ai-systems
---

# A Review Return Needs a Schema

The weakest part of many agent workflows is the sentence that sends work back: "This looks wrong. Please fix it."

That sentence works poorly for people. For an agent, it is a reset button with a polite label. The next worker has to infer what failed, reproduce the reviewer's concern, decide whether the problem is real, and guess how broad the fix should be. It may change the wrong file because the return never named the boundary.

Review should create a new piece of work, not a cloud of disapproval. That means a return needs a schema.

## A return is a handoff

When a reviewer accepts a change, the workflow can move forward. When they return it, the workflow needs the same clarity. The return must say what was inspected, what failed, why it failed, and what a worker may do next.

This is not bureaucratic metadata. It is the interface between two nodes in a workflow.

```text
worker -> review_required -> reviewer
                             |
                             +-> accepted -> done
                             |
                             +-> returned -> worker
```

The worker should not need the reviewer's private reasoning to continue. It needs an actionable contract.

## The smallest useful schema

A review return can live in a task file, issue comment, or database row. The storage choice matters less than the fields:

```yaml
status: returned
finding: Duplicate tickers are still inserted on a retry
reproduction:
  - Run the ingestion job twice with the same provider snapshot
  - Query the raw ticker table by provider record ID
root_cause: The insert path has no conflict target for provider record ID
affected_files:
  - src/ingest/tickers.py
required_fix: Make the shared insert idempotent; do not deduplicate after writing raw records
verification:
  - Add a test that ingests the same snapshot twice
  - Confirm the raw table keeps one row per provider record ID
next_action: worker_fix_and_verify
```

That is enough. It names the observed failure, leaves a reproducible trail, and avoids prescribing an invented implementation. The reviewer says where the system is wrong and what must be true afterward. The worker chooses the smallest fix that satisfies it.

## Separate evidence from the conclusion

"The migration is unsafe" is a conclusion. A reviewer needs to attach the evidence that led there.

For example:

```yaml
status: returned
finding: Migration cannot be rolled back after column removal
evidence:
  command: npm run db:migrate:down
  result: "column source_payload does not exist"
root_cause: The down migration recreates an index before restoring its column
required_fix: Restore the column before recreating the index
verification:
  - Run migration up
  - Run migration down
  - Run migration up again
next_action: worker_fix_and_verify
```

The command output may be long. Put it in a log or an artifact and link to it. The return should contain the result that matters. A future worker needs to know that the rollback path was executed and failed because of ordering, not scroll through a terminal dump.

This separation also keeps reviewers honest. If a finding has no evidence, it may be a preference or a hunch. Those can still be useful, but they should not masquerade as a failed acceptance condition.

## Root cause prevents whack-a-mole fixes

Agent workers are especially likely to patch the line named in a review comment. It is fast, visible, and often wrong.

Suppose a reviewer finds that an API request times out in one command path. A shallow return says:

```yaml
finding: The export command times out
required_fix: Add a timeout guard to export.py
```

That sends the worker toward a local patch. The real question is whether every caller uses the same request helper. If they do, the review return should say so:

```yaml
root_cause: The shared request helper has no timeout or retry policy
affected_files:
  - src/client/request.py
required_fix: Add the guard in the shared helper and verify the export and sync callers
```

The second return is shorter in the long run. One change fixes every caller, and the verification proves that the reviewer did not merely move the failure.

## Do not turn the return into a design document

There is a trap here. Once teams add structured returns, they start asking reviewers to fill in every field for every change. Soon the return contains implementation alternatives, severity scores, architecture notes, and a postmortem for a typo.

Keep the schema proportional to the risk.

For a simple defect, a finding, affected file, and runnable verification can be enough:

```yaml
status: returned
finding: Empty symbols are accepted by the parser
affected_files: [src/parse/symbols.py]
required_fix: Reject empty symbols before normalization
verification: [uv run pytest tests/test_symbols.py]
next_action: worker_fix_and_verify
```

Reserve root-cause analysis and explicit rollback requirements for failures that cross a shared boundary, change data, or could recur in a sibling path. The goal is a useful handoff, not a review ritual.

## Returns should make evaluation possible

Unstructured feedback is hard to learn from. You can count rejected tasks, but you cannot tell whether the workers misunderstand requirements, skip tests, or break shared contracts.

Structured returns create a small dataset. Over a few weeks, you can group findings by cause:

- missing verification
- incorrect data contract assumption
- shared helper regression
- scope drift

If most returns are missing verification, improve the worker's completion rule. If returns cluster around the same contract, write the contract down or add a test at the boundary. The point is not to score reviewers. It is to remove recurring work from the system.

## Start with returned work that already hurts

Pick one task that was sent back recently. Rewrite the return using five fields: finding, evidence, root cause when known, required fix, and verification. Then give that version to a new worker.

If the worker still needs to ask what to do, the return is incomplete. If it can act safely without reopening the entire investigation, the schema is doing its job.

Checkpoints make an agent run recoverable. Review returns make the recovery directed. Together, they turn a review loop from an expensive conversation into a controlled transition.

## References

- [The Checkpoint Is the Real Agent Interface](/posts/checkpoints-are-the-real-agent-interface)
- [Agent-Rig: Filesystem-First Multi-Agent Workspaces That Actually Catch Bugs](/posts/agent-rig-filesystem-first-multi-agent-workspaces)
- [The Data Quality Review Queue](/posts/data-quality-review-queue)
- [Google Engineering Practices: Code Review Developer Guide](https://google.github.io/eng-practices/review/developer/)
