var e=`---
title: "Corrections Are Not Deletions"
date: 2026-07-26
tags: [financial-data, data-engineering, audit-trails, crypto, postgres, compliance]
series: data-engineering
summary: "Financial pipelines need to distinguish corrected facts, superseded rows, provider revisions, quarantined rows, soft deletes, and true deletions. Treating every problem as a delete destroys the audit trail."
---

# Corrections Are Not Deletions

Bad financial data should not all go through the same door.

A revised provider price is not the same thing as a duplicate exchange balance. A wrong asset mapping is not the same thing as a delisted token. A quarantined row is not the same thing as a deleted row. A regulatory correction is not the same thing as a hard delete.

When a pipeline treats all of those cases as "remove the row," it loses the story.

For normal product analytics, that may be annoying.

For financial data, it can be a serious problem. Reports need to explain why numbers changed, which version was used, what was known at filing time, and what was corrected later.

So the model needs more than \`deleted_at\`.

It needs correction semantics.

## Start by naming the states

Use clear states instead of hiding every exception behind deletion.

For raw records:

\`\`\`text
received      provider row arrived
quarantined   row arrived but failed validation
corrected     row corrects an earlier row
superseded    row was replaced by a newer row
ignored       row is valid but intentionally excluded
\`\`\`

For reference data:

\`\`\`text
active        currently usable
replaced      closed by a newer version
retired       no longer used going forward
deleted       soft-deleted from normal use
\`\`\`

For report data:

\`\`\`text
draft         generated but not filed
filed         submitted externally
amended       replaced by a later filing
voided        invalidated with explanation
\`\`\`

These states give agents, analysts, and auditors better language.

If the only state is "deleted," every investigation starts with a question the table cannot answer: deleted why?

## A provider revision is a correction

Suppose CoinGecko sends a BTC price at 02:15:

\`\`\`json
{
  "id": "bitcoin",
  "current_price": 118240.12,
  "last_updated": "2026-07-26T02:15:00Z"
}
\`\`\`

Later, the provider revises the same observation:

\`\`\`json
{
  "id": "bitcoin",
  "current_price": 118420.55,
  "last_updated": "2026-07-26T02:15:00Z"
}
\`\`\`

Do not update the original raw row. Do not delete it.

Append a correction row:

\`\`\`sql
insert into raw_provider_records (
  provider,
  source_name,
  source_run_id,
  source_record_id,
  source_observed_at,
  payload,
  payload_sha256,
  record_status,
  supersedes_raw_record_id,
  correction_reason
) values (
  'coingecko',
  'coins_markets',
  'run_20260726_correction_01',
  'bitcoin:2026-07-26T02:15:00Z',
  timestamptz '2026-07-26 02:15:00+00',
  '{"id":"bitcoin","current_price":118420.55,"last_updated":"2026-07-26T02:15:00Z"}',
  'payload_hash_here',
  'corrected',
  1001,
  'provider revised the published price'
);
\`\`\`

Staging can pick the corrected row for current marts. The original row remains available for evidence.

That matters if a report was generated between the first row and the correction. You can say:

\`\`\`text
The filed report used raw_record_id 1001.
The provider correction arrived later as raw_record_id 1044.
The amended report used raw_record_id 1044.
\`\`\`

That is a better audit trail than "the old price disappeared."

## A wrong mapping is a version change

Asset mappings are not raw facts. They are interpretation.

Suppose a provider asset ID was mapped to the wrong canonical asset:

\`\`\`text
provider: coingecko
provider_asset_id: bridged-usdc
old canonical_asset_id: usd-coin
correct canonical_asset_id: bridged-usdc-arbitrum
\`\`\`

This should not be handled by deleting the old row and inserting a new one with no history.

Use effective dates:

\`\`\`sql
update asset_mappings
   set effective_to = timestamptz '2026-07-26 00:00:00+00',
       mapping_status = 'replaced',
       updated_at = now(),
       updated_by = coalesce(current_setting('app.actor', true), current_user)
 where mapping_id = 42
   and effective_to is null
   and deleted_at is null;

insert into asset_mappings (
  provider,
  provider_asset_id,
  canonical_asset_id,
  effective_from,
  mapping_status,
  source_run_id
) values (
  'coingecko',
  'bridged-usdc',
  'bridged-usdc-arbitrum',
  timestamptz '2026-07-26 00:00:00+00',
  'active',
  'mapping_review_20260726'
);
\`\`\`

Now historical reports can still use the mapping that was active at report time. New reports use the corrected mapping.

If the old mapping affected a filed report, create a report impact review. Do not pretend the old row never existed.

## A duplicate exchange balance is usually ignored, not deleted

Exchange exports are messy.

Imagine an exchange CSV import includes the same balance row twice:

\`\`\`text
account_id: main
asset: ETH
balance: 12.5
as_of: 2026-07-26T00:00:00Z
row appears twice in the same file
\`\`\`

The raw rows should both remain. The source really did contain duplicates.

Staging can mark one row as ignored:

\`\`\`sql
create table staging_record_decisions (
  decision_id bigserial primary key,
  raw_record_id bigint not null,
  decision_status text not null,
  decision_reason text not null,
  decided_at timestamptz not null default now(),
  decided_by text not null default coalesce(current_setting('app.actor', true), current_user)
);
\`\`\`

Example decision:

\`\`\`sql
insert into staging_record_decisions (
  raw_record_id,
  decision_status,
  decision_reason
) values (
  2208,
  'ignored',
  'duplicate exchange balance within same source file'
);
\`\`\`

Then staging excludes it from consumer models:

\`\`\`text
raw row exists
decision says ignored
mart excludes ignored row
audit can explain why
\`\`\`

That is different from deletion. Deletion says "this row is gone." Ignoring says "this row existed, but should not count."

## A quarantined row is pending, not deleted

Quarantine is another distinct state.

If a row fails validation, do not delete it just because it cannot enter the mart.

Example:

\`\`\`text
provider sent token balance
contract_address is missing
chain_id is present
symbol is "USDC"
canonical_asset_id cannot be resolved
\`\`\`

That row should go to quarantine:

\`\`\`text
failure_reason: unmapped_asset
source_run_id: run_20260726_0300
raw_record_id: 3011
review_status: open
\`\`\`

A reviewer may later resolve the mapping. Then the row can be replayed into staging and marts.

If the pipeline had deleted it, there would be nothing to review and nothing to replay.

Quarantine means "not trusted yet." It does not mean "does not exist."

## A true deletion is rare and should say why

There are cases where deletion is real.

Examples:

\`\`\`text
retention policy requires removal after a period
privacy obligation requires removing personal data
test data was loaded into production by mistake
operational table row is no longer valid
\`\`\`

Even then, prefer soft delete where the record is part of a financial audit trail:

\`\`\`sql
update manual_overrides
   set deleted_at = now(),
       deleted_by = coalesce(current_setting('app.actor', true), current_user),
       deletion_reason = 'manual override retired after review'
 where override_id = 77
   and deleted_at is null;
\`\`\`

Use hard delete only when the requirement is actually to remove the data.

And if hard delete is required, log the deletion outside the deleted table:

\`\`\`sql
insert into deletion_audit_log (
  table_name,
  record_id,
  deleted_at,
  deleted_by,
  deletion_reason
) values (
  'manual_overrides',
  '77',
  now(),
  coalesce(current_setting('app.actor', true), current_user),
  'privacy removal request'
);
\`\`\`

You may not be able to keep the full row. You can still keep evidence that a controlled deletion happened.

## Give agents the right action

Agents should not be handed one generic action called "delete row."

Give them specific actions:

\`\`\`text
propose_correction(raw_record_id, corrected_payload, reason)
mark_duplicate(raw_record_id, duplicate_of_raw_record_id, reason)
open_mapping_review(provider, provider_asset_id, reason)
quarantine_row(raw_record_id, failure_reason)
request_soft_delete(table_name, record_id, reason)
\`\`\`

Those actions encode the difference between correction, duplicate, mapping review, quarantine, and deletion.

An agent can help route the work. It can propose changes. It can create review tasks. For financial data, it should not silently erase evidence.

This pairs well with MCP. Instead of exposing broad write SQL, expose narrow tools that create auditable requests.

## The practical rule

Before deleting a financial row, ask what actually happened:

\`\`\`text
Was the provider fact revised?
Append a correction row.

Was the old interpretation replaced?
Use effective-dated versioning.

Was the row duplicated?
Mark it ignored or duplicate.

Did the row fail validation?
Quarantine it.

Was the data truly removed from normal use?
Soft delete it with a reason.

Must the data be physically removed?
Hard delete through a controlled process and log it elsewhere.
\`\`\`

Corrections preserve history. Deletions remove state.

Use the right one.

## References

- [Auditable Database Design for Financial Data](/posts/2026-07-25-auditable-database-design-financial-data)
- [Immutable Raw Tables for Financial Pipelines](/posts/2026-07-25-immutable-raw-tables-financial-pipelines)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [The Data Quality Review Queue](/posts/2026-07-23-data-quality-review-queue)
- [Point-in-Time Correctness in Crypto Analytics](/posts/2026-07-24-point-in-time-correctness-crypto-analytics)
- [MCP Is Becoming the API Layer for Internal Data](/posts/2026-07-24-mcp-api-layer-internal-data)
`;export{e as default};