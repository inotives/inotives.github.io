---
title: "Point-in-Time Correctness in Crypto Analytics"
date: 2026-07-24
tags: [crypto, data-engineering, point-in-time, data-quality, backfills, market-data]
series: data-engineering
summary: "Crypto reports should use the mappings, prices, metadata, and asset status that were true at the report time. Point-in-time correctness prevents backfills, delistings, token migrations, and survivorship bias from rewriting history."
---

# Point-in-Time Correctness in Crypto Analytics

Crypto reports are easy to make current and hard to make historically correct.

The latest asset mapping is cleaner. The latest token metadata is better. The latest price table has fewer gaps. The latest provider response fixed old mistakes.

That does not mean old reports should use today's truth.

If a report is for June 2026, it should use the mappings, prices, delisting status, and source data that were valid for June 2026. If a token migrated later, if a provider renamed it later, if a backfill fixed a mapping later, that later truth needs to be handled deliberately.

Point-in-time correctness means the data answers the question as of the time being reported, not as of the time the query happened to run.

## The easiest way to lie with clean data

The dangerous query is the one that joins historical facts to current dimensions.

Example:

```sql
select
  b.observed_at,
  a.display_symbol,
  b.quantity
from balances b
join assets_current a
  on b.canonical_asset_id = a.canonical_asset_id
```

It looks fine. It may even be fine for a dashboard that only shows current state.

It is wrong for historical reporting if `assets_current` only stores the latest metadata.

Old balances can inherit new symbols, new names, new active status, or new mapping decisions. The report still runs. The numbers still add up. The story changed under the table.

## Mappings need valid time

Asset mappings need effective dates:

```text
provider
external_id
chain_id
contract_address
canonical_asset_id
effective_from
effective_to
```

Historical facts should join through the fact timestamp:

```sql
select
  p.observed_at,
  m.canonical_asset_id,
  p.price_usd
from raw_provider_prices p
join asset_provider_mappings m
  on p.provider = m.provider
 and p.external_id = m.external_id
 and p.observed_at >= m.effective_from
 and (m.effective_to is null or p.observed_at < m.effective_to)
```

That join is more annoying than joining to a current table. It is also the difference between preserving history and repainting it.

For crypto, this matters because identity is unstable. Tokens migrate. Wrapped assets appear. Providers merge records. Symbols move. Contract addresses change after migrations.

If the mapping table does not carry time, the warehouse has no way to ask, "What did we believe this asset was then?"

## Delisted assets still exist in history

Delisted assets should not disappear from historical analytics.

If an exchange delists a token today, yesterday's balances and trades still happened. If a provider removes the asset from a current endpoint, old reports still need its metadata. If a token went to zero, excluding it creates survivorship bias.

Use status with dates:

```text
canonical_asset_id
status
status_from
status_to
reason
```

Possible statuses:

```text
active
delisted
migrated
deprecated
quarantined
```

A current trading view may hide delisted assets. A historical report should keep them.

The key rule: current availability is not historical existence.

## Survivorship bias is a crypto reporting bug

Survivorship bias happens when analysis only includes things that still exist.

In crypto, that can mean:

- excluding delisted assets from old portfolios
- using today's token list to define last year's universe
- dropping assets that lost provider coverage
- ignoring failed tokens in performance analysis
- rebuilding old reports from current asset metadata

That makes performance look better than it was. It makes exposure look cleaner than it was. It makes risk look smaller than it was.

For a crypto analyst, that is not a statistical footnote. It changes the report.

If the portfolio held a token that later vanished, the historical report should still show it.

## Report time and query time are different

Every report should separate:

```text
report_period
as_of
generated_at
data_cutoff_at
```

These fields answer different questions.

`report_period` says what time range the report covers.

`as_of` says the point in time the report represents.

`generated_at` says when the report artifact was created.

`data_cutoff_at` says which source data was allowed into the report.

If those fields collapse into one timestamp, audits get messy. Agents also get confused because they cannot tell whether "latest" means latest source observation, latest transform, or latest report generation.

## Backfills should create new report versions

Backfills can improve history without erasing it.

If a mapping bug affected a June report, rebuild the report as version 2:

```text
report_period: 2026-06
report_version: 2
supersedes: 1
backfill_run_id: backfill_2026-07-24T020000Z
reason: fixed USDC chain mapping
```

Keep version 1.

That gives consumers a clear story: the old report existed, the new report supersedes it, and the reason is traceable.

Silently replacing report output is tempting. It is also how audit trails die.

## Agent answers need point-in-time rules

Agents should ask the data the same way a careful analyst would.

If the question is:

```text
What was my BTC exposure on June 30?
```

The agent should query the June 30 mart version or use mappings valid on June 30. It should not query today's asset table and today's latest price by accident.

Agent-facing metadata should say:

```json
{
  "dataset": "mart__portfolio_exposure",
  "point_in_time_safe": true,
  "time_key": "as_of",
  "mapping_rule": "join mappings where as_of is within effective window",
  "report_versioned": true
}
```

If the mart is not point-in-time safe, the agent should qualify or refuse historical answers.

That refusal is useful:

```text
I cannot answer a historical exposure question from this mart because it only contains current asset metadata.
```

Better a refusal than a polished rewrite of history.

## The practical rule

Historical analytics should use historical truth.

Keep effective dates on mappings. Preserve delisted assets. Avoid current-only dimensions in historical reports. Version reports when backfills change published outputs. Make agent-facing marts say whether they are point-in-time safe.

Current truth is useful.

It is not a substitute for the truth that was valid then.

## References

- [Backfills Without Breaking Crypto Reports](/posts/2026-07-23-backfills-without-breaking-crypto-reports)
- [The Crypto Asset Mapping Table](/posts/2026-07-21-crypto-asset-mapping-table)
- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
- [What Makes a Mart Agent-Safe](/posts/2026-07-23-what-makes-a-mart-agent-safe)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
