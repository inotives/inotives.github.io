---
title: "The Crypto Asset Mapping Table"
date: 2026-07-21
tags: [crypto, data-engineering, asset-identity, data-quality, dbt, market-data]
series: data-engineering
summary: "A crypto asset mapping table is the small piece of boring infrastructure that keeps symbols, provider IDs, chain IDs, contract addresses, migrations, and delistings from turning into bad joins."
---

# The Crypto Asset Mapping Table

Once you accept that crypto symbols are not IDs, the next question is annoying and necessary.

What should be the ID?

The answer is not CoinGecko's ID. It is not a ticker. It is not a bare contract address. It is not whatever the first exchange happened to call the asset.

The answer is a mapping table.

That sounds painfully boring. Good. The mapping table is where a crypto data pipeline stops guessing.

## The problem it solves

Every source names assets differently.

CoinGecko might call Bitcoin `bitcoin`. An exchange might call it `BTC` or `XBT`. A wallet provider might report a native chain asset. A token list might report a contract address. A compliance vendor might use its own internal asset code.

Those identifiers are all useful inside their own source. None of them should automatically become the warehouse identity.

The mapping table sits between provider truth and your internal truth:

```text
provider data -> provider mapping -> canonical asset
```

That one hop gives the rest of the pipeline a stable join key.

## The two tables I would start with

Do not start with a graph of every token relationship in the universe.

Start with two tables.

```text
assets
asset_provider_mappings
```

`assets` is the canonical table:

```text
canonical_asset_id
display_symbol
display_name
asset_type
status
created_at
updated_at
```

`asset_provider_mappings` connects external identifiers to that canonical asset:

```text
canonical_asset_id
provider
external_id
external_symbol
chain_id
contract_address
effective_from
effective_to
mapping_status
notes
```

That is enough for the first version.

If the project later needs issuer data, bridge relationships, risk categories, or instrument-level pricing, add tables then. Do not build that on day one.

## Canonical IDs should be yours

The canonical ID should be controlled by your system.

Use something stable and boring:

```text
asset_btc
asset_eth
asset_usdc
asset_wbtc
```

Do not use the symbol alone. Do not use the provider ID alone. Do not use a database integer that becomes meaningless outside the database if these IDs appear in logs, contracts, exported files, or agent responses.

The canonical ID is the thing marts should join on.

The display symbol is the thing humans should read.

## Provider mappings need scope

A provider mapping without scope is how bugs come back.

This is too vague:

```text
external_id: bitcoin
symbol: BTC
```

This is useful:

```text
provider: coingecko
external_id: bitcoin
external_symbol: btc
canonical_asset_id: asset_btc
effective_from: 2013-04-28
effective_to: null
```

For on-chain tokens, include the chain:

```text
provider: token-list
chain_id: 1
contract_address: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
external_symbol: USDC
canonical_asset_id: asset_usdc
```

The chain is not decoration. `USDC` on Ethereum, Base, Solana, and other networks may represent related exposure, but they are not the same row at the token identity layer.

You can roll them up later. Keep the raw distinction first.

## Effective dates are not optional

Crypto assets change.

Tokens migrate. Projects rebrand. Exchanges delist and relist. Providers merge records or split them. A contract gets replaced. A ticker changes after a community vote.

If the mapping table only stores the latest truth, historical reports become unstable.

Use validity windows:

```text
effective_from
effective_to
```

When a mapping changes, close the old row and insert a new one. Do not overwrite history.

Historical joins should use the observation time:

```sql
select
  p.observed_at,
  m.canonical_asset_id,
  p.price_usd
from stg_provider_prices p
join asset_provider_mappings m
  on p.provider = m.provider
 and p.external_id = m.external_id
 and p.observed_at >= m.effective_from
 and (m.effective_to is null or p.observed_at < m.effective_to)
```

That looks more annoying than a current-state join. It is also the difference between a report that preserves history and a report that rewrites it.

## Delistings should not delete identity

Delisted assets are still real for historical reporting.

If an exchange delists a token, the asset should not disappear from the warehouse. Balances, trades, compliance events, old prices, and tax reports may still refer to it.

Use status fields:

```text
active
delisted
migrated
deprecated
quarantined
```

A delisted asset may be hidden from current trading screens. It should remain queryable in historical marts.

This is another place where agents need clear metadata. If an agent explains old exposure, it should know whether the asset is active, delisted, or migrated. Otherwise it may describe a dead token as if it is still current.

## Quarantine unmapped assets

Unmapped assets should not quietly flow into marts.

If a source sends an asset the pipeline cannot map, keep the raw row and write a quarantine record:

```text
run_id
provider
external_id
external_symbol
chain_id
contract_address
reason: no_mapping_found
first_seen_at
sample_payload
```

Then fail or warn based on the dataset.

For a portfolio report, unmapped balances should usually block publish. For a broad discovery table, they may become a review queue.

The important rule is simple: unknown identity must stay visible. Dropping unmapped rows is how reconciliation bugs become mysteries.

## The dbt checks I would add

The mapping table needs tests because a bad mapping is worse than no mapping.

Start with these:

- `canonical_asset_id` is not null
- `provider` and `external_id` are not null
- `canonical_asset_id` exists in `assets`
- active mappings do not overlap for the same provider and external id
- contract-address mappings include chain id
- `effective_to` is after `effective_from`

The overlap test is the important one:

```sql
select
  a.provider,
  a.external_id,
  a.effective_from,
  a.effective_to,
  b.effective_from as overlapping_from,
  b.effective_to as overlapping_to
from {{ ref('asset_provider_mappings') }} a
join {{ ref('asset_provider_mappings') }} b
  on a.provider = b.provider
 and a.external_id = b.external_id
 and a.effective_from < coalesce(b.effective_to, timestamp '9999-12-31')
 and b.effective_from < coalesce(a.effective_to, timestamp '9999-12-31')
 and a.effective_from <> b.effective_from
```

If that returns rows, the pipeline has two truths for the same provider asset at the same time.

Fix that before trusting the mart.

## What agents should see

Agents should not be handed a pile of provider-specific names and asked to infer identity.

Give them the canonical shape:

```json
{
  "canonical_asset_id": "asset_usdc",
  "display_symbol": "USDC",
  "display_name": "USD Coin",
  "status": "active",
  "provider": "coingecko",
  "external_id": "usd-coin",
  "chain_id": 1,
  "contract_address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
}
```

Schema descriptions should say the rule out loud:

```text
display_symbol is for display only. Use canonical_asset_id for joins.
```

That one sentence prevents a surprising amount of bad agent SQL.

## The practical rule

Every crypto pipeline needs a place where source-specific asset names become internal asset identity.

Make that place explicit. Keep provider IDs scoped. Include chain IDs for tokens. Store effective dates. Preserve delisted assets. Quarantine what does not map.

The table will be small at first. That is fine.

Small and explicit beats clever and implied.

## References

- [CAIP-2: Blockchain ID Specification](https://chainagnostic.org/CAIPs/caip-2)
- [CAIP-19: Asset Type and Asset ID Specification](https://chainagnostic.org/CAIPs/caip-19)
- [CoinGecko API documentation](https://docs.coingecko.com/reference/introduction)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [Data Contracts: The API Layer Your Crypto Pipeline Is Missing](/posts/2026-07-18-data-contracts-crypto-pipelines)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
