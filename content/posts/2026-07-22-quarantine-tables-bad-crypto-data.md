---
title: "Quarantine Tables: Where Bad Crypto Data Should Go"
date: 2026-07-22
tags: [crypto, data-quality, data-engineering, pipelines, dbt, market-data]
series: data-engineering
summary: "Bad crypto data should not disappear and it should not flow into marts. Quarantine tables give failed rows a visible place to land, with the source payload, run id, failure reason, retry policy, and enough context for humans or agents to fix the pipeline."
---

# Quarantine Tables: Where Bad Crypto Data Should Go

Bad data needs somewhere to go.

Most pipelines pick one of two bad defaults. They drop the row silently, or they let it keep moving because the report needs to finish.

Both choices create worse bugs later.

If a CoinGecko asset arrives without an ID, if a price row has no observation time, if a token contract has no chain, or if a balance cannot be mapped to a canonical asset, the row should not vanish. It also should not land in a public mart where dashboards and agents will treat it as clean.

It should go to quarantine.

## Quarantine is not deletion

A quarantine table is a holding area for rows that failed a rule but still matter.

The row may be fixable. The source may have changed. The mapping table may be missing a new token. The ingestion code may have a bug. The provider may have returned garbage for one run.

Dropping the row destroys evidence.

Letting the row into the mart spreads the damage.

Quarantine keeps the evidence without pretending the data is safe.

## What belongs in quarantine

Not every weird row needs quarantine. Raw data is allowed to be messy.

Quarantine is for rows that fail a rule the pipeline cares about:

- required identity is missing
- provider ID cannot map to a canonical asset
- token contract is present without chain identity
- timestamp cannot be parsed
- price is negative
- batch row count is far below the expected minimum
- source payload violates the data contract
- stale data is trying to overwrite newer data

For crypto, identity failures are the big one. If a row cannot be mapped safely, it should not reach a consumer-facing table.

## The minimum schema

The first version can be one table:

```text
quarantine_records
```

With boring columns:

```text
quarantine_id
run_id
source_name
source_record_id
entity
failure_reason
failure_stage
severity
source_payload_json
normalized_payload_json
first_seen_at
last_seen_at
retry_status
retry_after
resolved_at
resolution_note
```

That looks like a lot, but each field has a job.

`run_id` connects the bad row to the ingestion or transform run. `failure_reason` tells you why it was rejected. `failure_stage` tells you where it failed: raw parse, staging normalization, mapping, freshness, or mart validation. `source_payload_json` preserves what the provider actually sent.

That last part matters. Store more than the cleaned version. If the cleaner is wrong, the raw payload is the evidence.

## Store reason codes, not prose

Failure reasons should be machine-readable.

Use stable codes:

```text
missing_provider_id
missing_chain_id
unmapped_asset
invalid_timestamp
negative_price
row_count_below_minimum
stale_overwrite
contract_violation
```

Add a human note if needed, but do not make agents parse a paragraph to understand the failure.

Stable reason codes make it possible to build a simple review queue:

```sql
select
  failure_reason,
  count(*) as failed_rows,
  min(first_seen_at) as first_seen_at,
  max(last_seen_at) as last_seen_at
from quarantine_records
where resolved_at is null
group by failure_reason
order by failed_rows desc;
```

That query is more useful than a log search.

## Where quarantine fits in the pipeline

Quarantine can happen at several points.

At ingestion, quarantine records that cannot be stored safely. If the JSON does not parse, if the source record has no stable identity, or if the batch metadata is broken, keep the payload and mark the run.

At staging, quarantine rows that fail normalization. This is where timestamp parsing, chain IDs, contract addresses, and provider-specific asset IDs should become explicit.

At mapping, quarantine unknown assets. If `coingecko_id`, exchange symbol, or contract address cannot map to a canonical asset, keep the row out of marts.

At marts, quarantine should be rare. If bad rows reach the mart layer often, the earlier boundary is too weak.

The practical shape:

```text
raw: preserve source payload
staging: normalize or quarantine
mapping: resolve identity or quarantine
marts: publish only trusted rows
```

## Do not let quarantine hide failure

Quarantine is not a way to make every run green.

Some quarantined rows should warn. Some should fail the run. Some should block publishing. The policy depends on the dataset.

For a broad asset discovery job, an unmapped token might be a warning and a review task.

For a portfolio exposure report, an unmapped balance should block publish. A report that silently excludes an asset is worse than no report.

For a price mart, a few missing long-tail assets may warn. Missing BTC or ETH should fail.

So the quarantine record needs severity:

```text
info
warning
blocking
```

The pipeline should make the blocking count visible:

```text
run_id: 2026-07-22T021500Z
quarantined_rows: 18
blocking_rows: 3
status: failed
```

That is the kind of output a human and an agent can act on.

## Retry needs a policy

Bad rows have different retry paths.

Some are source glitches. Retry the same payload later or rerun the source.

Some need mapping work. Add the asset to the mapping table, then replay the quarantined rows.

Some are permanent. A provider sent a malformed record that should stay rejected.

Use a small retry status:

```text
pending_review
retry_ready
retried
resolved
ignored
dead_letter
```

Do not overbuild this. A few statuses are enough.

The important part is replay. If a new asset mapping fixes ten quarantined rows, the pipeline should be able to reprocess those rows without pulling the whole source again.

That is another reason to store the source payload and run id.

## Agents can help, but only with evidence

Quarantine tables are useful for agents because they turn vague failures into structured work.

Instead of asking an agent "why is the pipeline broken?", give it:

```text
show unresolved quarantine rows grouped by failure_reason
inspect sample source_payload_json for unmapped_asset
compare external_id against asset_provider_mappings
suggest a mapping patch
```

That is a bounded debugging task.

The agent should not auto-resolve production mappings without review. It can prepare the change, show evidence, and point to the source rows affected.

For crypto data, that review step matters. Mapping the wrong token to the wrong canonical asset is worse than leaving it quarantined.

## How this ties to dbt

dbt tests usually fail when a rule is broken. That is good for mart-level guarantees.

But sometimes you want failed rows to become a table for review.

For source and staging checks, a quarantine model can be more useful than a hard stop. For public marts, a hard stop is usually right.

The split I like:

```text
staging issue: quarantine row and continue if non-blocking
mapping issue: quarantine row, block consumer marts when financial exposure is affected
mart contract issue: fail the build
freshness issue: block agent/reporting use
```

This keeps data quality checks from becoming a binary choice between "ignore it" and "break everything."

## The practical rule

Do not drop bad crypto rows silently. Do not let them into marts.

Quarantine them with the source payload, run id, failure reason, severity, and retry status. Make blocking failures stop the right outputs. Keep enough evidence for a human or agent to fix the cause.

Bad data is not the problem. Invisible bad data is.

## References

- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Data Contracts: The API Layer Your Crypto Pipeline Is Missing](/posts/2026-07-18-data-contracts-crypto-pipelines)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [The Crypto Asset Mapping Table](/posts/2026-07-21-crypto-asset-mapping-table)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
