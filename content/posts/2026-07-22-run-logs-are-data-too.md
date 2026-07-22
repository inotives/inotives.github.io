---
title: "Run Logs Are Data Too"
date: 2026-07-22
tags: [data-engineering, observability, pipelines, jsonl, ai-agents, data-quality]
series: data-engineering
summary: "Pipeline run logs should be queryable data, not decorative terminal output. Structured JSONL logs with run IDs, source counts, error codes, freshness status, and retry metadata give humans and agents the evidence they need to debug without guessing."
---

# Run Logs Are Data Too

Pipeline logs usually start as terminal noise.

```text
Starting sync...
Fetched records...
Transform complete.
Done.
```

That is fine until something breaks.

Then the log becomes evidence. Which source ran? How many records arrived? Did the batch fail before staging or after mapping? Was the mart stale? Which run produced the quarantined rows? Can the agent compare this run with the last good one?

If the log cannot answer those questions, it is not really a log. It is a screen recording in text form.

Run logs are data. Treat them that way.

## The first rule: every event gets a run id

Without a run id, a log line is loose evidence.

A useful pipeline event should carry:

```json
{
  "run_id": "2026-07-22T021500Z",
  "event": "source_started",
  "source": "coingecko.coins",
  "ts": "2026-07-22T02:15:00Z"
}
```

That `run_id` should appear everywhere the run leaves evidence:

- raw files
- database records
- quarantine rows
- freshness checks
- dbt artifacts
- status output
- agent handoff notes

Now a human or agent can follow one run across the system.

## JSONL is boring and good

Use JSON lines.

One event per line:

```json
{"ts":"2026-07-22T02:15:00Z","run_id":"2026-07-22T021500Z","event":"run_started","pipeline":"market-pipe"}
{"ts":"2026-07-22T02:15:04Z","run_id":"2026-07-22T021500Z","event":"source_completed","source":"coingecko.coins","records_read":14251}
{"ts":"2026-07-22T02:15:09Z","run_id":"2026-07-22T021500Z","event":"quarantine_written","source":"coingecko.coins","rows":3,"reason":"missing_provider_id"}
{"ts":"2026-07-22T02:15:18Z","run_id":"2026-07-22T021500Z","event":"run_failed","error_code":"blocking_quarantine_rows"}
```

JSONL works with shell tools, Node scripts, Python notebooks, warehouses, DuckDB, and agents. It is append-friendly. It survives partial writes better than one giant JSON array.

Pretty logs can be derived from JSONL. The raw event stream should stay structured.

## Use event names, not prose

An event name should be a stable code:

```text
run_started
source_started
source_completed
source_failed
contract_checked
freshness_checked
quarantine_written
transform_started
transform_completed
mart_published
run_failed
run_completed
```

Do not make agents parse prose like:

```text
Looks like CoinGecko did not return enough rows this time.
```

Write the event:

```json
{
  "event": "source_failed",
  "source": "coingecko.coins",
  "error_code": "row_count_below_minimum",
  "records_read": 91,
  "minimum_records": 10000
}
```

The message can exist too. It should not be the only source of truth.

## Source counts should be first-class

Crypto pipelines fail quietly when counts drift.

Maybe a provider returned a partial response. Maybe pagination broke. Maybe a rate limit returned a smaller dataset. Maybe a transform filtered out too much.

Every source run should log counts:

```json
{
  "event": "source_completed",
  "source": "coingecko.coins",
  "records_read": 14251,
  "records_written": 14251,
  "records_quarantined": 3,
  "duration_ms": 4102
}
```

Then the debugging question becomes simple:

```text
What changed between the last good run and this run?
```

An agent can answer that if the counts are structured. It has to guess if the counts are buried inside terminal text.

## Freshness status belongs in the log

Freshness is a data quality dimension, so the run log should record it.

For a price mart:

```json
{
  "event": "freshness_checked",
  "dataset": "coingecko.mart__asset_prices",
  "timestamp_field": "observed_at",
  "latest_observed_at": "2026-07-22T02:10:00Z",
  "max_age_minutes": 15,
  "freshness_status": "fresh"
}
```

For a stale mart:

```json
{
  "event": "freshness_checked",
  "dataset": "coingecko.mart__asset_prices",
  "latest_observed_at": "2026-07-22T00:40:00Z",
  "max_age_minutes": 15,
  "freshness_status": "stale",
  "action": "block_agent_use"
}
```

That last field matters. The log should say what the pipeline did with the result. A stale dataset that still publishes is a different failure from a stale dataset that blocked agent access.

## Error codes beat stack traces

Stack traces help developers fix code.

They do not summarize pipeline state.

Use error codes for known failure classes:

```text
missing_provider_id
invalid_timestamp
row_count_below_minimum
unmapped_asset
contract_violation
freshness_sla_failed
blocking_quarantine_rows
source_rate_limited
```

Then attach details:

```json
{
  "event": "run_failed",
  "error_code": "blocking_quarantine_rows",
  "blocking_rows": 3,
  "quarantine_reasons": ["unmapped_asset"],
  "next": "review quarantine_records for run_id 2026-07-22T021500Z"
}
```

That `next` field is not fancy. It is useful. It gives the agent a bounded next command instead of a mystery.

## Logs should point to durable artifacts

A run log should not carry every payload.

It should point to the artifacts:

```json
{
  "event": "quarantine_written",
  "run_id": "2026-07-22T021500Z",
  "rows": 3,
  "artifact": "quarantine_records",
  "lookup": "run_id=2026-07-22T021500Z"
}
```

For local work, that artifact might be a SQLite table, a JSONL file, or an `agent-pipe` record set.

For warehouse work, it might be a table partition or dbt run result.

The log should be small enough to scan and rich enough to navigate.

## How agents consume run logs

Agents should not read raw logs line by line if the log is large.

They should query them.

Useful questions:

```text
show the latest failed run
group quarantine rows by failure reason
compare source counts with the previous successful run
find freshness checks that blocked agent use
list runs where BTC price data was stale
```

That works when logs are structured.

A simple local script can answer:

```javascript
const fs = require("fs");

const rows = fs.readFileSync("logs/runs.jsonl", "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse);

const failed = rows.filter(r => r.event === "run_failed").at(-1);
console.log(failed);
```

The important part is not JavaScript. It is the shape. Structured logs let tools compute answers instead of stuffing raw output into a model context.

## The minimum schema

Do not build a logging platform first.

Start with a file:

```text
logs/runs.jsonl
```

Use a small event envelope:

```json
{
  "ts": "2026-07-22T02:15:00Z",
  "run_id": "2026-07-22T021500Z",
  "pipeline": "market-pipe",
  "event": "source_completed",
  "level": "info"
}
```

Then add fields per event.

Keep field names stable. Prefer numbers for counts and durations. Prefer ISO timestamps. Prefer error codes over prose. Store payloads elsewhere and link to them.

That is enough for the first version.

## The practical rule

If a run matters, its log should be queryable.

Use JSONL. Put `run_id` everywhere. Record source counts, freshness checks, quarantine events, error codes, and retry actions. Keep the event stream small, structured, and linked to durable artifacts.

Humans debug faster that way. Agents stop guessing.

## References

- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
- [What Is ETL and ELT? When to Use One Over the Other](/posts/2026-07-21-what-is-etl-and-elt)
