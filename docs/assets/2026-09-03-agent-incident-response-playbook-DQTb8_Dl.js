var e=`---
title: "When an AI Agent Makes a Wrong Move: An Incident Response Playbook"
date: 2026-09-03
tags: [ai-agents, incident-response, security, operations, evaluation, governance]
summary: "A practical incident-response playbook for agent failures: contain authority, establish what happened downstream, recover safely, communicate clearly, and convert the event into stronger evaluations and release controls."
series: building-ai-systems
---

# When an AI Agent Makes a Wrong Move: An Incident Response Playbook

An agent incident starts when a model decision becomes business state.

It may be a refund issued to the wrong customer, a production restart triggered from bad evidence, a support case sent to the wrong queue, or a crypto-data correction that changes a report. The model may have been confused by a prompt injection, a stale document, a tool failure, a release regression, or a perfectly ordinary ambiguous request. At that point, debating whether the model was "really at fault" is not the first job.

The first job is to stop additional harm and establish what happened.

Traditional incident response has a useful shape: detect, analyse, contain, eradicate, and recover. Agent systems need the same discipline, with extra attention to tool authority, model and prompt versions, durable task state, and external actions that cannot simply be rolled back.

Use a running scenario. A support agent was released with a retrieval change. A stale policy document is retrieved for a group of outage cases, and the agent issues refunds outside the current eligibility rule. The payment provider has received some requests; others timed out. The team does not yet know how many cases are affected.

## First 15 minutes: contain authority, preserve evidence

Do not start by editing the prompt. Do not delete agent logs to hide sensitive information. Do not immediately retry timed-out requests.

Containment has four separate controls:

\`\`\`text
stop new tasks       pause the workflow trigger or routing flag
stop new actions     deny grants at the action gateway
stop execution       drain or pause agent workers and queues
stop the integration disable the affected payment, deployment, or write tool
\`\`\`

Teams often call all of this a kill switch. It should be several switches. Disabling the agent’s chat interface does not stop a worker that already has a queue message. Disabling a worker does not stop a request that already reached a payment provider. Revoking a short-lived grant blocks a later call but does not answer whether an earlier call completed.

Record the time and owner for each containment action. Preserve the release manifest, task IDs, input snapshots, retrieved documents and chunk IDs, tool-call requests and responses, grants, approvals, idempotency keys, audit receipts, queue offsets, and downstream request IDs. An incident is the worst time to discover that the only evidence was an unstructured chat transcript.

For the refund incident, the immediate decision can be small and decisive: disable \`refund_invoice\` grants for the candidate release, route new cases to the previous release in draft-only mode, and keep read-only case lookup available for human agents.

## Name an incident owner and keep the live state in one place

An agent incident crosses teams quickly. Operations may pause the workflow. Security may investigate a malicious document. Finance owns the payment reconciliation. Support owns customer communication. The agent team owns the release and evaluation evidence.

Assign an incident commander who owns priorities and a live state document. Assign an operations lead as the only person or team applying production changes. Assign a communications owner who updates support, finance, leadership, and affected customers when needed. Google SRE’s incident-management guidance makes the same distinction: a clear incident commander and a limited group making system changes reduce confusion when pressure rises.

The live record should answer these questions continuously:

\`\`\`text
What is the customer or business impact?
Which release, policy, tool, or integration is contained?
When did the first affected task start?
Which actions have definitely completed, definitely failed, or remain unknown?
What is the current recovery decision and next update time?
\`\`\`

Avoid a crowded channel where everyone runs queries and makes changes independently. Investigation can be parallel. Production mutation needs coordination.

## Establish downstream truth before trying to repair it

The agent log says what the system attempted. It does not prove what the downstream system did.

Build an action ledger keyed by the durable business operation, not the model’s text:

| State | Meaning | Safe next step |
| --- | --- | --- |
| \`completed\` | A provider or system returned a durable receipt. | Reconcile eligibility and decide compensation or communication. |
| \`failed\` | The downstream system confirmed no action occurred. | Close the task or send it through the corrected workflow. |
| \`pending_confirmation\` | Timeout or ambiguous response; action may have happened. | Query downstream system using idempotency key or request ID. |
| \`not_attempted\` | Containment prevented the action. | Reprocess only after the release is safe. |

For refunds, query the payment provider by the idempotency key, provider request ID, and invoice. Do not issue a compensating charge while the original request is still unknown. For database changes, compare the expected row version and audit table with the actual table state. For deployments, query the control plane and running workload instead of trusting the agent’s final message.

This is why action gateways and idempotency keys matter before an incident. They give responders a stable way to identify one business action across retries, workers, and external APIs.

## Bound the blast radius with a point-in-time reconstruction

Once new harm is stopped, find every potentially affected task. Start with the release manifest, then work outward:

\`\`\`text
candidate prompt/model/retrieval release
  -> tasks started during the exposure window
  -> retrieved policy version or document chunks
  -> action requests and grant IDs
  -> downstream receipts
  -> affected customers, reports, or services
\`\`\`

Do not search only for the exact error message. A stale policy may have produced plausible-looking outputs with different wording. Query by release ID, retrieval-index version, policy document checksum, tool contract version, and action name.

For the running case, the team learns that 173 cases used the candidate release, 48 requested refunds, 31 provider receipts confirm completion, 7 are pending confirmation, and 10 were stopped by containment. That is the incident scope. "The agent sometimes over-refunded" is not.

Keep the source records immutable while investigating. If a policy document was accidentally replaced, retain the previous version and its retrieval metadata. If a provider payload was malicious or malformed, keep a quarantined copy with access controls. You need enough evidence to reconstruct the decision without re-exposing the bad input broadly.

## Recover by action type, not by a universal rollback button

Agent actions have different recovery properties.

| Action type | Example | Recovery approach |
| --- | --- | --- |
| Reversible internal state | incorrect draft, unsent ticket | revert with an audited compensating update |
| Financial or contractual action | refund, entitlement change | reconcile first; follow business, legal, and customer-support policy before compensation |
| External communication | customer email, alert | correct the record and send a targeted follow-up when appropriate |
| Infrastructure action | restart, deployment, configuration change | restore a known-safe version, then verify service health and data integrity |
| Analytical output | portfolio report, risk alert | mark the output affected, rebuild from trusted inputs, compare, and issue correction or restatement as policy requires |

The recovery process should not ask the same agent to clean up its own incident. Use a controlled workflow with human approval for sensitive compensating actions. In the refund case, finance and support decide whether the business honours the incorrect refund, reverses it where contractually permitted, or treats it as an operational loss. The agent can prepare the case list and evidence; it should not autonomously claw money back from customers.

For a crypto-data incident, a wrong mapping may have changed historical NAV. The recovery job should restore a known mapping version or apply an approved correction, rebuild affected partitions, compare old and new report snapshots, and open a report-impact review. Deleting the bad rows may erase the evidence needed for an audit.

## Fix the triggering path, then prove the fix

Containment is not eradication. A rollback may remove the candidate release, but the underlying issue may remain: a stale policy was eligible for retrieval, a tool accepted a broad action, or the workflow allowed a release to make side effects before shadow comparison.

Use the incident evidence to identify the control that should have stopped the harm:

\`\`\`text
stale retrieval -> document expiry and retrieval-version checks
prompt injection -> untrusted-content boundary and narrow tool authority
bad release -> evaluation case, shadow run, and canary gate
tool contract drift -> schema validation and contract tests
over-broad action -> action gateway policy and lower grant ceiling
ambiguous timeout -> idempotency and pending-confirmation reconciliation
\`\`\`

Patch the smallest root cause that covers the class of failure. A prompt rule may improve behavior, but it should not be the only defense against an expensive external action. Put deterministic enforcement at the tool or action-gateway boundary.

Then replay the affected inputs against the candidate fix with side effects disabled. Add the real incident, including the retrieved stale document and the ambiguous provider responses, to the permanent evaluation set. A fix is incomplete until it fails safely on the case that caused the incident.

## Resume slowly and with tighter authority

Recovery is a new release. Resume in stages:

1. Run the fixed agent against historical and quarantined cases.
2. Start live work in shadow mode with no side effects.
3. Route a low-risk canary in proposal-only mode.
4. Let reviewers compare the candidate with the known-safe release.
5. Re-enable one action type with temporary, narrow grants.
6. Expand only after the stop conditions remain quiet.

Do not turn the agent back on at full authority because the prompt patch looks obvious. The incident has already shown that the system contains hidden assumptions. The tighter canary gives the business a chance to discover the next one cheaply.

## Write a blameless postmortem that changes the system

The postmortem should explain conditions and controls, not invent a villain. "The model hallucinated" is rarely enough. A useful report includes:

\`\`\`text
impact and affected business operations
timeline from release through containment and recovery
release manifest, policy versions, and tool contracts
decision path and retrieved evidence
downstream action ledger and reconciliation result
why existing controls did not stop the incident
corrective actions, owners, and verification dates
new evaluation cases and release gates
\`\`\`

Track corrective actions to completion. "Improve monitoring" has no owner or test. "Alert when a candidate release requests more than five refunds per 15 minutes; page support operations; verify with a simulated burst" does.

Postmortems also protect teams from the wrong lesson. The answer is rarely to remove all autonomy or demand that a human click every read request. The answer is to identify the exact boundary where a safe proposal became an unsafe action, then strengthen that boundary.

## Practice before the first real incident

Run a tabletop exercise. Simulate a prompt-injected ticket, a policy-retrieval regression, a duplicate action retry, and an external API timeout. Make the team use the actual kill switches, action ledger queries, approval interface, and rollback route. Measure time to contain, time to establish downstream truth, and whether anyone had to improvise a critical access path.

AWS incident-response guidance recommends tested playbooks with detection, analysis, containment, eradication, and recovery steps. That advice applies directly to agents. Their failure modes may be new, but customers still experience the familiar result: an incorrect business action that needs a competent, accountable response.

The incident playbook is not evidence that agents are too dangerous to deploy. It is evidence that the agent is part of an operating system. Every system that can act needs a way to stop, inspect, recover, and learn.

## References

- [NIST SP 800-61 Rev. 3: Incident Response Recommendations and Considerations](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
- [AWS: security incident response operations](https://docs.aws.amazon.com/security-ir/latest/userguide/operations.html)
- [OWASP: LLM prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Google SRE: managing incidents](https://sre.google/sre-book/managing-incidents/)
- [Google SRE: blameless postmortem culture](https://sre.google/sre-book/postmortem-culture/)
- [The Agent Action Gateway: The Missing Layer Between an LLM and a Business System](/posts/2026-09-03-agent-action-gateway)
- [How to Roll Out an Agent Change Without Breaking Operations](/posts/2026-09-03-roll-out-agent-change-without-breaking-operations)
`;export{e as default};