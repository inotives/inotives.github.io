---
title: "The Agent Action Gateway: The Missing Layer Between an LLM and a Business System"
date: 2026-09-03
tags: [ai-agents, security, api-design, authorization, orchestration, ai-engineering]
summary: "Why business agents need an action gateway between the model and sensitive APIs, and how to build one with scoped requests, policy checks, approvals, idempotency, and an audit trail."
series: building-ai-systems
---

# The Agent Action Gateway: The Missing Layer Between an LLM and a Business System

An agent should not call a payment API, production database, or cloud control plane directly. It should ask an action gateway to do it.

That sounds like another box on an architecture diagram. In practice, it is the box that turns a model’s suggestion into a controlled business action. The gateway checks who asked, what they want to do, which exact object they may touch, whether an approval exists, whether the authority is still valid, and whether this is a retry of an action that already happened.

Without it, each tool implementation has to rediscover the same security and reliability problems. The model also ends up holding credentials it should never see. A tool description may say "refund an invoice," but a model is not a policy engine and a prompt is not access control.

This article uses three real business shapes: a support refund, a crypto-data exception, and a production service restart. They need different policies, but the gateway is the same pattern.

## What the gateway owns

The gateway sits between the agent runtime and a sensitive downstream system.

```text
agent -> action request -> action gateway -> payment / cloud / database API
                               |
                               +-> policy decision
                               +-> approval check
                               +-> audit record
                               +-> idempotency store
```

It should own five jobs.

**Authentication.** Identify the calling workload, not merely the end user. `support-agent-prod` and `support-agent-staging` are different principals with different blast radii.

**Object-level authorization.** Check that the requested customer, invoice, repository, service, or data run is in scope. This is where many ordinary APIs fail too. OWASP calls it broken object-level authorization: an API receives an object ID and forgets to confirm that the caller may act on that object.

**Business policy.** Enforce limits that are more specific than an API role: refunds below $25, one production restart, ten review items per run, or no action during a change freeze. The policy belongs in deterministic code or a policy engine, not in the model’s explanation.

**Reliability controls.** Require an idempotency key, persist action state, and reconcile uncertain outcomes. A network timeout cannot tell you whether the payment provider never received the request or processed it just before the connection died.

**Evidence.** Write a record that lets an operator answer: what was requested, why, under which policy and approval, and what actually happened downstream?

The gateway does not need to be a giant authorization platform. For one agent and two actions, it can be a small internal service or a thin layer in an existing backend. What matters is that every sensitive action routes through one enforceable boundary.

## A tool call becomes an action request

Do not pass a free-form instruction from the model to the downstream API. Convert it into a strict request with a schema.

```json
{
  "request_id": "act_01J...",
  "actor": "support-resolution-agent",
  "action": "refund_invoice",
  "resource": {
    "customer_id": "cus_123",
    "invoice_id": "inv_4502"
  },
  "parameters": {
    "amount_minor": 2400,
    "currency": "USD",
    "reason_code": "service_outage"
  },
  "purpose": "case_8421",
  "approval_id": "apr_771",
  "idempotency_key": "case_8421:refund:inv_4502:v1",
  "requested_at": "2026-09-03T10:04:00Z"
}
```

The model can choose from allowed actions and populate validated fields. It cannot invent an endpoint, increase its own refund ceiling, or replace the invoice ID after approval.

The gateway then resolves the identity and evaluates the request against the current policy. A grant from an earlier workflow step may include a short expiry, scope, and maximum amount:

```yaml
grant_id: grant_01J...
actor: support-resolution-agent
action: refund_invoice
resource: invoice/inv_4502
constraints:
  max_amount_minor: 2400
  currency: USD
  case_id: case_8421
expires_at: 2026-09-03T10:15:00Z
policy_version: refund-v12
```

The request must match the grant and the live policy. If either fails, the gateway returns a structured denial. The agent can explain that the case needs review; it cannot negotiate with the gate.

## The decision flow should be boring

Sensitive calls should follow the same sequence every time:

1. Validate the action name and request schema.
2. Authenticate the calling workload.
3. Load the grant, approval, and current policy.
4. Check action, resource, purpose, constraints, expiry, and explicit deny rules.
5. Reserve the idempotency key in durable storage.
6. Call the downstream system with a downstream idempotency key when supported.
7. Store the resulting status and external reference.
8. Return a structured receipt to the agent.

An explicit deny should win over a general allow. AWS IAM uses the same principle when evaluating policies: an explicit deny overrides an allow. This is valuable for agent systems because it gives operators a simple emergency control. A change freeze, compromised-agent flag, or revoked policy version can block an action even when the normal workflow would allow it.

The gateway should treat a missing approval differently from a failed request. `approval_required` is a normal workflow state. `policy_denied` means the request violates a rule. `pending_confirmation` means the downstream system may have acted but the gateway has not confirmed it. Mixing these into one generic error leads to unsafe retries.

## Real-world case 1: a support refund agent

A support agent receives a case about a service outage. It can read the customer’s plan, invoices, entitlement history, outage record, and refund policy. It cannot call the payment provider directly.

It produces a proposal: refund invoice `inv_4502` by $24 because the customer’s paid service was unavailable during a confirmed incident. The action gateway checks that the support workflow owns the case, the invoice belongs to that customer, the amount is within the automatic-refund rule, and the grant has not expired.

For a $24 refund, policy may allow automatic execution. For $250, the gateway returns `approval_required`; a support lead reviews the exact invoice, amount, reason, and evidence. The approval binds to the request ID and request hash. The agent cannot reuse it to refund a different invoice after the reviewer goes offline.

Stripe documents idempotency keys for safe request retries. The gateway should create one from the stable business operation, such as `case_8421:refund:inv_4502:v1`, then retain the final result. A worker retry receives the original provider transaction reference instead of issuing a second refund.

```text
proposal -> policy allows? -> yes -> reserve idempotency key -> provider refund
                       |
                       no
                       v
                 approval_required -> lead decision -> narrowly scoped grant
```

This is more useful than a permanent "refund bot" role. The agent can resolve routine cases quickly while a large, novel, or suspicious request reaches a person with the required evidence already assembled.

## Real-world case 2: crypto-data operations without write access

An operations agent runs after a market-data load. It detects a stale price, a provider disagreement, or a missing canonical asset mapping. The agent needs to help the data steward act quickly, but it should not rewrite production data based on a probabilistic conclusion.

Its gateway exposes three actions:

```text
create_data_review(run_id, exception_ids, evidence)
publish_exception_summary(run_id, summary)
request_mapping_change(asset_candidate, evidence)
```

There is deliberately no `execute_sql` and no `update_raw_price` action. The agent receives a grant for the current load run and can create at most ten reviews. It cannot query another run by guessing an ID, suppress an alert, or modify the canonical mapping table.

When an unknown provider reports `BTC`, the safe agent returns the provider record, exchange context, timestamps, and candidate mappings. A symbol is not a unique identity. The gateway sends the proposal to a mapping-management workflow, where validation checks and a steward approval decide whether to apply a durable change.

The result is a clean division of labour. The agent detects, explains, and queues. A deterministic workflow validates and applies. The data steward owns the decision that changes future reports.

## Real-world case 3: one production restart, not cloud administrator access

During an incident, a coding or operations agent may determine that restarting `quote-api` in production is the fastest safe mitigation. Give it read-only access to logs, metrics, deployment history, and the incident record first.

It proposes:

```json
{
  "action": "restart_service",
  "resource": {"service": "quote-api", "environment": "production"},
  "parameters": {"expected_version": "2026.09.03.4"},
  "purpose": "incident_INC-1042"
}
```

An incident commander approves one restart. The gateway issues a grant for that service, environment, incident, and one invocation, expiring after 15 minutes. It uses a deployment identity with only the permission necessary to restart that service. It does not expose a long-lived cloud administrator credential to the agent process.

GitHub Apps show a similar boundary for repository work. Their installation tokens are time-limited and can be restricted to repositories and permissions granted to the app. An agent that needs to open an issue should have issue access; it does not need repository-administration access because it might someday be useful.

## Reliability: expiry does not undo an action

Permission expiry reduces the opportunity for a stale or compromised run to act. It does not roll back an action already accepted by a downstream system.

The gateway needs a small state machine:

```text
proposed -> approval_required -> approved -> executing
                                        |          |
                                        v          v
                                     denied    completed
                                                   |
                                                   v
                                      pending_confirmation -> completed | failed
```

`pending_confirmation` matters. If a payment or cloud API times out, the gateway must query the downstream system using the idempotency key or external request ID before it retries. Otherwise the safest-looking retry logic can create the duplicate action it was meant to prevent.

Keep action records long enough to support reconciliation and disputes. At minimum store the request, grant ID, policy version, approval ID, input evidence IDs, idempotency key, downstream response or reference, timestamps, and final state. Keep secrets out of that record.

## Build the smallest useful gateway first

Do not begin with a universal policy language or a gateway for every system in the company. Start with one high-value action that currently feels too risky to automate.

For example, build `create_data_review` before building a generic database agent. The first version can use:

- a typed action enum and JSON schema;
- one service identity for the agent;
- a database table for grants, approvals, idempotency keys, and receipts;
- deterministic code for a few business policies;
- a human approval page for exceptional actions.

That is enough to learn what the business actually needs: which actions require approval, how long authority should last, what evidence reviewers need, and where retries occur. Add a dedicated policy engine, message bus, or more granular identities when the number of actions and teams makes the simple version hard to manage.

## Test the gateway against bad timing and bad inputs

Model evaluations should include action-gateway tests. Try requests with the wrong object ID, expired grant, missing approval, modified amount after approval, duplicate idempotency key, changed policy version, malicious tool output, and an ambiguous downstream timeout.

Success means more than the model choosing the right action. The system must deny an out-of-scope action, make the denial legible to the workflow, and leave an audit trail that an operator can inspect. Track denied requests by reason, approvals requested and rejected, duplicate calls prevented, pending confirmations, completed actions later reversed, and action latency.

The gateway gives the business a simple rule: agents can propose anything within their task, but systems act only on requests that satisfy a current, deterministic authority decision. That is the boundary that makes useful autonomy survivable.

## References

- [Stripe: idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [AWS IAM: policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)
- [GitHub: authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [GitHub: choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
- [OWASP API Security Top 10: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
