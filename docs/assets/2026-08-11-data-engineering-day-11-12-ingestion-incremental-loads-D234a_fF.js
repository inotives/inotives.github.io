var e=`---
title: "Data Engineering in 30 Days, Days 11–12: Ingestion, Incremental Loads, and Trustworthy Retries"
date: 2026-08-11
tags: [data-engineering, learning-path, ingestion, incremental-loads]
summary: "Design reliable ingestion with full refreshes, incremental cursors, watermarks, idempotent writes, retries, late data, and run records that prove whether a dataset is complete."
series: data-engineering-in-30-days
---

An ingestion job can return HTTP 200, write rows, and still leave the dataset wrong. It may have skipped the second page of an API, advanced its cursor before the database committed, duplicated a retry, or missed records that arrived late. Data engineering begins when “the script ran” stops being the success condition.

Days 11–12 are about designing an ingestion process that can be rerun, inspected, and repaired. We will keep using market observations from external providers, but the same patterns apply to invoices, application events, customer exports, and vendor APIs.

## The outcome for these two days

By the end, you should be able to:

1. Choose between a full refresh and an incremental load.
2. Explain cursors, watermarks, pagination, and backfills.
3. Design an idempotent load that is safe to retry.
4. Handle late-arriving and updated records without silently losing history.
5. Record enough run information to distinguish a complete load from a merely successful request.

## 1. Ingestion is a contract between a source and your system

An ingestion process copies data across a boundary. That boundary has a source-specific contract:

\`\`\`text
What records can be requested?
How are they ordered?
How does pagination work?
Which field identifies a record?
Can a record change after it first appears?
How late can it arrive?
What does a retry return?
What rate limits and failure codes apply?
\`\`\`

Do not infer those answers from one successful request. Read the source documentation, retain raw responses, and test the behaviours that matter. A provider that returns “latest 100 trades” needs a different ingestion design from one that offers an immutable transaction ID and a \`created_after\` cursor.

For a price collector, define the intended input grain before writing the loader:

> One source record is one price observation from one provider for one market at one provider event time.

That sentence gives us a candidate idempotency key: \`(provider, market, observed_at)\`. It may need another source sequence or trade ID if the provider can publish multiple valid observations at the same timestamp.

## 2. Full refresh versus incremental load

A **full refresh** retrieves the complete available dataset and replaces or rebuilds a target. An **incremental load** retrieves only records that are new or changed since a saved position.

| Strategy | Good fit | Strength | Risk |
| --- | --- | --- | --- |
| Full refresh | Small reference data, a daily file, or a first backfill. | Simple to reason about; naturally corrects many past errors. | Can be slow, expensive, rate-limited, or disruptive at large volume. |
| Incremental load | Events, transactions, observations, and large histories. | Moves less data and can run frequently. | Requires correct state, deduplication, and late-data policy. |
| Hybrid | A frequent incremental job plus a periodic reconciliation. | Efficient most days and able to repair drift. | Needs two paths that agree on the same target model. |

For example, a list of supported markets might be fully refreshed every morning. It is small, and a provider can remove or rename a market. Price observations are append-heavy, so they should usually load incrementally every few minutes.

The word “replace” needs care. Replacing a target table directly can make it empty if the refresh fails halfway through. A safer pattern loads into a staging table, validates it, then swaps or publishes it only after the new version is complete.

## 3. A cursor is a promise about where to resume

An incremental loader needs a saved position. This is commonly called a **cursor**, **checkpoint**, or **watermark**.

The source may provide a cursor token:

\`\`\`text
GET /trades?cursor=eyJvZmZzZXQiOjEwMDAwfQ
\`\`\`

Or the loader may use a time or ID:

\`\`\`text
GET /observations?updated_after=2026-08-11T09:00:00Z
GET /transactions?after_id=482901
\`\`\`

The safest cursor is one the source guarantees is stable, ordered, and complete. An increasing transaction ID is often easier to reason about than a timestamp because several records can share a timestamp and clocks can disagree. Still, source-specific IDs can be reset, scoped to an account, or unavailable in historical endpoints. There is no generic cursor that is correct everywhere.

Store the state as data, not as a hard-coded constant in a script:

\`\`\`text
ingestion_checkpoint
┌──────────────────────────┬────────────────────────────┬─────────────────────┐
│ source                   │ cursor_value               │ committed_at        │
├──────────────────────────┼────────────────────────────┼─────────────────────┤
│ binance_price_observation│ 2026-08-11T09:00:00Z       │ 2026-08-11T09:01:04Z│
└──────────────────────────┴────────────────────────────┴─────────────────────┘
\`\`\`

The key rule is simple: advance the checkpoint only after the corresponding records are safely committed to the target. If a job stores \`09:05\` first and then crashes before the rows are written, the next run starts after \`09:05\` and creates a permanent hole.

## 4. Watermarks need an overlap window

Time-based cursors are common and useful, but they carry edge cases. A record created at \`09:00:00\` can arrive at \`09:04\`, be corrected at \`09:10\`, or be returned out of order by a paginated API.

Instead of asking for records strictly after the last watermark, re-read a small overlap window:

\`\`\`text
last committed watermark: 09:00
overlap: 10 minutes
next request starts at: 08:50
\`\`\`

The load will see some old records again. That is expected. Deduplication or upsert logic makes the overlap safe; the overlap makes late data less likely to disappear.

\`\`\`sql
INSERT INTO raw.price_observation (
  provider, symbol, observed_at, price, received_at
)
VALUES (
  'Binance', 'BTC/USDT', '2026-08-11 09:00:00+00', 118450.25,
  '2026-08-11 09:04:00+00'
)
ON CONFLICT (provider, symbol, observed_at)
DO UPDATE SET
  price = EXCLUDED.price,
  received_at = EXCLUDED.received_at;
\`\`\`

This is an example, not a universal conflict policy. If the old and new prices differ, overwriting may hide a source correction or a provider disagreement that deserves to be recorded. Some domains need an append-only raw table plus a separately derived “latest version” model. The policy should follow the source contract and audit requirement.

## 5. Idempotency makes retries safe

An operation is **idempotent** when running it more than once produces the intended final state. Networks fail after a source has responded but before the client records success. Jobs can crash after a database commit but before updating their run status. Retries are normal, so duplication must not be.

For a record load, idempotency usually comes from a stable key plus a database constraint:

\`\`\`sql
ALTER TABLE raw.price_observation
ADD CONSTRAINT price_observation_source_key
UNIQUE (provider, symbol, observed_at);
\`\`\`

Then the loader can use one of three explicit policies:

| Policy | Meaning | Use when |
| --- | --- | --- |
| Ignore duplicate | Keep the first version. | The source record is immutable and duplicates are retransmissions. |
| Upsert | Insert new records; update the current version of known records. | The source legitimately corrects records and the latest version is what consumers need. |
| Append versions | Store every received version and identify the current one later. | Auditability and source-change history matter. |

Never use “delete the date and reload it” as a casual retry strategy. It can erase records that arrived through another path or create a moment where consumers see no data. A scoped backfill with an explicit target and validation is safer.

## 6. Pagination is part of completeness

Many APIs return only one page. A request that returns 100 rows may mean there are exactly 100 records, or it may mean there are 10,000 records and 9,900 are still behind a \`next_cursor\`.

Treat pagination as a loop over a stable request boundary:

\`\`\`text
1. Choose the cursor or time range for this run.
2. Request one page.
3. Retain the raw response and load its records idempotently.
4. Continue using the source's next-page token.
5. Stop only when the source says there is no next page.
6. Commit the run and advance the checkpoint.
\`\`\`

Do not advance the high-water mark to the timestamp in the first page if later pages may contain records from the same or earlier time. Record the complete page chain and the final source cursor. If the API's ordering guarantee is weak, choose a wider overlap and reconcile with periodic full-range checks.

## 7. A retry is not the same as a new run

Retry only failures that may succeed if attempted again: a timeout, connection reset, HTTP 429 rate limit, or many server-side 5xx responses. A 401 authentication error, a 400 invalid request, or a schema mismatch usually needs a configuration or code change, not ten more attempts.

Use bounded exponential backoff with jitter. The exact formula matters less than the behaviour: wait longer after repeated transient failures, avoid every worker retrying at the same instant, and stop after a defined limit.

\`\`\`text
attempt 1: wait a short random delay
attempt 2: wait longer
attempt 3: wait longer again
then: mark the run failed and alert with source, cursor, and error details
\`\`\`

Retries must use the same idempotency key and load policy as the first attempt. Otherwise a reliable retry loop merely creates reliable duplicates.

## 8. Record the run alongside the rows

The target table tells you what was loaded. A **run record** tells you what the job attempted and whether its completeness claim is credible.

\`\`\`text
ingestion_run
├── run_id
├── source
├── started_at and finished_at
├── requested_cursor_start and cursor_end
├── pages_requested
├── records_received, inserted, updated, rejected
├── raw_payload_locations
├── status: succeeded, failed, partial, or backfill
└── error_summary
\`\`\`

This makes investigations concrete. If an analyst notices missing prices from 09:00–09:15, you can see whether the run failed, whether the provider returned no records, whether a page was rejected, or whether a transformation filtered the rows later.

“Succeeded” should mean the job reached its designed completion condition, not merely that one HTTP call returned without an exception. A run that fetched three of four required pages should be \`partial\` or \`failed\`, even if its first request succeeded.

## A small exercise for day 12

Design an ingestion state table and run record for one source. You do not need a live API. Use a small CSV or JSON file split into three pretend pages.

\`\`\`text
1. Choose the source record grain and an idempotency key.
2. Pick a full-refresh, incremental, or hybrid strategy and explain why.
3. Define the checkpoint value and when it becomes committed.
4. Re-run page two deliberately. Show that the target remains correct.
5. Add one late record from before the checkpoint. Decide how the overlap window catches it.
6. Produce a run record with received, inserted, duplicate, and rejected counts.
\`\`\`

The exercise is complete when you can explain what happens after a crash at each point: before raw retention, after raw retention, after row loading, and after checkpoint advancement.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Ingestion | Moving source data into a system where it can be retained and used. | \`Explain ingestion using a crypto-price API. Separate source fetch, raw retention, parsing, validation, loading, and run tracking.\` |
| Full refresh | Rebuilding a complete target from all available source data. | \`Compare a full refresh with an incremental load for a daily product catalog and for hourly price observations.\` |
| Incremental load | Loading only data that is new or changed since a previous run. | \`Design an incremental loader for a paginated transaction API. State the assumptions required for the cursor to be safe.\` |
| Cursor | A source-provided position used to resume reading. | \`Explain cursor pagination and cursor checkpoints. What goes wrong if a job saves its cursor before its database transaction commits?\` |
| Watermark | A boundary, often a time, that marks how far a pipeline has processed. | \`Teach time-based watermarks with late-arriving price observations. Show why an overlap window is needed.\` |
| High-water mark | The greatest source position safely committed by a pipeline. | \`Explain high-water marks using increasing transaction IDs and timestamps. Which is easier to make correct and why?\` |
| Idempotency | Repeat execution reaches the same intended state. | \`Show three ways to make an API ingestion retry idempotent: unique keys, upserts, and append-only versions.\` |
| Upsert | Insert a new record or update an existing conflict. | \`Explain PostgreSQL ON CONFLICT for a price-observation loader. When can an upsert hide important source history?\` |
| Pagination | Reading a complete result set through several API responses. | \`Teach pagination failure modes. Show how advancing a checkpoint after page one can lose records on page two.\` |
| Backfill | Loading historical data that was missed or intentionally deferred. | \`Design a safe backfill for one week of missing market prices without damaging normal incremental ingestion.\` |
| Late-arriving data | A record received after the period where it logically belongs. | \`Explain event time, receipt time, and late data using a provider outage. Show how a mart should be revised.\` |
| Reconciliation | Comparing source and target to find or repair divergence. | \`Explain how a weekly reconciliation complements incremental ingestion. Give count and checksum examples.\` |

When using an LLM to design ingestion, include the source's ordering guarantee, pagination behaviour, update semantics, and retention window. The correct answer for an append-only transaction log can be unsafe for a mutable API that only exposes “recently updated” records.

## What comes next

Days 13–15 move from safely captured records to data modelling. We will define entities, relationships, normalisation, facts, dimensions, and the raw-to-staging-to-mart layers that let downstream consumers use data without inheriting every source quirk.

## References

- [PostgreSQL documentation: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL documentation: INSERT and ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html)
- [PostgreSQL documentation: transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [RFC 9110: HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110)
`;export{e as default};