---
title: "Auditable Database Design for Financial Data"
date: 2026-07-25
tags: [postgres, database-design, audit-trails, financial-data, compliance, data-engineering]
series: data-engineering
summary: "Financial data needs more than clean tables. It needs audit trails: created and updated metadata, soft deletes, version history, actor tracking, run IDs, and database-level guardrails that make regulatory reports explainable later."
---

# Auditable Database Design for Financial Data

Financial data should be designed as if someone will ask, months later, why a number changed.

Not "what is the current balance?"

Why did it change? Who changed it? Was it corrected or deleted? Which pipeline run loaded it? Which report used the old version? Can we prove the filing was built from the data that existed at the time?

That is the difference between a normal analytics database and a database that can support regulatory reporting.

For crypto data, this matters even more. Asset mappings change. Tokens migrate. Providers revise payloads. Backfills rewrite historical rows. Bad records get quarantined, reviewed, and sometimes corrected. If the database only stores the latest state, the audit story disappears.

The fix starts with boring table design.

## Every important table needs audit columns

For tables that affect financial reports, I want audit columns by default:

```sql
created_at timestamptz not null default now(),
created_by text not null default current_user,
updated_at timestamptz not null default now(),
updated_by text not null default current_user,
deleted_at timestamptz,
deleted_by text
```

That covers the basic lifecycle:

```text
created_at/by   who inserted the row
updated_at/by   who last changed the row
deleted_at/by   who soft-deleted the row
```

Use `timestamptz`, not `timestamp`, so the value has clear timezone semantics.

For pipeline-loaded data, add pipeline context too:

```sql
source_system text not null,
source_run_id text not null,
source_record_id text,
source_observed_at timestamptz,
ingested_at timestamptz not null default now()
```

Those fields answer a different question: where did this row come from?

Both sets matter. `created_at` tells you when the database row was created. `source_observed_at` tells you when the provider observed the fact. `source_run_id` tells you which pipeline run loaded it.

Do not collapse those into one timestamp.

## Use database triggers for the boring parts

Application code should not need to remember to set `updated_at` every time.

Postgres can do that.

Here is a small trigger function for update metadata:

```sql
create or replace function audit_set_updated_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(current_setting('app.actor', true), current_user);
  return new;
end;
$$;
```

Apply it to a table:

```sql
create trigger trg_asset_mappings_set_updated
before update on asset_mappings
for each row
execute function audit_set_updated_fields();
```

Then the application or pipeline can set the actor for the transaction:

```sql
select set_config('app.actor', 'pipeline:coingecko:run_20260725_0900', true);
```

For a human review tool, the actor might be:

```sql
select set_config('app.actor', 'user:alice@example.com', true);
```

This keeps the audit fields consistent without spreading timestamp code across every service, script, and agent tool.

## Soft deletes preserve the story

Hard deletes are dangerous for financial data.

Sometimes you need them for retention rules or privacy obligations. For reporting facts, mappings, review items, and corrections, the safer default is soft delete.

A soft-deleted row stays in the table:

```sql
deleted_at = now()
deleted_by = 'user:alice@example.com'
```

Normal queries filter it out:

```sql
where deleted_at is null
```

But auditors and investigation tools can still answer what happened.

You usually do not need a separate `is_deleted` flag. `deleted_at` is already the state:

```text
deleted_at is null      active row
deleted_at is not null  deleted row
```

Keeping both `is_deleted` and `deleted_at` creates duplicate truth. Eventually someone writes one without the other, then every query has to decide which column to trust.

If active-row lookup needs help, use a partial index:

```sql
create index asset_mappings_active_provider_idx
on asset_mappings (provider, provider_asset_id)
where deleted_at is null;
```

If an application truly needs a boolean, make it generated from `deleted_at`:

```sql
alter table asset_mappings
add column is_deleted boolean
generated always as (deleted_at is not null) stored;
```

That keeps `deleted_at` as the source of truth.

Create a helper function:

```sql
create or replace function soft_delete_asset_mapping(
  p_mapping_id bigint,
  p_reason text
)
returns void
language plpgsql
as $$
begin
  update asset_mappings
     set deleted_at = now(),
         deleted_by = coalesce(current_setting('app.actor', true), current_user),
         deletion_reason = p_reason
   where mapping_id = p_mapping_id
     and deleted_at is null;

  if not found then
    raise exception 'asset mapping % not found or already deleted', p_mapping_id;
  end if;
end;
$$;
```

Add the reason column:

```sql
alter table asset_mappings
add column deletion_reason text;
```

In crypto analytics, this is useful for delistings, provider mapping cleanup, retired manual overrides, and invalid reference data.

The row should disappear from current marts. It should not disappear from history.

## Version rows when meaning can change

Audit columns tell you who changed a row.

Versioning tells you what the row used to mean.

For financial and regulatory reporting, versioning matters whenever historical interpretation depends on a record:

```text
asset mappings
platform mappings
account ownership
portfolio membership
manual valuation overrides
report classifications
regulatory categories
```

One common pattern is effective dating:

```sql
create table asset_mappings (
  mapping_id bigserial primary key,
  canonical_asset_id text not null,
  provider text not null,
  provider_asset_id text not null,
  chain_id integer,
  contract_address text,
  effective_from timestamptz not null,
  effective_to timestamptz,
  mapping_status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by text not null default coalesce(current_setting('app.actor', true), current_user),
  updated_at timestamptz not null default now(),
  updated_by text not null default coalesce(current_setting('app.actor', true), current_user),
  deleted_at timestamptz,
  deleted_by text,
  deletion_reason text,
  source_run_id text,
  constraint asset_mappings_effective_range
    check (effective_to is null or effective_to > effective_from)
);
```

For the current version, `effective_to` is null. When the mapping changes, close the old row and insert a new row:

```sql
begin;

select set_config('app.actor', 'user:data-reviewer@example.com', true);

update asset_mappings
   set effective_to = timestamptz '2026-07-25 00:00:00+00',
       mapping_status = 'replaced'
 where mapping_id = 42
   and effective_to is null
   and deleted_at is null;

insert into asset_mappings (
  canonical_asset_id,
  provider,
  provider_asset_id,
  chain_id,
  contract_address,
  effective_from,
  mapping_status,
  source_run_id
) values (
  'usd-coin',
  'coingecko',
  'usd-coin',
  1,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  timestamptz '2026-07-25 00:00:00+00',
  'active',
  'manual_review_20260725'
);

commit;
```

Now old reports can still use the mapping that was true at report time. New reports get the new mapping.

That is point-in-time correctness in table form.

## Keep an audit history table for sensitive changes

Audit columns show the latest metadata. They do not show every previous value.

For sensitive tables, add a history table.

Example:

```sql
create table asset_mappings_history (
  history_id bigserial primary key,
  audit_action text not null,
  audit_at timestamptz not null default now(),
  audit_by text not null default coalesce(current_setting('app.actor', true), current_user),
  mapping_id bigint not null,
  old_row jsonb,
  new_row jsonb
);
```

Then create a trigger:

```sql
create or replace function audit_asset_mappings_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into asset_mappings_history (audit_action, mapping_id, old_row, new_row)
    values ('insert', new.mapping_id, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into asset_mappings_history (audit_action, mapping_id, old_row, new_row)
    values ('update', new.mapping_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into asset_mappings_history (audit_action, mapping_id, old_row, new_row)
    values ('delete', old.mapping_id, to_jsonb(old), null);
    return old;
  end if;

  raise exception 'unsupported audit operation %', tg_op;
end;
$$;
```

Attach it:

```sql
create trigger trg_asset_mappings_history
after insert or update or delete on asset_mappings
for each row
execute function audit_asset_mappings_history();
```

Even if the normal application uses soft deletes, keeping the delete branch is useful. It catches accidental hard deletes and makes them visible.

For high-volume fact tables, full JSONB row history may be too expensive. Use it where meaning changes matter most: mappings, classifications, overrides, report metadata, review decisions, and filing inputs.

## Regulatory reports need report snapshots

Audit trails on source tables are not enough.

A regulatory filing should be reproducible from a report snapshot:

```sql
create table regulatory_report_runs (
  report_run_id text primary key,
  report_name text not null,
  report_period_start date not null,
  report_period_end date not null,
  generated_at timestamptz not null default now(),
  generated_by text not null default coalesce(current_setting('app.actor', true), current_user),
  source_run_ids text[] not null,
  dbt_invocation_id text,
  git_commit_sha text,
  status text not null,
  submitted_at timestamptz,
  submitted_by text,
  filing_reference text
);
```

Then store the line items used for the filing:

```sql
create table regulatory_report_line_items (
  report_run_id text not null references regulatory_report_runs(report_run_id),
  line_number text not null,
  canonical_asset_id text,
  amount_usd numeric(38, 8) not null,
  source_mart text not null,
  source_record_ids text[] not null,
  calculation_version text not null,
  created_at timestamptz not null default now(),
  primary key (report_run_id, line_number, canonical_asset_id)
);
```

This is the table you want when someone asks:

```text
Which data produced the filed number?
Which pipeline runs fed it?
Which code version generated it?
Was the report submitted before or after a correction?
```

Do not rely on rerunning today's pipeline to reconstruct yesterday's filing. Store the report inputs that mattered.

## Make agents use the audit trail

Agents should not treat audit fields as decoration.

If an agent is allowed to inspect financial data, the data model should let it answer:

```text
Who changed this row?
When was it changed?
Was it soft-deleted?
Which run created it?
Which version was active at report time?
Which report used it?
What changed between two report versions?
```

That means agent-facing marts should carry audit and lineage fields where useful:

```text
source_run_id
source_record_id
mapping_version
report_run_id
created_at
updated_at
deleted_at
freshness_status
quality_status
```

The agent does not need every internal audit column in every response. It does need enough metadata to refuse weak answers and trace important numbers.

For example, if a user asks why a reported exposure changed, the agent should compare report snapshots and mapping versions, not query the latest balance table and guess.

## The practical rule

Design financial tables so change is explainable.

At minimum:

```text
created_at/by
updated_at/by
deleted_at/by
source system
source run ID
source record ID
effective dates for versioned meaning
history table for sensitive changes
report snapshots for filed numbers
```

This is not bureaucracy. It is the difference between "the number is different now" and "here is exactly why the filed number was different."

For regulatory reporting, that difference matters.

## References

- [Point-in-Time Correctness in Crypto Analytics](/posts/2026-07-24-point-in-time-correctness-crypto-analytics)
- [Backfills Without Breaking Crypto Reports](/posts/2026-07-23-backfills-without-breaking-crypto-reports)
- [Data Lineage for Small Crypto Pipelines](/posts/2026-07-24-data-lineage-small-crypto-pipelines)
- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [PostgreSQL CREATE TRIGGER documentation](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [PostgreSQL PL/pgSQL trigger functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
