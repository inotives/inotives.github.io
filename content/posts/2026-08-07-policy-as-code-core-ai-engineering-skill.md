---
title: "Policy as Code Will Be the Core Skill of AI Engineering"
date: 2026-08-07
tags: [ai-agents, policy-as-code, engineering, agent-workflows]
summary: "As agents write more implementation code, engineers will spend more time designing the harness around that work: executable authority, verification, workflow transitions, data boundaries, and approval gates. Policy as code is how those rules stay inspectable and enforceable."
series: building-ai-systems
---

# Policy as Code Will Be the Core Skill of AI Engineering

AI will not make software engineering disappear. It will make a different part of engineering impossible to ignore.

When an agent can write a feature, refactor a module, run a migration, or query an internal data mart, the hard question shifts from "Can it produce code?" to "Under which rules may it act, and how do we know it followed them?"

The answer is a harness. The durable part of that harness is policy as code.

Policy as code is not a compliance document pasted into a prompt. It is an executable description of authority, boundaries, verification, and escalation. It tells an agent which files it may touch, which tools it may call, what evidence it must produce, and when a human must decide.

That work will become a larger share of an engineer's job because agents make action cheap. A good policy keeps consequence expensive enough to inspect.

## The feature is no longer the whole unit of work

In a conventional workflow, an engineer writes the feature and a reviewer inspects the result. The process is imperfect, but the engineer's actions are bounded by their own terminal, credentials, and attention.

An agent changes the scale. It can try several approaches in an hour, call tools across systems, and continue while nobody is watching. A vague instruction such as "be careful with production" has no useful meaning at that speed.

The unit of engineering becomes:

```text
goal + allowed authority + required evidence + stop conditions
```

The implementation is one output of that unit. The harness decides whether the implementation is allowed to exist in the first place.

## Prompts explain; policy decides

A system prompt can tell an agent to use read-only data, run tests, and ask before a production change. It cannot enforce those rules once the agent has a general database client and a broad shell tool.

Put the decision in code and workflow state instead:

```yaml
policy: crypto-mart-analysis
principal: market-data-reader
allow:
  tools: [get_market_snapshot, list_mart_metrics]
  schemas: [mart]
  operations: [read]
limits:
  max_range_days: 31
  max_calls_per_minute: 60
deny:
  tools: [execute_sql, write_raw_table, apply_migration]
requires_approval:
  - publish_external_report
  - override_reconciled_price
```

The agent can receive the policy in context, but the important part is that the MCP server, gateway, or action runner enforces it. A tool call that exceeds the date range or targets a raw table fails regardless of how persuasive the agent's explanation sounds.

This is a better security boundary and a better engineering interface. The policy is reviewable in a pull request, testable in CI, and changeable without rewriting every prompt.

## A harness is a set of executable contracts

"Harness" can sound abstract. In practice, it is a small set of contracts around an agent:

```text
Authority contract:    which tools, data, files, and environments are allowed
Workflow contract:     which status transitions are allowed
Evidence contract:     which commands, artifacts, and results prove completion
Review contract:       when work is accepted, returned, or escalated
Memory contract:       what durable knowledge may guide the next run
```

Each contract is policy as code when a system can check it.

For example, a worker should not set a task to review merely because it says the test passed. The transition itself can require a command and result:

```yaml
transition: in_progress -> review
requires:
  - changed_files
  - verification_command
  - verification_exit_code: 0
  - implementation_note
forbid:
  - direct_status_edit_without_evidence
```

That makes a common quality rule mechanically inspectable. A reviewer can still use judgment, but it no longer has to reconstruct whether the worker ran anything.

## The future engineer designs the decision boundaries

Engineers have always designed interfaces. Agents move the important interfaces closer to authority.

The question is no longer only "What parameters does this function accept?" It is also:

- What inputs can cause this agent to act?
- Which outputs are evidence and which ones grant authority?
- What action is reversible, and what action needs approval?
- What must be preserved for a retry or reviewer handoff?
- Which rule belongs in a prompt, and which must be enforced by a tool?

Consider a provider schema change in a crypto pipeline. An agent can detect the missing field and draft a contract update. It should not decide that a renamed field means the same thing, replay history, and publish corrected reports on its own.

```yaml
goal: Assess ticker schema drift
allow:
  - inspect_raw_payload_samples
  - compare_against_provider_contract
  - draft_test_fixtures
deny:
  - modify_published_marts
  - delete_raw_payloads
requires_human_review:
  - approve_changed_field_semantics
  - approve_replay_window
```

The engineer who wrote this policy has done more than constrain an agent. They have encoded the domain boundary between an observable source change and a financial correction.

## Policy needs tests like any other code

A policy file that nobody exercises is documentation with a stricter syntax. Test it against the actions you expect to allow and deny.

```text
given a market-data reader
when it requests mart prices for the last 7 days
then allow

given the same reader
when it requests a raw provider table
then deny

given a worker with a completed migration
when it requests production execution without approval
then stop at approval_required
```

These tests belong beside agent evaluation environments. A reusable environment can test the repository change and the policy boundary at the same time. The agent should succeed at a permitted task, fail safely at a forbidden one, and leave enough evidence for a reviewer to understand both outcomes.

This is how policy avoids becoming a source of random friction. It has a clear intended behavior and a regression suite.

## Policy should be narrow, not universal

The first response to AI risk is often a huge global policy. It becomes unreadable, blocks routine work, and invites exceptions.

Prefer small policies that follow real authority boundaries:

```text
research agent:      web and document reads; no repository writes
coding worker:       scoped repository writes; focused test commands
reviewer:            diff and verification access; no production writes
data analyst:        mart-only reads; bounded query ranges
release agent:       prepares artifacts; human approval before publishing
```

This maps cleanly to the roles in AgentRig and to narrow MCP tools. Each role has less ambient authority, and each policy has fewer conditions to reason about at 3 a.m.

Do not build a general policy language when a YAML file, a database permission, or a function signature can express the rule. The goal is enforceable boundaries, not a new platform.

## Memory becomes policy input, not policy authority

Agent memory is valuable because it can preserve a provider contract, a past review return, or a deployment runbook. It should inform an action without being able to grant that action.

A trusted, current runbook can tell an agent which verification command to run. The action runner still decides whether the command is allowed in the current environment. A deprecated note can explain history. It should not silently override today's production policy.

This is why agent memory needs provenance, freshness, and verification signals. The system should know whether a note is a draft, a human-reviewed instruction, or an old record. Policy consumes that context; it does not outsource authority to it.

## The engineering job gets more operational

Writing harnesses does not mean engineers stop designing systems or writing implementation code. It means more of the high-leverage work happens at the places where code meets consequence:

- designing small tools instead of broad shell access;
- writing acceptance checks instead of trusting completion messages;
- defining task transitions instead of relying on conversational handoffs;
- encoding data contracts and correction rules instead of fixing dashboards later;
- building approval paths that are specific enough for a human to decide quickly.

These are engineering problems. They involve domain knowledge, failure modes, tradeoffs, and judgment. Better models reduce the cost of implementation. They do not remove the need to decide what the system is permitted to do.

## Start with the riskiest action

Pick one action an agent can take today that would be painful to undo. Make its authority explicit. Move the rule out of the prompt and into the tool, workflow, or database boundary that actually controls it. Add one allowed case and one denied case to a test.

That is policy as code in its useful form. It is also the kind of harness work that compounds as agents become more capable.

## References

- [Stop Chasing Models, Start Building Harnesses](/posts/stop-chasing-models-start-building-harnesses)
- [Tool Output Is Untrusted Input](/posts/tool-output-is-untrusted-input)
- [Agent Evaluation Needs Reusable Environments, Not Another Benchmark](/posts/agent-evaluation-reusable-environments)
- [MCP's Stateless Core Changes How We Build Agent-Safe Data Servers](/posts/mcp-stateless-core-agent-safe-data-servers)
- [OKF v0.2 Gives Agent Memory a Trust Layer](/posts/okf-v02-agent-memory-trust-layer)
