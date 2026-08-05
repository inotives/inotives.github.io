---
title: "Schema Drift Is a Production Incident, Not a Parsing Error"
date: 2026-08-05
tags: [data-engineering, crypto-data, data-contracts, data-quality]
summary: "A provider changing a field name or type can quietly corrupt a mart long before a parser crashes. Treat schema drift as a visible incident: preserve the payload, classify the change, quarantine unsafe records, and replay only after the contract changes."
series: data-engineering
---

# Schema Drift Is a Production Incident, Not a Parsing Error

A market-data provider renames `price_usd` to `price`. The extractor still returns a row. The staging model casts the missing value to `null`. A dashboard now shows gaps, and nobody notices until an analyst asks why yesterday's market cap dropped to zero.

That is not a parser annoyance. It is a production data incident.

Schema drift is any change in the shape or meaning of data a pipeline receives: a missing field, a renamed key, a type change, a new enum value, a nested object moving location, or a field that keeps its name but changes its meaning. Crypto providers do this often because their products evolve around new markets, chains, token migrations, and vendor-specific classifications.

The first goal is not to make every new payload pass. It is to prevent an unreviewed change from becoming plausible-looking output.

## Keep the raw payload

The raw layer should store what the provider sent, when it arrived, which endpoint produced it, and which extraction run received it.

```sql
create table raw_provider_tickers (
    run_id text not null,
    provider text not null,
    ingested_at timestamp not null,
    payload jsonb not null,
    payload_schema_version text,
    payload_hash text not null
);
```

You may not know the provider's schema version. That is fine. Record your observed version or a payload fingerprint. The point is to retain evidence before a transformation decides what the payload means.

If the provider changes a field tomorrow, you can compare new payloads with the last known-good shape and replay from raw after the contract changes. Without raw evidence, a team ends up debugging a null in a mart with no way to see what arrived upstream.

## Classify the change before deciding what to do

Not every difference has the same risk.

```text
Compatible:  an optional field is added and existing fields are unchanged.
Breaking:    a required field disappears, moves, or changes type.
Suspicious:  a field keeps its shape but its values change meaning.
```

The suspicious class deserves more attention than it gets. A provider might replace `active` with values such as `trading`, `halted`, and `delisted`. A loose parser may coerce every non-empty string to `true`. No error appears, yet downstream consumers now receive an invented definition of active.

Make classification a small contract decision. A compatible change can pass through raw and wait for a planned model update. A breaking or suspicious change should stop before it reaches a mart.

## Detect drift at the boundary

Do not wait for a dbt test after an extraction has already normalized unknown data. Compare each payload with the expected shape at ingestion.

For a simple ticker response, the contract can stay small:

```yaml
provider: example_exchange
resource: ticker
required:
  symbol: string
  price_usd: number
  observed_at: timestamp
optional:
  volume_24h: number
accepted_statuses: [active, halted]
```

An extractor can then distinguish these two responses:

```json
{"symbol":"BTC/USDT","price_usd":104200.10,"observed_at":"2026-08-05T09:00:00Z"}
```

```json
{"symbol":"BTC/USDT","price":"104200.10","status":"trading","observed_at":"2026-08-05T09:00:00Z"}
```

The second response is not close enough. It changes a required field and introduces an unknown status. Quarantine it with a reason code; do not silently map `price` to `price_usd` in production because the names look similar.

## Quarantine by schema failure

Rows that fail a schema contract need a durable destination. Include the original payload and a structured reason:

```yaml
reason_code: required_field_missing
expected_field: price_usd
observed_keys: [symbol, price, status, observed_at]
provider: example_exchange
run_id: ingest-2026-08-05-0900
next_action: review_provider_schema_change
```

This turns drift into a visible queue. A human or agent can inspect the evidence, compare it with the contract, and decide whether the change is a provider migration, a temporary bad response, or a parser defect.

Do not make quarantine a quiet success state. Alert on a sudden rise in schema failures, especially for a source that feeds a published mart. The pipeline is healthier when it refuses to publish than when it publishes an incorrect zero.

## Version the contract and the fixtures together

When the provider's change is legitimate, update the contract, parser, and representative fixtures in the same pull request.

```text
contract v3: price_usd required; active and halted statuses
contract v4: price required; trading, halted, and delisted statuses
```

The migration should state what changed in meaning. If `price` is quoted in a different currency or reflects a different aggregation method, that is not a rename. It may need a new model field or a new provider mapping.

Fixtures make this testable before live ingestion. Keep one last-known-good payload and one example of the new shape. A parser test should prove that v3 still behaves as expected for historical replay and v4 behaves as intended for new runs.

## Replay only after the meaning is settled

Once the contract changes, replay the affected raw records through the updated staging model. Do not rerun every historical payload by default.

Use the first observed drift time, source endpoint, and contract version to define the smallest safe range. If the field was missing for two hours, replay those two hours. If the provider changed an asset-status definition, determine which mart depends on that definition before touching older reports.

Record the replay as a correction. Consumers should be able to see that a period was recomputed because a source contract changed.

## Give agents a narrow role

An agent can compare payload keys, group failures, propose a contract patch, and prepare fixtures. It should not decide that a field rename preserves business meaning.

Make the task explicit:

```yaml
goal: Assess provider ticker schema drift
allowed_actions:
  - inspect raw payload samples
  - compare against contract v3
  - draft a contract update and tests
requires_human_review:
  - approve changed field semantics
  - approve historical replay scope
```

The agent produces evidence. A trusted reviewer decides whether the pipeline has learned a new schema or needs to reject the source change.

## Start with one source contract

Pick the provider that has caused the most recent surprise. Store a raw payload sample, write a compact required-and-optional field contract, and add one failure path that quarantines unknown shapes.

That small boundary changes the failure mode. A provider change becomes a reviewable incident with evidence and a replay plan, instead of an unexplained gap in a dashboard.

## References

- [Data Contracts: The API Layer Your Crypto Pipeline Is Missing](/posts/data-contracts-crypto-pipelines)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/quarantine-tables-bad-crypto-data)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/data-quality-checks-save-pipelines)
- [Late-Arriving Data Is a Product Decision, Not a Scheduler Problem](/posts/late-arriving-data-product-decision)
