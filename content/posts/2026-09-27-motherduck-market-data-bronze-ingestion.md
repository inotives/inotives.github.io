---
title: "From a data dump to Bronze: a guarded local market-data ingestion path"
date: 2026-09-27
tags: [data-engineering, duckdb, motherduck, parquet, dbt, crypto-data]
summary: "Build the first guarded warehouse slice locally: land a versioned market-data dump, validate its contract, quarantine bad batches, and retain provenance in Bronze."
series: building-motherduck-warehouse
---

The first article set up the local-first shape of the warehouse. This one makes it earn its keep.

Our initial data dump has two Parquet files. `coins` is the reference list. `market_data` is the changing price and supply data. The job is to accept a coherent batch, reject a broken one with evidence, and leave enough provenance in Bronze to explain a number later.

![A local pipeline lands a coins and market_data Parquet data dump in a simulated S3 folder, validates it, routes failures to quarantine, and sends valid tables to DuckDB Bronze then dbt Silver and a daily market-data mart.](/assets/images/motherduck-market-data-validation-pipeline-v2.png)

## Keep the first boundary local

Use local directories to simulate S3 before adding AWS permissions, a Prefect worker, or a MotherDuck token. The behaviour that matters is the same: a source file is immutable after landing; a failed batch does not reach Bronze; an accepted batch has a traceable source path.

```text
data/
  dumps/
    2026-09-27T090000Z/
      coins.parquet
      market_data.parquet
  landing/
    2026-09-27T090000Z/
      coins.parquet
      market_data.parquet
  quarantine/
    2026-09-27T090000Z/
      reason.json
      coins.parquet
      market_data.parquet
```

The timestamped directory is the batch identifier. It is enough for the POC. Do not build a batch-control service before one dump has successfully travelled through this path.

## Land the dump without changing it

The producer delivers Parquet. Keep it that way. The local landing step is a copy into the immutable batch directory; in AWS, the same boundary becomes an S3 prefix.

```bash
batch_id=2026-09-27T090000Z
mkdir -p "data/landing/$batch_id"
cp "data/dumps/$batch_id/coins.parquet" "data/dumps/$batch_id/market_data.parquet" "data/landing/$batch_id/"
```

The landing copy is deliberately boring. Parquet is already the contract boundary for the rest of the flow, and the later S3 path can preserve the exact same files.

## The contract is small, but it needs a few hard edges

The `coins` dataset has `id` (int), `uniq_key` (string), and `name` (string). `market_data` has `coin_uniq_key` (string); `time_open`, `time_close`, `time_high`, `time_low`, and `timestamp` (timestamp); `name` (string); and `open`, `high`, `low`, `close`, `volume`, `market_cap`, and `circulating_supply` (decimal).

Start with these rules:

- Both files must contain at least one row and every listed column.
- `coins.uniq_key` is unique and non-null.
- Every `market_data.coin_uniq_key` resolves to `coins.uniq_key` in the same batch.
- Price, volume, market cap, and circulating supply parse as decimals. The four price fields and volume cannot be negative.
- Timestamps parse. Bronze retains all five timestamp fields exactly as supplied.

The final point is intentional. `timestamp` might be an observation time, an export time, or a provider-specific field. The four `time_*` values describe a market interval. Do not silently choose one as the analytical grain because its name looks convenient. Load them all into Bronze, then make the Silver model name the chosen grain and test it.

The cross-file check is the first one that catches an expensive class of error: files that each look valid alone but do not belong together.

```sql
SELECT md.coin_uniq_key
FROM read_parquet('data/landing/2026-09-27T090000Z/market_data.parquet') AS md
LEFT JOIN read_parquet('data/landing/2026-09-27T090000Z/coins.parquet') AS c
  ON c.uniq_key = md.coin_uniq_key
WHERE c.uniq_key IS NULL;
```

Any returned row fails the batch. A missing coin is not a null you can tidy up in a dashboard.

## Quarantine the batch, not a handful of rows

For the first slice, fail the whole pair of files. It keeps the source relationship intact and makes the operator's decision obvious: fix and resend the batch, or explicitly change the contract.

Write a small reason record beside the copied Parquet files:

```json
{
  "batch_id": "2026-09-27T090000Z",
  "status": "quarantined",
  "failed_checks": ["market_data.coin_uniq_key has no matching coins.uniq_key"],
  "source_files": ["coins.parquet", "market_data.parquet"]
}
```

This is a POC policy, not a universal ingestion rule. Later, a feed with independent tables may need file-level acceptance. Start by preserving correctness. A partial load is harder to notice and harder to repair.

## Bronze should answer where a value came from

When the batch passes, append it to Bronze and add two warehouse-owned fields:

```text
_ingested_at   timestamp of the successful load
_source_file   landed Parquet path
```

Store those fields on both `bronze.coins` and `bronze.market_data`. They make a late question answerable: "Which source file produced this market-cap value?"

Do not use `id` as the relationship between the two tables. The contract names `coin_uniq_key` and `uniq_key` as the shared key, so that is the join to enforce. `id` remains a source attribute unless the source contract says otherwise.

The loader also needs one idempotency check: do not ingest the same landed path twice. For the POC, querying Bronze for `_source_file` before appending is enough. A production version can replace that with a batch ledger or an object-version identifier when retries and concurrent workers make path-only checks insufficient.

## The first Silver model should settle one question

Bronze preserves what arrived. Silver gives a stable analytical meaning to it.

The first model should decide the observation grain in plain language. For example: one row per `coin_uniq_key` and `time_open`, with the latest source record winning if the provider sends a correction. That is a reasonable convention only after checking a real sample. If the provider treats `timestamp` as the authoritative observation time instead, use that and say so in the model name and tests.

Do not write a dashboard yet. First run one batch that passes and one that fails because `market_data` has an unknown `coin_uniq_key`. Then inspect Bronze for `_source_file` and confirm that the rejected batch is absent. Those two runs prove the part of the warehouse that prevents quiet bad data.

## What this leaves for the next slice

The local flow establishes the durable rules: Parquet landing files, batch-level validation, quarantine evidence, and Bronze provenance. The next article can turn this into a small executable flow and dbt project, then run the exact same contract against a MotherDuck development database.

## References

- [DuckDB Parquet documentation](https://duckdb.org/docs/stable/data/parquet/overview.html)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
