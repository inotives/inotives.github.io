---
title: "Crypto Symbols Are Not IDs"
date: 2026-07-20
tags: [crypto, data-quality, asset-identity, data-engineering, market-data]
series: data-engineering
summary: "Crypto symbols are display labels, not durable identifiers. If a pipeline joins on BTC, ETH, USDT, or any other ticker, it is one token migration, chain collision, or provider mismatch away from producing clean-looking bad data."
---

# Crypto Symbols Are Not IDs

The fastest way to make a crypto data pipeline lie is to join on `symbol`.

It feels harmless at first. The source gives you `BTC`, `ETH`, `SOL`, `USDT`. Your balance table has the same values. Your price table has the same values. The join works. The chart loads.

Then you add another exchange, another chain, another provider, or another wrapped asset. Suddenly the same three-letter label is carrying too much meaning.

Symbols are for humans. IDs are for systems.

If that rule is not baked into the pipeline early, every downstream table inherits the ambiguity: dashboards, marts, reconciliation jobs, compliance reports, and agents.

## A symbol is a label

`BTC` is a good display label. It is not a complete identity.

It does not tell you which provider assigned it. It does not tell you which chain the asset lives on. It does not distinguish a native asset from a wrapped token. It does not tell you whether the symbol changed after a token migration. It does not tell you whether two unrelated assets reused the same ticker.

This gets worse with stablecoins and bridged assets. `USDT` can mean different contracts on Ethereum, Tron, Solana, Arbitrum, BNB Chain, and more. The symbol is the same because humans expect the label to look familiar. The asset identity is not the same.

The right mental model is simple:

```text
symbol = display metadata
provider_id = source-specific identity
chain_id + contract_address = on-chain token identity
canonical_asset_id = internal identity your pipeline controls
```

Those fields can point to the same economic asset, but they are not the same field.

## Provider IDs are better, but still not final

CoinGecko has asset IDs. CoinMarketCap has different IDs. Exchanges have their own instrument names. Wallet providers may report chain-specific token contracts. Custody systems may use internal asset codes.

Provider IDs are useful because they are more stable than symbols inside one source. `bitcoin` from CoinGecko is a better join key than `BTC` when you are working inside CoinGecko data.

But provider IDs are still scoped.

`coingecko_id = bitcoin` is not a universal asset id. It means "CoinGecko's record for Bitcoin." That is enough for a staging model. It is not enough for a warehouse mart that combines vendors.

The clean pattern is to keep provider identity explicit:

```text
provider: coingecko
external_id: bitcoin
symbol: btc
name: Bitcoin
```

Then map it into your own canonical asset table:

```text
canonical_asset_id: asset_btc
provider: coingecko
external_id: bitcoin
effective_from: 2013-04-28
effective_to: null
```

That mapping table is boring. It is also where the pipeline stops guessing.

## Chain identity changes the key

For tokens, a contract address without a chain is incomplete.

The same address can appear on different chains. The same symbol can map to many contracts. Native assets may not have a contract address at all. Bridged assets can represent exposure to the same underlying asset while still being separate tokens with separate risk.

So the key for an on-chain token should include chain identity:

```text
chain_id + contract_address
```

For EVM chains, `chain_id` should be the numeric chain id, not a display name like `ethereum` or `mainnet`. For non-EVM chains, use the equivalent stable network identifier your system has agreed to use.

This is one place where being precise saves real cleanup later. If `USDC` on Ethereum, Base, and Solana all collapse into one row too early, you have destroyed information the business may need for reconciliation, compliance, and risk analysis.

You can always roll token-level rows up into a canonical asset view. You cannot reliably split them apart after the pipeline throws away the chain.

## Symbols change

Crypto projects rename. Tokens migrate. Exchanges delist and relist assets. Providers fix old metadata. Communities rebrand tickers because marketing won an argument somewhere.

If your historical reports join on the latest symbol table, old data can change meaning without any raw fact changing.

The fix is temporal mapping.

```text
canonical_asset_id
provider
external_id
symbol
effective_from
effective_to
```

When a token migrates, do not overwrite the old mapping. Close it with `effective_to` and add the new one. Historical queries should use the mapping that was valid at the observation time.

This matters for agent workflows too. If an agent asks "what happened to this asset last quarter?", it should not silently use today's metadata to explain last quarter's data.

## The bad join looks innocent

This is the join I do not want in a mart:

```sql
select
  b.account_id,
  b.symbol,
  b.quantity,
  p.price_usd,
  b.quantity * p.price_usd as value_usd
from balances b
join prices p
  on lower(b.symbol) = lower(p.symbol)
```

It will pass a demo. It may even work for BTC and ETH for a long time.

Then it will fail quietly where the names are messier: stablecoins, wrapped assets, exchange-specific tickers, migrated tokens, or reused symbols.

A better mart join goes through explicit identity:

```sql
select
  b.account_id,
  a.canonical_asset_id,
  a.display_symbol,
  b.quantity,
  p.price_usd,
  b.quantity * p.price_usd as value_usd
from balances b
join asset_provider_mappings m
  on b.provider = m.provider
 and b.external_asset_id = m.external_id
 and b.observed_at >= m.effective_from
 and (m.effective_to is null or b.observed_at < m.effective_to)
join assets a
  on m.canonical_asset_id = a.canonical_asset_id
join prices p
  on p.canonical_asset_id = a.canonical_asset_id
 and p.observed_at = b.price_observed_at
```

That is more SQL. It is also less fragile than pretending `symbol` is a key.

## Where this belongs in `market-pipe`

In `market-pipe`, I would make this a staging-to-mart rule.

Raw ingestion should keep whatever the provider gave you. If CoinGecko says `id`, `symbol`, and `name`, store them. If an exchange says `XBT`, store that too. Raw data should preserve source truth.

Staging should rename fields so their scope is obvious:

```text
coingecko_id
coingecko_symbol
coingecko_name
asset_platform_id
contract_address
```

Marts should expose canonical identity:

```text
canonical_asset_id
display_symbol
display_name
asset_type
```

That split keeps the source data honest and gives consumers a stable interface.

The mistake is letting `symbol` drift upward from raw data into the public mart as if it became safer along the way. It did not. It only became more dangerous because more consumers now trust it.

## The checks I would add

The first check is social and technical: ban symbol joins in marts.

In dbt, that can start as code review discipline. If needed, add a simple static check later. Do not build a parser on day one. Search for joins on `.symbol` in mart SQL and fix the ones that matter.

The next checks are data tests:

- provider plus external id is unique in the mapping table
- every mart row has a canonical asset id
- token contract rows include chain identity
- mappings do not overlap for the same provider and external id
- unmapped assets land in a quarantine table

For symbols, the useful test is not uniqueness. Symbols are allowed to collide.

The useful test is making sure the collision does not break identity:

```sql
select symbol
from {{ ref('asset_provider_mappings') }}
group by symbol
having count(distinct canonical_asset_id) > 1
```

That query should probably return rows. It tells you where display labels are ambiguous. Treat it as a review queue, not a failure by itself.

The failure should happen when a public model uses those labels as keys.

## Agents need the same warning

Agents make this problem sharper.

A human analyst may hesitate when they see `symbol`. An agent often will not. If the table has `symbol` and `price_usd`, the agent can produce a fluent answer before it notices the join was unsafe.

Schema descriptions should say the quiet part clearly:

```text
symbol: display label only. Do not use for joins or identity.
canonical_asset_id: stable internal asset identifier. Use this for joins.
```

For MCP tools, return both:

```json
{
  "canonical_asset_id": "asset_btc",
  "display_symbol": "BTC",
  "provider": "coingecko",
  "external_id": "bitcoin"
}
```

That gives the agent less room to invent meaning. It also makes bad answers easier to audit. If the agent joined on `display_symbol`, the bug is visible.

## The practical rule

Never join crypto data on symbol in a consumer-facing model.

Use provider IDs inside source-scoped staging. Use chain plus contract address for on-chain tokens. Use your own canonical asset id in marts. Keep symbols as display metadata.

This sounds fussy until the first reconciliation bug. Then it sounds cheap.

## References

- [CoinGecko API documentation](https://docs.coingecko.com/reference/introduction)
- [CAIP-2: Blockchain ID Specification](https://chainagnostic.org/CAIPs/caip-2)
- [CAIP-19: Asset Type and Asset ID Specification](https://chainagnostic.org/CAIPs/caip-19)
- [Crypto asset data cleanup in agentic spaces](/posts/2026-06-08-crypto-asset-data-cleanup-agentic-spaces)
- [Data Contracts: The API Layer Your Crypto Pipeline Is Missing](/posts/2026-07-18-data-contracts-crypto-pipelines)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-20-freshness-data-quality-dimension)
