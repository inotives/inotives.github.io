var e=`---
title: "Why Agents Should Propose Changes, Not Apply Them"
date: 2026-07-26
tags: [ai-agents, mcp, financial-data, audit-trails, data-engineering, compliance]
series: data-engineering
summary: "For financial data, agents should create correction proposals, review tasks, and backfill requests instead of directly mutating source-of-truth tables. This guide shows the proposal, validation, approval, apply, and reconciliation workflow with a real crypto-data correction."
---

# Why Agents Should Propose Changes, Not Apply Them

An agent can find a bad row faster than a human.

That does not mean it should update the table.

This distinction matters in financial data. A wrong asset mapping, duplicate exchange balance, stale price source, or missing contract address may look like a simple fix. The agent can often identify the likely repair and even write the SQL.

But source-of-truth tables are not scratch space.

If the table feeds reports, audits, regulatory filings, or customer-facing financial numbers, the agent's job should usually be to propose the change, not apply it directly.

The repair should move through a reviewable workflow:

\`\`\`text
detect -> propose -> validate -> approve -> apply -> rebuild -> reconcile
\`\`\`

Each arrow has an owner and a durable record. The agent can do the investigative work quickly. A deterministic process decides whether a source-of-truth change is valid and records the result.

## The agent is good at detection

Agents are useful because they can connect evidence across the project.

They can read quarantine rows, inspect run logs, compare dbt failures, look up the data catalog, and trace a report number back to raw records. That makes them good at finding likely causes:

\`\`\`text
This report changed because a CoinGecko asset mapping was corrected.
This balance is duplicated in the same exchange export.
This price row was superseded by a provider revision.
This mart is stale because the latest source run failed.
This token cannot enter the mart because its chain ID is missing.
\`\`\`

That is valuable work.

The mistake is turning that directly into:

\`\`\`sql
update asset_mappings set canonical_asset_id = ...
delete from raw_provider_records where ...
update portfolio_balances set amount = ...
\`\`\`

The agent found evidence. It did not become the owner of the financial record.

## Source-of-truth writes need accountability

Financial data changes need an audit trail:

\`\`\`text
who proposed the change
what evidence supported it
who approved it
what job applied it
which rows changed
which reports were affected
whether an amended report is needed
\`\`\`

If an agent directly updates a table, that context is easy to lose.

You may still have \`updated_at\` and \`updated_by\`, but that is not enough. \`updated_by = agent\` tells you who executed the update. It does not tell you why the update was acceptable.

A proposal workflow captures intent before mutation.

## Use proposal tables

Start with a small table for correction proposals:

\`\`\`sql
create table data_correction_proposals (
  proposal_id bigserial primary key,
  proposal_type text not null,
  status text not null default 'open',
  severity text not null default 'normal',
  source_system text,
  source_run_id text,
  raw_record_id bigint,
  target_table text not null,
  target_record_id text not null,
  proposed_change jsonb not null,
  evidence jsonb not null default '{}'::jsonb,
  proposed_by text not null default coalesce(current_setting('app.actor', true), current_user),
  proposed_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  applied_by text,
  applied_at timestamptz,
  applied_run_id text
);
\`\`\`

The agent can insert here. It cannot directly update \`asset_mappings\`, \`raw_provider_records\`, or \`regulatory_report_line_items\`.

Example proposal:

\`\`\`sql
insert into data_correction_proposals (
  proposal_type,
  severity,
  source_system,
  source_run_id,
  raw_record_id,
  target_table,
  target_record_id,
  proposed_change,
  evidence
) values (
  'asset_mapping_correction',
  'high',
  'coingecko',
  'run_20260726_0200',
  3011,
  'asset_mappings',
  'mapping_id:42',
  '{"canonical_asset_id":"bridged-usdc-arbitrum","effective_from":"2026-07-26T00:00:00Z"}',
  '{"reason":"provider asset was mapped to native USDC but payload contract address is Arbitrum bridged USDC","affected_rows":184,"affected_reports":["daily_nav_2026_07_26"]}'
);
\`\`\`

That row is now reviewable. A human, or a stricter controlled job, can approve and apply it.

## Proposal type matters

Do not make every proposal a generic SQL blob.

Use domain-specific proposal types:

\`\`\`text
asset_mapping_correction
duplicate_balance_decision
provider_price_revision
quarantine_resolution
backfill_request
report_impact_review
soft_delete_request
\`\`\`

Each type should have allowed fields and allowed actions.

For example, a duplicate exchange balance proposal should not contain arbitrary SQL. It should say:

\`\`\`json
{
  "duplicate_raw_record_id": 2208,
  "duplicate_of_raw_record_id": 2207,
  "decision_status": "ignored",
  "reason": "duplicate row in same exchange export"
}
\`\`\`

That is safer than:

\`\`\`sql
delete from balances where id = 2208;
\`\`\`

The first records a decision. The second erases context.

## A real case: a bridged-asset mapping is wrong

Suppose a provider sends a row labelled \`USDC\`. The agent notices that the contract address belongs to bridged USDC on Arbitrum, while the current mapping points to native USDC. That difference changes supply, venue exposure, and potentially a portfolio report.

The agent should collect evidence before proposing anything:

\`\`\`text
provider record ID and source-run ID
chain ID and contract address
current mapping and mapping version
candidate canonical asset ID
number of affected rows and marts
oldest affected observation time
tests that failed or disagreement found
\`\`\`

It then creates an \`asset_mapping_correction\` proposal. The proposal says the current mapping, requested mapping, effective date, and evidence. It does not say "run this UPDATE." The difference is practical: a reviewer can reject the proposed identity, narrow the effective date, or determine that the provider feed itself is wrong without trying to reconstruct what the agent did.

This is where crypto data exposes a common shortcut. A ticker is not an identifier. \`USDC\`, \`BTC\`, and \`ETH\` appear across chains, wrapped forms, derivatives, venues, and vendor namespaces. An agent can suggest the most likely match; the canonical mapping process must still use the identity fields the business has chosen, such as chain, contract address, provider ID, and venue context.

## MCP tools should create proposals

This is where MCP fits well.

Instead of exposing a tool like:

\`\`\`text
run_sql(sql)
\`\`\`

Expose narrow tools:

\`\`\`text
create_asset_mapping_proposal(...)
mark_duplicate_balance_proposal(...)
create_backfill_request(...)
open_report_impact_review(...)
resolve_quarantine_proposal(...)
\`\`\`

The tool can validate inputs, enforce row limits, attach evidence, and write to proposal tables.

Example MCP action:

\`\`\`text
Tool: create_backfill_request
Input:
  dataset: agent__portfolio_exposure
  start_date: 2026-07-01
  end_date: 2026-07-26
  reason: asset mapping correction for bridged USDC
  evidence: proposal_id 144
Output:
  backfill_request_id: 88
  status: pending_review
\`\`\`

The agent has moved the work forward without mutating production facts.

## Do not give the agent an SQL-shaped escape hatch

\`run_sql(sql)\` looks flexible because one tool can handle every database task. It also makes authorization, validation, audit, and prompt-injection resistance much harder.

An agent that receives an untrusted document, issue comment, or provider payload can be influenced to construct a query outside the original task. Even if it has good intentions, it may target the wrong table or omit a predicate. Parameterized queries reduce injection risk, but they do not solve the business problem of whether the agent should write that row at all.

Keep the write boundary domain-specific. A \`create_asset_mapping_proposal\` function can accept a validated mapping candidate and evidence IDs. It cannot delete a raw record, update every row with a matching symbol, or run a migration. The implementation uses parameterized queries internally and restricts the service database role to proposal and queue tables.

Read access should also be narrow. The agent may need a curated mart, the catalog, test failures, and lineage metadata. It rarely needs unrestricted access to customer records, credentials, raw exports, or the database system catalog.

## Applying changes should be a controlled job

Once a proposal is approved, a controlled job can apply it.

That job should:

\`\`\`text
read the approved proposal
validate the current row still matches expected state
write the correction or versioned row
record applied_by and applied_run_id
trigger affected rebuilds or backfills
open report impact review if needed
\`\`\`

This prevents stale proposals from applying blindly.

For example, before applying an asset mapping correction, the job should check that the old mapping is still active. If another reviewer already replaced it, the proposal should fail cleanly.

The apply step is still automated. It is just not an unreviewed agent write.

The controlled job should use an expected-state check. If proposal \`144\` says mapping \`42\` is currently \`native-usdc\`, the job must confirm that condition before it applies the correction. If another approved change already modified mapping \`42\`, mark the proposal \`stale\` and send it back for review. Never let an old proposal overwrite a newer decision.

For a change that affects several related records, use a database transaction. PostgreSQL transactions group steps so they succeed or fail together; a rollback removes partial work when a validation step fails. The transaction is not the approval mechanism. It is the safety mechanism for the approved apply job.

A simple apply state machine is enough:

\`\`\`text
open -> validated -> approved -> applying -> applied
                  |              |            |
                  v              v            v
               rejected        failed     reconciled
                                  |
                                  v
                               stale
\`\`\`

The apply job should attach its run ID, the old and new versions, and an idempotency key to the proposal. A retry must return the first successful result rather than create a second correction or launch the same backfill twice.

## Backfills need proposals too

Backfills can change a lot of downstream numbers.

Agents are useful for detecting when a backfill is needed:

\`\`\`text
The CoinGecko mapping changed on July 26.
This affects portfolio reports from July 1 onward.
The affected mart is agent__portfolio_exposure.
The raw data exists and can be replayed.
\`\`\`

That should become a backfill request:

\`\`\`sql
create table backfill_requests (
  backfill_request_id bigserial primary key,
  dataset_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review',
  requested_by text not null default coalesce(current_setting('app.actor', true), current_user),
  requested_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  applied_run_id text
);
\`\`\`

The agent can create the request. A reviewer can approve the blast radius.

That matters because a backfill is not a local edit. It may change historical marts, report snapshots, freshness status, and reconciliation outputs.

## Report impact is a separate decision

Correcting data and deciding what to do with a report are related but different actions. A mapping correction may change a historical NAV, tax export, customer statement, or internal risk metric. The apply job should calculate the affected partitions and downstream reports, then open a \`report_impact_review\` when the change crosses a materiality threshold.

For example:

\`\`\`text
mapping proposal 144 applied
  -> rebuild agent__portfolio_exposure from 2026-07-01
  -> compare old and new daily NAV snapshots
  -> delta exceeds reporting threshold on 2026-07-18
  -> open amended-report review with evidence
\`\`\`

That prevents a technically correct correction from silently rewriting a number that a customer, auditor, or regulator has already seen.

## Good refusals are part of the workflow

An agent should refuse to apply direct writes when the table is source-of-truth.

Good refusal:

\`\`\`text
I should not update asset_mappings directly. I can create an asset_mapping_correction proposal with the evidence and affected rows.
\`\`\`

Bad refusal:

\`\`\`text
I cannot help with that.
\`\`\`

The point is not to make the agent useless. The point is to route the action into a safer workflow.

For financial data, a refusal plus a proposal is often the best answer.

## Test the workflow and the proposal text

The evaluation set should include cases where the agent identifies the wrong asset, a proposal uses an out-of-date row version, a reviewer rejects the correction, a backfill fails halfway through, or a duplicate retry arrives after the change was applied. The expected result is a safe workflow state and an audit record, not a confident paragraph from the agent.

Test deterministic parts with ordinary checks:

\`\`\`text
proposal schema rejects an unknown proposal type
agent service role cannot update source-of-truth tables
apply job rejects a stale expected state
approved proposal creates one correction on repeated delivery
dbt tests pass before a rebuild is marked complete
report-impact review opens when a threshold is exceeded
\`\`\`

dbt tests are useful early checks for identity, uniqueness, accepted values, and relationships. They do not replace review or business policy, but they give the controlled workflow concrete conditions to verify before it promotes a correction.

## The practical rule

Let agents inspect broadly inside safe boundaries.

Let agents propose narrowly.

Let controlled workflows apply changes.

For financial data, this usually means:

\`\`\`text
agents read curated marts, catalog metadata, run logs, lineage, and quality queues
agents create correction proposals, review tasks, and backfill requests
humans or controlled jobs approve and apply source-of-truth changes
every applied change records actor, reason, evidence, run ID, and report impact
\`\`\`

That gives you most of the agent productivity without handing the agent a write path to the evidence layer.

Fast fixes are nice.

Explainable fixes are better.

## References

- [MCP Is Becoming the API Layer for Internal Data](/posts/2026-07-24-mcp-api-layer-internal-data)
- [Auditable Database Design for Financial Data](/posts/2026-07-25-auditable-database-design-financial-data)
- [Immutable Raw Tables for Financial Pipelines](/posts/2026-07-25-immutable-raw-tables-financial-pipelines)
- [Corrections Are Not Deletions](/posts/2026-07-26-corrections-are-not-deletions)
- [The Data Quality Review Queue](/posts/2026-07-23-data-quality-review-queue)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
- [dbt: add data tests to your DAG](https://docs.getdbt.com/docs/build/data-tests)
- [PostgreSQL: transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [OWASP: query parameterization](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html)
`;export{e as default};