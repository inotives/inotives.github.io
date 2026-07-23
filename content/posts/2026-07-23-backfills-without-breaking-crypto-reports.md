---
title: "Backfills Without Breaking Crypto Reports"
date: 2026-07-23
tags: [crypto, data-engineering, backfills, data-quality, dbt, market-data]
series: data-engineering
summary: "Backfills are how crypto pipelines repair history, but careless backfills can rewrite reports, break mappings, duplicate rows, and make agents explain old numbers with new assumptions. Safe backfills need raw replay, historical mappings, idempotent jobs, run IDs, and report versioning."
---

# Backfills Without Breaking Crypto Reports

Backfills sound harmless.

You fixed the parser. You improved the asset mapping table. You added a missing price source. You found a bug in the mart SQL. Now you want to rerun the past and clean up the reports.

That is where crypto pipelines get dangerous.

A backfill can repair history. It can also rewrite it.

If you replay old rows with today's mappings, overwrite report outputs without versioning, or run non-idempotent jobs, you can make yesterday's report disagree with the one a client already saw. The pipeline may be "more correct" now, but the audit trail is gone.

Backfills need rules.

## Backfill from raw, not from memory

The best backfill starts from raw data.

If the pipeline preserved provider payloads, run IDs, ingestion timestamps, and source metadata, you can replay the original evidence:

```text
raw payload -> staging fix -> mapping join -> mart rebuild -> report version
```

If raw data was overwritten or discarded, the backfill becomes guesswork. Pulling the provider API again is not the same thing. The provider may return different metadata, corrected prices, missing delisted assets, or a new symbol for an old token.

That is not replay. That is a new ingestion pretending to be history.

For crypto, this matters because source truth changes. Provider IDs get merged. Symbols change. Token contracts migrate. Delisted assets disappear from public endpoints.

Raw data is what lets the backfill stay honest.

## Preserve historical mappings

The most common crypto backfill bug is using today's asset mapping for yesterday's rows.

If a token migrated in June, a report for May should use the mapping that was valid in May. If an exchange changed a ticker, historical trades should keep the ticker context that existed at the time. If a provider corrected an asset ID, the old provider row still needs a temporal bridge.

That is why asset mappings need validity windows:

```text
canonical_asset_id
provider
external_id
chain_id
contract_address
effective_from
effective_to
```

Backfill joins should use the observation time:

```sql
select
  r.observed_at,
  m.canonical_asset_id,
  r.quantity
from raw_balances r
join asset_provider_mappings m
  on r.provider = m.provider
 and r.external_id = m.external_id
 and r.observed_at >= m.effective_from
 and (m.effective_to is null or r.observed_at < m.effective_to)
```

Without that time condition, the backfill can silently rewrite old reports with new identity rules.

## Idempotency is not optional

A backfill should be safe to run twice.

If running it twice duplicates rows, increments totals, appends duplicate reports, or changes output without input changes, the job is not ready.

Use deterministic keys:

```text
source_name
source_record_id
observed_at
canonical_asset_id
backfill_run_id
```

For marts, the unique key might be:

```text
report_date
account_id
canonical_asset_id
model_version
```

The exact key depends on the table. The principle does not: each output row needs a stable identity so the job can upsert, replace a partition, or write a new version without double-counting.

The lazy check is simple. Run the backfill twice in a test environment and compare row counts and checksums. If the second run changes anything it should not, stop.

## Run IDs make the backfill traceable

Every backfill needs its own run ID.

Do not hide it under the original ingestion run. The original run tells you when the data first arrived. The backfill run tells you when it was reprocessed and why.

Log both:

```json
{
  "run_id": "backfill_2026-07-23T021500Z",
  "backfill_reason": "fix_asset_mapping_validity_window",
  "source_run_ids": ["2026-06-01T000000Z", "2026-06-02T000000Z"],
  "date_range": ["2026-06-01", "2026-06-30"],
  "models": ["mart__portfolio_exposure"]
}
```

That gives reviewers and agents something concrete to inspect.

If a report number changes, the answer should be:

```text
It changed because backfill_2026-07-23T021500Z rebuilt June exposure using mapping contract v3.
```

Not:

```text
Someone reran the pipeline.
```

## Version reports when consumers have seen them

Some outputs can be overwritten. Others need versioning.

A staging table can usually be rebuilt in place. A development mart can be replaced. A client-facing report that has already been sent should not silently mutate.

For reports, use versions:

```text
report_id
report_period
report_version
generated_at
source_run_id
backfill_run_id
status
supersedes_report_version
```

If a backfill changes the June portfolio exposure report, publish version 2 and keep version 1.

That does two things.

First, it preserves the audit trail.

Second, it gives agents a safer answer. If an agent is asked why two reports differ, it can compare report versions instead of inventing a story.

## Do not backfill everything by default

Backfills should have a scope.

```text
date range
sources
models
accounts
assets
reason
expected impact
```

The wider the scope, the more careful the validation.

If the bug only affected `USDC` mappings on Ethereum from June 1 to June 15, do not rebuild every price, balance, and exposure table for the whole year unless there is a reason.

Small scoped backfills are easier to review. They are also easier for agents to verify.

## Validate before publish

Backfill validation should compare old and new output.

Useful checks:

- row counts by date
- sum of exposure by asset
- number of unmapped assets
- quarantine rows before and after
- freshness status
- report totals before and after
- top changed accounts or assets

For a crypto exposure mart, I want a diff like:

```text
report_period: 2026-06
changed_accounts: 12
changed_assets: [asset_usdc, asset_wbtc]
max_absolute_delta_usd: 1842.21
unmapped_assets_before: 7
unmapped_assets_after: 0
blocking_checks: 0
```

That summary should live in the run log or backfill record.

If an agent reviews the backfill, this is the evidence it needs.

## Keep agent-facing rules strict

Agents should not use backfilled outputs until the output is marked publishable.

Expose status:

```json
{
  "dataset": "mart__portfolio_exposure",
  "backfill_status": "validating",
  "allowed_for_agent_use": false,
  "reason": "report version 2 has not passed reconciliation checks"
}
```

Once validation passes:

```json
{
  "dataset": "mart__portfolio_exposure",
  "backfill_status": "published",
  "report_version": 2,
  "allowed_for_agent_use": true
}
```

This avoids a nasty failure mode: the agent queries a half-rebuilt mart and gives a confident explanation while the backfill is still in progress.

## The practical rule

A safe backfill is a controlled replay, not a casual rerun.

Start from raw data. Use historical mappings. Make the job idempotent. Give the backfill its own run ID. Version reports that consumers have already seen. Validate old vs new output before publishing. Keep agents away until the status says the backfill is ready.

Backfills are how data systems admit they were wrong.

Do that carefully.

## References

- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [The Crypto Asset Mapping Table](/posts/2026-07-21-crypto-asset-mapping-table)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [When to Fail the Pipeline vs Warn](/posts/2026-07-22-when-to-fail-pipeline-vs-warn)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
