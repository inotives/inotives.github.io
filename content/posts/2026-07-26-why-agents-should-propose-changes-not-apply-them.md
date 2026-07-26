---
title: "Why Agents Should Propose Changes, Not Apply Them"
date: 2026-07-26
tags: [ai-agents, mcp, financial-data, audit-trails, data-engineering, compliance]
series: data-engineering
summary: "For financial data, agents should create correction proposals, review tasks, and backfill requests instead of directly mutating source-of-truth tables. The right workflow keeps agents useful without letting them erase evidence."
---

# Why Agents Should Propose Changes, Not Apply Them

An agent can find a bad row faster than a human.

That does not mean it should update the table.

This distinction matters in financial data. A wrong asset mapping, duplicate exchange balance, stale price source, or missing contract address may look like a simple fix. The agent can often identify the likely repair and even write the SQL.

But source-of-truth tables are not scratch space.

If the table feeds reports, audits, regulatory filings, or customer-facing financial numbers, the agent's job should usually be to propose the change, not apply it directly.

The repair should move through a reviewable workflow.

## The agent is good at detection

Agents are useful because they can connect evidence across the project.

They can read quarantine rows, inspect run logs, compare dbt failures, look up the data catalog, and trace a report number back to raw records. That makes them good at finding likely causes:

```text
This report changed because a CoinGecko asset mapping was corrected.
This balance is duplicated in the same exchange export.
This price row was superseded by a provider revision.
This mart is stale because the latest source run failed.
This token cannot enter the mart because its chain ID is missing.
```

That is valuable work.

The mistake is turning that directly into:

```sql
update asset_mappings set canonical_asset_id = ...
delete from raw_provider_records where ...
update portfolio_balances set amount = ...
```

The agent found evidence. It did not become the owner of the financial record.

## Source-of-truth writes need accountability

Financial data changes need an audit trail:

```text
who proposed the change
what evidence supported it
who approved it
what job applied it
which rows changed
which reports were affected
whether an amended report is needed
```

If an agent directly updates a table, that context is easy to lose.

You may still have `updated_at` and `updated_by`, but that is not enough. `updated_by = agent` tells you who executed the update. It does not tell you why the update was acceptable.

A proposal workflow captures intent before mutation.

## Use proposal tables

Start with a small table for correction proposals:

```sql
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
```

The agent can insert here. It cannot directly update `asset_mappings`, `raw_provider_records`, or `regulatory_report_line_items`.

Example proposal:

```sql
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
```

That row is now reviewable. A human, or a stricter controlled job, can approve and apply it.

## Proposal type matters

Do not make every proposal a generic SQL blob.

Use domain-specific proposal types:

```text
asset_mapping_correction
duplicate_balance_decision
provider_price_revision
quarantine_resolution
backfill_request
report_impact_review
soft_delete_request
```

Each type should have allowed fields and allowed actions.

For example, a duplicate exchange balance proposal should not contain arbitrary SQL. It should say:

```json
{
  "duplicate_raw_record_id": 2208,
  "duplicate_of_raw_record_id": 2207,
  "decision_status": "ignored",
  "reason": "duplicate row in same exchange export"
}
```

That is safer than:

```sql
delete from balances where id = 2208;
```

The first records a decision. The second erases context.

## MCP tools should create proposals

This is where MCP fits well.

Instead of exposing a tool like:

```text
run_sql(sql)
```

Expose narrow tools:

```text
create_asset_mapping_proposal(...)
mark_duplicate_balance_proposal(...)
create_backfill_request(...)
open_report_impact_review(...)
resolve_quarantine_proposal(...)
```

The tool can validate inputs, enforce row limits, attach evidence, and write to proposal tables.

Example MCP action:

```text
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
```

The agent has moved the work forward without mutating production facts.

## Applying changes should be a controlled job

Once a proposal is approved, a controlled job can apply it.

That job should:

```text
read the approved proposal
validate the current row still matches expected state
write the correction or versioned row
record applied_by and applied_run_id
trigger affected rebuilds or backfills
open report impact review if needed
```

This prevents stale proposals from applying blindly.

For example, before applying an asset mapping correction, the job should check that the old mapping is still active. If another reviewer already replaced it, the proposal should fail cleanly.

The apply step is still automated. It is just not an unreviewed agent write.

## Backfills need proposals too

Backfills can change a lot of downstream numbers.

Agents are useful for detecting when a backfill is needed:

```text
The CoinGecko mapping changed on July 26.
This affects portfolio reports from July 1 onward.
The affected mart is agent__portfolio_exposure.
The raw data exists and can be replayed.
```

That should become a backfill request:

```sql
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
```

The agent can create the request. A reviewer can approve the blast radius.

That matters because a backfill is not a local edit. It may change historical marts, report snapshots, freshness status, and reconciliation outputs.

## Good refusals are part of the workflow

An agent should refuse to apply direct writes when the table is source-of-truth.

Good refusal:

```text
I should not update asset_mappings directly. I can create an asset_mapping_correction proposal with the evidence and affected rows.
```

Bad refusal:

```text
I cannot help with that.
```

The point is not to make the agent useless. The point is to route the action into a safer workflow.

For financial data, a refusal plus a proposal is often the best answer.

## The practical rule

Let agents inspect broadly inside safe boundaries.

Let agents propose narrowly.

Let controlled workflows apply changes.

For financial data, this usually means:

```text
agents read curated marts, catalog metadata, run logs, lineage, and quality queues
agents create correction proposals, review tasks, and backfill requests
humans or controlled jobs approve and apply source-of-truth changes
every applied change records actor, reason, evidence, run ID, and report impact
```

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
