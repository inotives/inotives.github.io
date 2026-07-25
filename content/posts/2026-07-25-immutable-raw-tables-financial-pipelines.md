---
title: "Immutable Raw Tables for Financial Pipelines"
date: 2026-07-25
tags: [data-engineering, financial-data, audit-trails, postgres, crypto, compliance]
series: data-engineering
summary: "Raw financial data should be append-only evidence. Immutable raw tables preserve provider payloads, hashes, run IDs, correction rows, and replay inputs so reports can be explained months later."
---

# Immutable Raw Tables for Financial Pipelines

Raw financial data should be hard to edit.

Not inconvenient. Hard.

If a pipeline stores prices, balances, trades, asset mappings, or report inputs that may feed a regulatory filing, the raw layer is evidence. It is not a scratch table. It is not the place to clean up mistakes. It is not the place to quietly overwrite yesterday's row because today's parser got smarter.

Raw tables should be append-only.

When a provider sends a row, store what arrived. If the provider sends a corrected row later, store that too. If your pipeline made a mistake, write a correction record or fix the staging logic and replay from raw. Do not mutate the original evidence.

This is boring database design, but it changes the audit story.

## Raw is evidence, staging is interpretation

The raw layer should answer one question:

```text
What did we receive?
```

Staging answers a different question:

```text
How do we interpret what we received?
```

Marts answer a third:

```text
What should consumers use?
```

Do not mix those jobs.

For a crypto price pipeline, raw should keep the provider payload:

```json
{
  "id": "bitcoin",
  "symbol": "btc",
  "current_price": 118240.12,
  "last_updated": "2026-07-25T02:15:00Z"
}
```

Staging can turn that into typed fields:

```text
provider_asset_id = bitcoin
display_symbol = btc
price_usd = 118240.12
source_observed_at = 2026-07-25T02:15:00Z
```

The mart can join it to `canonical_asset_id = bitcoin`, check freshness, and expose a consumer-ready price.

If the raw row gets rewritten during that process, the evidence is gone. You no longer know whether the provider sent a bad value, the parser changed it, or a later job overwrote it.

## The raw table shape

For financial data, a useful raw table includes the payload plus enough metadata to prove where it came from:

```sql
create table raw_provider_records (
  raw_record_id bigserial primary key,
  provider text not null,
  source_name text not null,
  source_endpoint text not null,
  source_run_id text not null,
  source_record_id text,
  source_observed_at timestamptz,
  ingested_at timestamptz not null default now(),
  request_url text,
  request_params jsonb not null default '{}'::jsonb,
  response_status integer,
  payload jsonb not null,
  payload_sha256 text not null,
  record_status text not null default 'received',
  supersedes_raw_record_id bigint references raw_provider_records(raw_record_id),
  correction_reason text,
  created_at timestamptz not null default now(),
  created_by text not null default coalesce(current_setting('app.actor', true), current_user)
);
```

The important fields:

```text
source_run_id              Which pipeline run loaded this?
source_record_id           What identity did the provider expose?
source_observed_at         When did the provider say the fact was true?
ingested_at                When did we store it?
payload                    What did the provider send?
payload_sha256             Can we prove the payload did not change?
record_status              Is this received, corrected, superseded, or invalid?
supersedes_raw_record_id   Which raw row does this correction replace?
correction_reason          Why did we add the correction?
```

This is enough for replay and investigation without pretending raw is already clean.

## Hash the source payload

Payload hashes are cheap evidence.

When the pipeline writes raw data, hash the canonical payload string and store it:

```sql
create extension if not exists pgcrypto;

insert into raw_provider_records (
  provider,
  source_name,
  source_endpoint,
  source_run_id,
  source_record_id,
  source_observed_at,
  request_params,
  response_status,
  payload,
  payload_sha256
) values (
  'coingecko',
  'coins_markets',
  '/coins/markets',
  'run_20260725_0200',
  'bitcoin:2026-07-25T02:15:00Z',
  timestamptz '2026-07-25 02:15:00+00',
  '{"vs_currency":"usd","ids":"bitcoin"}',
  200,
  '{"id":"bitcoin","symbol":"btc","current_price":118240.12,"last_updated":"2026-07-25T02:15:00Z"}',
  encode(digest('{"id":"bitcoin","symbol":"btc","current_price":118240.12,"last_updated":"2026-07-25T02:15:00Z"}', 'sha256'), 'hex')
);
```

In application code, you may hash before sending the row to Postgres. That is fine. The point is to store the hash beside the payload.

Later, if someone asks whether a filed report was built from unchanged inputs, you can recompute hashes for the raw rows used by the report.

That does not prove the provider was correct. It proves your stored evidence did not silently change.

## Corrections should be new rows

Raw corrections should not update the old row.

Suppose a provider later revises a price. The bad pattern is:

```sql
update raw_provider_records
   set payload = '{"current_price":118420.55}'
 where raw_record_id = 1001;
```

Now the old evidence is gone.

The better pattern is to append a correction:

```sql
insert into raw_provider_records (
  provider,
  source_name,
  source_endpoint,
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
  '/coins/markets',
  'run_20260725_correction_01',
  'bitcoin:2026-07-25T02:15:00Z',
  timestamptz '2026-07-25 02:15:00+00',
  '{"id":"bitcoin","symbol":"btc","current_price":118420.55,"last_updated":"2026-07-25T02:15:00Z"}',
  encode(digest('{"id":"bitcoin","symbol":"btc","current_price":118420.55,"last_updated":"2026-07-25T02:15:00Z"}', 'sha256'), 'hex'),
  'correction',
  1001,
  'provider revised price after initial publication'
);
```

Staging decides which row wins:

```text
Use the latest correction for the same source_record_id.
Keep the original row available for audit.
Expose both when investigating report differences.
```

This is especially useful for exchange balances. If an exchange export omits a sub-account, do not overwrite the raw balance file after fixing the export. Store the original import, store the corrected import, and make the staging rule explicit.

## No updates means no quiet fixes

If raw tables are supposed to be immutable, enforce it.

Postgres can block updates and deletes:

```sql
create or replace function prevent_raw_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'raw table % is append-only; insert correction rows instead', tg_table_name;
end;
$$;

create trigger trg_raw_provider_records_no_update
before update or delete on raw_provider_records
for each row
execute function prevent_raw_mutation();
```

Now the database protects the rule.

If you need emergency maintenance, do it through a privileged role, a migration, and an audit note. Do not let normal pipelines, apps, or agents update raw facts.

This matters for local agents too. An agent with database access should not be able to "fix" raw rows. It can propose a correction row, create a review task, or rerun staging. It should not mutate evidence.

## Examples from crypto pipelines

Price data:

```text
Provider sends BTC price at 02:15.
Raw stores the full payload and hash.
Provider revises the price at 02:20.
Raw stores a correction row.
Staging picks the corrected row for current marts.
The report snapshot still records which raw row version fed the filed report.
```

Wallet balances:

```text
An on-chain balance job reads wallet balances at block 25,000,000.
Raw stores wallet, chain, block number, token contract, and payload.
A later backfill discovers the RPC response was incomplete.
Raw stores a new run with the corrected response.
Staging marks the earlier run as superseded for consumer models.
The original raw rows remain available for evidence.
```

Exchange CSV imports:

```text
A Coinbase export is imported on Monday.
The analyst realizes one account was missing.
The pipeline does not edit Monday's raw CSV rows.
It imports the corrected file as a new source_run_id.
The correction reason points to the missing account.
Marts rebuild from the accepted run.
```

Asset mappings:

```text
CoinGecko maps a provider asset ID to a canonical asset.
A token migration changes the mapping.
Raw provider metadata stays unchanged.
The mapping table gets a new effective-dated version.
Reports can still use the mapping that was true at report time.
```

In every case, raw preserves what arrived. Staging and marts decide what to use.

## Replay depends on immutable raw

Replay only works if the inputs are stable.

If you improve a parser, rebuild staging from raw.

If you fix an asset mapping, rebuild marts from staging and versioned mappings.

If you change a report calculation, create a new report version from the same raw inputs.

That is impossible if raw rows were overwritten during earlier fixes.

For regulatory filing, this matters because the question is often historical:

```text
What data did we have when the report was filed?
What correction arrived after filing?
Would the new correction change the report?
Did we submit an amended report?
```

Immutable raw tables let you answer those questions without guessing.

## Do not expose raw as the agent mart

Raw tables are valuable, but they are not the best default interface for agents.

Agents should usually query curated marts, freshness tables, lineage tables, and review queues. Raw is for replay and investigation.

A safe MCP tool might expose:

```text
get_raw_record(raw_record_id)
compare_raw_record_versions(source_record_id)
list_corrections_for_report(report_run_id)
verify_payload_hash(raw_record_id)
```

That is different from giving the agent broad SQL access to every raw table.

For financial pipelines, the agent should be able to trace evidence. It should not casually browse raw payloads full of provider quirks, account labels, or sensitive operational metadata.

## The practical rule

Raw financial tables should be append-only by default.

Use:

```text
payload JSON
payload hash
source run ID
source record ID
source observed timestamp
ingestion timestamp
correction rows
supersedes links
mutation-blocking triggers
report snapshots that point back to raw records
```

Do not update raw rows to make them cleaner. Do not delete raw rows to make reports easier. Do not let agents rewrite evidence.

Clean data belongs in staging and marts.

Raw data is what lets you prove how the clean data was made.

## References

- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [Auditable Database Design for Financial Data](/posts/2026-07-25-auditable-database-design-financial-data)
- [Point-in-Time Correctness in Crypto Analytics](/posts/2026-07-24-point-in-time-correctness-crypto-analytics)
- [Backfills Without Breaking Crypto Reports](/posts/2026-07-23-backfills-without-breaking-crypto-reports)
- [Data Lineage for Small Crypto Pipelines](/posts/2026-07-24-data-lineage-small-crypto-pipelines)
- [PostgreSQL pgcrypto documentation](https://www.postgresql.org/docs/current/pgcrypto.html)
- [PostgreSQL CREATE TRIGGER documentation](https://www.postgresql.org/docs/current/sql-createtrigger.html)
