var e=`---
title: "Validation, Version Control, and Rollback in Data Engineering"
date: 2026-07-28
tags: [data-engineering, validation, version-control, rollback, dbt, reliability, traceability]
series: data-engineering
summary: "Reliable data pipelines need more than successful jobs. Validation catches bad data, version control explains what changed, and rollback mechanisms give the team a controlled way to recover without hiding the evidence."
---

# Validation, Version Control, and Rollback in Data Engineering

A data pipeline is not reliable because it ran.

It is reliable when the team can answer boring questions under pressure:

\`\`\`text
What changed?
Who changed it?
Which data did it affect?
Which reports used that data?
Can we prove the old result?
Can we roll forward or roll back without guessing?
\`\`\`

This matters more in financial data. A wrong crypto price, duplicated balance, bad asset mapping, or stale FX rate can leak into investor reporting, tax calculations, risk dashboards, or regulatory filing output.

The fix is not one magic tool. It is a system of three habits:

\`\`\`text
validation       reject or flag bad data before it becomes trusted
version control  record which code, schema, mapping, and data version produced the result
rollback         recover from bad releases and bad data without deleting evidence
\`\`\`

These three parts should be designed together. Validation without versioning tells you that something failed, but not what changed. Versioning without rollback gives you a nice audit trail and no recovery path. Rollback without validation means you may roll back to another bad state.

## Validation is the first control

Validation is where a pipeline says: this data is acceptable, suspicious, or unsafe.

For a crypto ELT pipeline, validation usually happens at several layers:

\`\`\`text
raw ingestion       did we receive a parseable payload?
staging             do fields have expected types and required values?
mapping             does every provider asset map to a canonical asset id?
mart                are balances, prices, and exposures internally consistent?
report              does the report match reconciliation rules?
\`\`\`

The raw layer should validate the envelope, not rewrite the truth. If CoinGecko returns a price payload, the raw table should store the provider response, request URL, provider timestamp, ingest timestamp, payload hash, and run ID. It can validate that the payload is parseable JSON and tied to a source run. It should not silently rename assets, round prices, or drop fields because they look inconvenient.

Example raw ingestion checks:

\`\`\`text
payload is valid JSON
provider name is present
request URL is present
ingested_at is present
payload_hash is present
run_id is present
\`\`\`

Staging can be stricter:

\`\`\`text
asset symbol is not null
price_usd is numeric
price_usd is greater than zero
provider_asset_id exists
observed_at is not in the future
\`\`\`

Marts should be stricter again:

\`\`\`text
canonical_asset_id is not null
one balance row per account, asset, and report timestamp
portfolio exposure equals quantity times price within tolerance
report date uses point-in-time mappings
no quarantined rows enter the mart
\`\`\`

The point is to validate at the boundary where the rule becomes true. A raw table should not enforce the same rules as a reporting mart. Raw data preserves provider truth. Marts preserve business truth.

## dbt validation belongs close to the model

dbt is useful here because tests live next to the models they protect.

A staging model can define basic quality checks:

\`\`\`yaml
models:
  - name: stg_coingecko__prices
    columns:
      - name: provider_asset_id
        data_tests:
          - not_null
      - name: price_usd
        data_tests:
          - not_null
      - name: observed_at
        data_tests:
          - not_null
\`\`\`

A mart can define stronger rules:

\`\`\`yaml
models:
  - name: mart__daily_asset_prices
    columns:
      - name: canonical_asset_id
        data_tests:
          - not_null
      - name: report_date
        data_tests:
          - not_null
    data_tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns:
            - canonical_asset_id
            - report_date
\`\`\`

Some failures should block the pipeline. Some should warn.

For example:

\`\`\`text
Block: BTC has no canonical asset id in the portfolio mart.
Warn: a delisted asset has no fresh market price today.
Block: report total does not reconcile to source balances.
Warn: a reference table is older than 24 hours but unchanged.
\`\`\`

Severity is part of the contract. A warning is not a polite failure. It means the pipeline can continue and someone should still see the issue.

## Version control is more than Git

Git is the first version-control layer.

It should track:

\`\`\`text
dbt model SQL
schema.yml tests
source definitions
macros
orchestrator DAGs or flows
seed files
documentation
data contracts
report templates
\`\`\`

Every production run should record the commit SHA that produced it:

\`\`\`sql
create table pipeline_runs (
    run_id text primary key,
    pipeline_name text not null,
    git_sha text not null,
    dbt_invocation_id text,
    environment text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    status text not null,
    triggered_by text not null
);
\`\`\`

That gives you a clean answer when a report is questioned:

\`\`\`text
Report: daily_nav_2026_07_28.pdf
Produced by: run_2026_07_28_090000
Code version: 8f3a91c
dbt invocation: 3ad6...
Status: success
\`\`\`

But Git does not version the data itself.

Financial pipelines also need versioning for:

\`\`\`text
asset mappings
platform mappings
exchange account mappings
schema contracts
report outputs
published metrics
correction decisions
\`\`\`

An asset mapping table should be temporal:

\`\`\`sql
create table asset_provider_mappings (
    mapping_id bigserial primary key,
    canonical_asset_id text not null,
    provider_name text not null,
    provider_asset_id text not null,
    valid_from timestamptz not null,
    valid_to timestamptz,
    created_at timestamptz not null default now(),
    created_by text not null,
    superseded_by bigint references asset_provider_mappings(mapping_id),
    reason text not null
);
\`\`\`

This matters when a provider changes an ID or when your team fixes a bad mapping. You do not want to overwrite yesterday's mapping and pretend it was always true. Yesterday's report must be reproducible with yesterday's mapping.

## Version data that changes meaning

Not every table needs full history. Append-only raw event tables already have history by design.

The tables that need versioning are the ones where a changed row changes interpretation:

\`\`\`text
canonical assets
provider mappings
platforms
account ownership
exchange wallet labels
reporting rules
tax classification rules
manual adjustments
\`\`\`

For mutable dimensions, dbt snapshots can help. A snapshot records old and new versions of a row instead of keeping only the latest value.

The warehouse result should let you ask:

\`\`\`sql
select *
from asset_provider_mappings_history
where provider_name = 'coingecko'
  and provider_asset_id = 'bitcoin'
  and dbt_valid_from <= timestamp '2026-07-28 00:00:00'
  and (dbt_valid_to is null or dbt_valid_to > timestamp '2026-07-28 00:00:00');
\`\`\`

That query is the difference between "what do we think BTC maps to now?" and "what mapping did the report use at the time?"

For regulatory reports, the second question is usually the one that matters.

## Rollback is a planned operation

Rollback should not mean someone logs into production and starts changing rows by hand.

A rollback plan should define what can be rolled back:

\`\`\`text
code release
dbt model version
warehouse table version
published report
asset mapping change
manual correction
backfill run
\`\`\`

Each one has a different recovery path.

Code rollback is usually a Git revert or redeploy of a previous commit.

\`\`\`text
bad commit -> revert commit -> deploy -> rerun affected models
\`\`\`

Data rollback is different. If a run loaded bad raw data, do not delete it quietly. Mark it, quarantine it, or supersede it.

\`\`\`sql
create table data_corrections (
    correction_id bigserial primary key,
    affected_table text not null,
    affected_key text not null,
    bad_run_id text not null,
    correction_run_id text,
    correction_type text not null,
    reason text not null,
    proposed_by text not null,
    approved_by text,
    created_at timestamptz not null default now(),
    approved_at timestamptz
);
\`\`\`

For published marts, rollback often means publishing a new report version rather than mutating the old one:

\`\`\`text
daily_nav_2026_07_28_v1    published, later found wrong
daily_nav_2026_07_28_v2    corrected report
\`\`\`

The old report remains part of the audit trail. The corrected report points to the correction reason and the run that produced it.

## Roll forward when possible

Rollback sounds clean, but data systems often need roll-forward recovery.

If a provider sends a revised price, the better fix is usually:

\`\`\`text
store the revised provider payload
create a correction row
rerun affected staging and mart models
publish report version v2
link v2 to the correction reason
\`\`\`

That keeps the evidence.

A destructive rollback can remove the exact trail needed to explain the incident. For financial data, "we deleted the bad rows" is rarely a satisfying answer.

## Example: wrong ETH mapping

Say the pipeline maps an exchange asset symbol \`ETH\` to the wrong canonical asset because the provider mapping table reused a stale provider ID.

The bad path:

\`\`\`text
update mapping row in place
rerun report
delete the old report
tell everyone it is fixed
\`\`\`

That hides the event.

The better path:

\`\`\`text
1. Add a new mapping row with valid_from and reason.
2. Set valid_to on the superseded mapping.
3. Create a correction proposal tied to the bad run ID.
4. Approve the correction.
5. Rerun dbt for affected models and report dates.
6. Publish daily_nav_2026_07_28_v2.
7. Keep v1 with a superseded status.
\`\`\`

Now the team can answer:

\`\`\`text
which mapping was wrong
which reports used it
which commit built them
which correction replaced them
who approved the correction
which report version is current
\`\`\`

That is traceability.

## Example: duplicate exchange balance

A duplicated exchange balance can happen when an ingestion job retries after a timeout. The API call succeeded, but the loader did not record success. The retry inserts the same balance again.

Validation should catch this before the mart:

\`\`\`text
unique account_id, canonical_asset_id, exchange_snapshot_id
source_count equals staged_count after dedupe
mart balance count matches expected account count
\`\`\`

The rollback mechanism should avoid manual deletion:

\`\`\`text
mark duplicated raw rows with a duplicate_of_raw_id
quarantine duplicated staging rows
rerun the mart from valid staging data
record the correction run ID
\`\`\`

For an immutable raw table, the duplicate still exists. The trusted mart does not use it.

That is the balance: preserve the evidence, protect the report.

## What to log on every run

Run logs are part of rollback.

At minimum, each run should record:

\`\`\`text
run_id
pipeline name
git sha
dbt invocation id
orchestrator run id
source row counts
loaded row counts
quarantined row counts
models built
tests passed
tests warned
tests failed
published artifacts
status
\`\`\`

This can be a database table, JSONL log, or both. The exact storage matters less than the habit: every output should point back to the run that created it.

Reports should carry this metadata too:

\`\`\`text
report_id
report_date
report_version
run_id
git_sha
data_cutoff_at
published_at
published_by
superseded_by_report_id
\`\`\`

If a number is challenged later, the report should not be an orphaned PDF.

## A practical implementation pattern

For a small financial or crypto project, I would start with this:

\`\`\`text
1. Raw tables are append-only and include run_id, ingested_at, source_payload, and payload_hash.
2. Staging models validate types, required fields, dedupe keys, and timestamps.
3. Mapping tables use valid_from and valid_to instead of overwriting meaning.
4. dbt tests block marts when report-critical rules fail.
5. Warnings create review tasks instead of disappearing into logs.
6. Every dbt run records git_sha, invocation_id, status, and row counts.
7. Published reports are versioned.
8. Corrections supersede bad facts instead of deleting them.
\`\`\`

That is enough for a serious first version. It does not require buying a data catalog, implementing a full event sourcing system, or building custom governance software.

Start with the tables and logs that answer real audit questions.

## The rule

Validation protects the pipeline before bad data spreads.

Version control explains how the result was produced.

Rollback gives the team a controlled recovery path.

For data engineering, reliability is not the absence of failure. Pipelines fail. Providers revise data. People make bad mappings. Jobs retry at the wrong time.

Reliability means the system can fail in a way that leaves a trail.

## References

- [dbt documentation](https://docs.getdbt.com/docs/introduction)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt snapshots](https://docs.getdbt.com/docs/build/snapshots)
- [dbt exposures](https://docs.getdbt.com/docs/build/exposures)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [When to Fail the Pipeline vs Warn](/posts/2026-07-22-when-to-fail-pipeline-vs-warn)
- [Corrections Are Not Deletions](/posts/2026-07-26-corrections-are-not-deletions)
- [Immutable Raw Tables for Financial Pipelines](/posts/2026-07-25-immutable-raw-tables-financial-pipelines)
`;export{e as default};