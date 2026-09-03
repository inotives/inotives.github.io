---
title: "How to Roll Out an Agent Change Without Breaking Operations"
date: 2026-09-03
tags: [ai-agents, evaluation, deployment, observability, operations, ai-engineering]
summary: "A practical release process for agent prompts, models, tools, and workflows: version the change, replay real cases, shadow live traffic, canary by risk, measure safety and business outcomes, and roll back cleanly."
series: building-ai-systems
---

# How to Roll Out an Agent Change Without Breaking Operations

Changing an agent is a production release, even when the diff is one sentence in a system prompt.

That sentence can alter which tool the agent calls, when it escalates a case, how much context it retrieves, or whether it treats an ambiguous record as safe. Replacing a model can change latency, cost, output format, and the cases where the agent becomes overconfident. A new tool can silently expand the agent’s authority.

Treating those changes like casual configuration is how an agent that worked on Monday starts creating the wrong reviews, routing customers to the wrong queue, or burning its token budget on Tuesday.

The release process needs the same ingredients as any other risky operational change: a versioned artifact, a representative test set, a small and observable exposure, clear stop conditions, and a rollback that does not corrupt work already in progress.

Use a running case: a crypto-data operations agent checks each market-data load for stale prices, provider disagreement, and asset-mapping failures. The team wants to change its instructions and classification model so it catches a new provider’s delayed rows. The change sounds small. It can still affect the daily report, review queue, and portfolio numbers that the business sees.

## Define what changed before deciding how to test it

An agent release is a bundle of behavior, not a container image. Record every component that can affect a decision:

```yaml
release_id: market-ops-agent-2026-09-03.2
prompt_version: 9f2c1a
model: reasoning-model-x
reasoning_level: medium
retrieval_index: catalog-2026-09-02
tool_contracts:
  get_price_exceptions: v4
  create_data_review: v2
policy_version: market-ops-v7
workflow_version: daily-load-v11
output_schema: exception-report-v3
```

This manifest is more useful than a release note saying "improved agent accuracy." If a review queue doubles after deployment, the team can compare a real run under the old and new manifests. It also prevents an accidental mixed release where a new prompt expects a field that an old tool does not return.

Make one meaningful change at a time where possible. Updating the model, prompt, tool contract, and routing policy in one deployment leaves no way to tell which change caused a regression. A bundled security patch is sometimes necessary, but it should be treated as higher risk and tested accordingly.

## Start with real cases, not a handful of hand-written prompts

Build a release set from anonymised business cases and label the expected operational outcome. For the market-data agent, include:

- a normal fresh load that should produce no review;
- a genuinely stale price feed;
- a provider disagreement that is within normal tolerance;
- an unresolved asset mapping that must become `REVIEW_REQUIRED`;
- a misleading provider note containing instruction-like text;
- a prior incident where the old agent created a false positive;
- a tool timeout where the correct result is an incomplete report, not a guess.

Score the things the business cares about. A reasonable rubric includes correct exception detection, evidence completeness, safe action selection, escalation quality, valid output schema, and time to completion. A fluent report with the wrong escalation is a failed run.

The test set must have owners. Data stewards label mapping cases. Operations owners label whether a review was useful. Security reviewers contribute adversarial examples. When the only label is "looks good to engineering," the evaluation will reward the wrong behavior.

Keep production cases immutable and versioned. Adding new failures is good; rewriting old expected answers to make a candidate look better is not. OpenAI’s evaluation guidance makes the same general point: use task-specific tests and iterate against them rather than relying on subjective inspection.

## Replay the candidate before sending it live traffic

The first gate is an offline replay. Run the new release and the current release against the same stored inputs, tool fixtures, and policy snapshots. Compare the structured outputs, tool-selection trace, cost, and latency.

For the operations agent, the comparison might be:

```text
old release: provider-x row is fresh, no review
new release: provider-x row is stale, creates review
expected:    stale, but evidence must include provider delay window
```

The new release wins only if it catches the failure and supplies the required evidence. If it creates twenty extra reviews from a benign timestamp format, the change is worse even if one accuracy metric rises.

Replay needs deterministic substitutes for side-effecting tools. `create_data_review` should return a recorded fixture or write to a disposable test queue. Do not run historical cases through the live payment, ticketing, or deployment API because the agent is "only testing."

For data workflows, a production state artifact helps make the test realistic. dbt’s `--defer` mode is one example: selected development models can resolve unbuilt upstream references against a production manifest. It lets a team test a limited change without rebuilding the entire upstream graph, while still requiring care around cross-environment assumptions.

## Shadow mode proves the live integration

Offline replay cannot show every production problem. Tool response shapes drift, permissions differ, queues back up, and live inputs have a strange talent for finding assumptions hidden in fixtures.

In shadow mode, route a copy of eligible live input to the candidate. Let it call read-only tools or recorded mirrors, but prevent external side effects. The current release remains the system of record. The candidate writes its proposed output, selected tools, and would-be action to a shadow log or test queue.

```text
live load -> current agent -> real daily report
          -> candidate agent -> shadow report and comparison record
```

Run shadow mode long enough to cover the input patterns that matter: month-end traffic, provider maintenance windows, quiet days, and high-volume days. Compare results by case type, provider, customer segment, and severity. An aggregate match rate can conceal the exact provider the change was meant to handle.

Shadow mode is also where a team discovers operational regressions: a candidate makes four tool calls where the old one made one, needs a context window that blows the latency budget, or fails because a production identity lacks a permission the test identity had.

## Canary by risk instead of percentage alone

Google SRE describes a canary release as a partial, time-limited deployment whose evaluation decides whether to proceed. That works for agents, but a random 5% of work is not always the right canary.

Choose a low-blast-radius population that still resembles the work you are changing. For the operations agent, start with one low-volume provider and non-critical reports. For a customer-support agent, start with internal-agent drafts or cases that still require human approval. For a deployment agent, start in staging or on a service with a well-practised rollback.

The canary policy might look like this:

```yaml
release: market-ops-agent-2026-09-03.2
eligible_when:
  provider: provider-x
  report_tier: internal
  action_mode: proposal_only
hold_when:
  customer_report: true
  mapping_change_required: true
  confidence: low
expand_when:
  minimum_cases: 100
  false_positive_rate: '<= 3%'
  invalid_output_rate: '0%'
  p95_latency_seconds: '<= 45'
  review_owner_signoff: true
```

Notice that the candidate begins in `proposal_only` mode. A release can prove its detection and reasoning before it is allowed to create real downstream work. This is especially important when a model, tool, or prompt change might alter agent authority.

## Measure safety, quality, operations, and business impact together

One dashboard metric will not decide an agent release. Track four groups.

| Area | Signals to watch |
| --- | --- |
| Safety | policy denials, attempted out-of-scope actions, approval bypass attempts, secrets or sensitive data in output |
| Quality | precision and recall on labelled cases, evidence completeness, escalation correctness, schema-valid outputs |
| Operations | p50 and p95 latency, tool errors, retries, context size, cost per completed case, queue age |
| Business | review acceptance rate, time to resolution, reopened cases, report corrections, operator satisfaction |

Set stop conditions before exposure. "We will roll back if it feels worse" is a promise to debate during an incident. A better rule is: pause expansion if invalid outputs exceed 0.5%, p95 latency exceeds the service level for 30 minutes, or two high-severity false positives appear in a day. The thresholds differ by workflow; deciding them in advance is the important part.

Investigate disagreement as well as outright failures. When the candidate and control agent reach different outcomes, sample and label those cases. The candidate may have found an old blind spot, or it may be inventing one. This comparison is where business-domain reviewers earn their keep.

## Roll back new work without abandoning old work

An agent rollback should route new tasks to the previous manifest. It should not switch a half-completed task from one prompt, model, tool schema, or policy interpretation to another.

Pin the release manifest to each task at creation. Persist the input snapshot, retrieved evidence IDs, tool calls, approvals, and workflow state. A task started under release `.2` either completes under `.2`, resumes under a compatible migration, or is sent to a human review queue. It does not silently continue under `.1` because a feature flag changed overnight.

For side effects, disable the candidate’s action grants first, then route new work away from it. The action gateway should still reconcile requests already in `pending_confirmation`. Rolling back the model does not cancel a payment or deployment API call that may already have reached the downstream system.

Keep the old release runnable until the canary is clearly stable. A rollback path that requires rebuilding an old prompt, finding an older index, or re-enabling a retired tool under pressure is not a rollback path.

## Treat prompts and tool contracts like API versions

An output schema change can break a dashboard or downstream workflow even when the agent is correct. Add fields compatibly, version contract changes, and validate consumers before widening rollout.

The same applies to tool changes. If `get_price_exceptions` changes `observed_at` from an ISO timestamp to a human-readable string, the agent may keep responding confidently while routing records incorrectly. Contract tests should run the old and new agent against the tool response before the tool is deployed.

Prompt changes deserve the same discipline. Review them in pull requests, link them to evaluation results, and give them a version. A system prompt is executable operational policy when it determines escalation, tool selection, or data handling.

## A release checklist that teams can use

Before expanding an agent change, confirm:

```text
release manifest recorded
representative labelled cases pass
side-effecting tools stubbed in replay
shadow comparison reviewed by the business owner
canary population and duration defined
stop conditions and owner defined
action authority remains narrow during the canary
task state is pinned to a release manifest
rollback route tested
audit and operational dashboards available
```

This process is slower than flipping a model name in production. It is much faster than explaining why a model update silently altered customer decisions, financial reports, or production changes for a week.

The goal is not to freeze agent development. It is to make changes routine. When a team can replay, shadow, canary, evaluate, and roll back an agent release with evidence, it can improve the system often without turning every update into an operational gamble.

## References

- [OpenAI: working with evals](https://platform.openai.com/docs/guides/evals)
- [Google SRE: canarying releases](https://sre.google/workbook/canarying-releases/)
- [GitHub: deployment protection rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [dbt: defer to production state](https://docs.getdbt.com/reference/node-selection/defer)
- [The Agent Action Gateway: The Missing Layer Between an LLM and a Business System](/posts/2026-09-03-agent-action-gateway)
