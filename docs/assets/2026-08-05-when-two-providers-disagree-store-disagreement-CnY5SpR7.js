var e=`---
title: "When Two Providers Disagree, Store the Disagreement"
date: 2026-08-05
tags: [data-engineering, crypto-data, data-quality, data-modeling]
summary: "Two market-data providers will disagree about prices, symbols, supply, and asset status. Preserve both observations and the reconciliation decision so a mart can be useful without pretending the conflict never existed."
series: data-engineering
---

# When Two Providers Disagree, Store the Disagreement

Provider A says BTC is $104,200. Provider B says $104,720 at nearly the same time. One source has a token listed as active; the other marks it delisted. A supply feed reports 19.8 million coins while another gives 19.7 million.

The easy response is to choose a preferred provider and overwrite the other value. It is also how a pipeline loses the evidence needed to explain a number later.

Disagreement is data. Store the observations first. Reconcile them in a model with an explicit rule. Keep the conflict visible when the rule cannot resolve it safely.

## Providers answer different questions

Two sources can disagree without either being broken. They may use different exchanges, sampling times, currencies, index methods, token identities, or listing policies.

For prices, a small difference can be normal market dispersion. For an asset mapping, a difference can reveal that one provider means a bridged token while the other means the canonical chain asset. For circulating supply, the sources may have different treatment of locked balances.

Before calling a value wrong, name the metric and its scope:

\`\`\`yaml
metric: usd_price
asset_id: bitcoin
event_time: 2026-08-05T09:00:00Z
provider_a:
  value: 104200.00
  market_scope: spot_index
provider_b:
  value: 104720.00
  market_scope: exchange_last_trade
\`\`\`

Those numbers should not be joined as if they were interchangeable. The first reconciliation task is often discovering that the contract never stated what a field represented.

## Keep each observation at provider grain

Raw and staging layers should preserve one row per provider observation.

\`\`\`sql
create table stg_provider_prices (
    provider text not null,
    provider_asset_id text not null,
    canonical_asset_id text,
    observed_at timestamp not null,
    price_usd numeric,
    market_scope text,
    source_run_id text not null
);
\`\`\`

Do not make \`canonical_asset_id, observed_at\` unique at this layer. That uniqueness assumes providers agree before the pipeline has even looked at the evidence.

The mapping from provider asset ID to canonical asset ID also needs versioning. A symbol such as \`USDC\` is not enough to prove identity. Provider scope, chain, contract address, and valid time often matter.

## Reconciliation is a business rule

The mart can select a value, but the rule must be visible. Here is a conservative price rule:

\`\`\`text
1. Use a provider-specific observation only when its freshness is within five minutes.
2. Prefer the configured index source for published USD prices.
3. If the preferred source is stale, use a fallback only when the value is within 2% of another fresh source.
4. Otherwise publish no reconciled value and open a review item.
\`\`\`

The rule does not claim that the preferred provider is always correct. It says which observation is fit for a stated product purpose and when the system should decline to choose.

In SQL, keep the decision fields beside the selected value:

\`\`\`sql
select
    canonical_asset_id,
    observed_minute,
    case
        when index_price is not null and index_age_seconds <= 300
            then index_price
        when fallback_price is not null
             and fallback_age_seconds <= 300
             and abs(fallback_price - comparison_price) / comparison_price <= 0.02
            then fallback_price
    end as reconciled_price_usd,
    case
        when index_price is not null and index_age_seconds <= 300 then 'index'
        when fallback_price is not null and fallback_age_seconds <= 300 then 'fallback'
        else 'unresolved'
    end as reconciliation_status
from candidate_prices
\`\`\`

The exact thresholds are product decisions. Store them in the contract or model documentation, not in an analyst's memory.

## Example: do not average incompatible prices

Suppose an index source reports $104,200 and an exchange last-trade source reports $104,720. Averaging them produces $104,460, a number that neither provider observed and that has no defined market scope.

If the product promises an index price, use $104,200 and record \`reconciliation_status: index\`. If the index is stale, the exchange price may be a provisional fallback under a documented rule. If the difference breaches the tolerance, publish \`unresolved\` rather than an invented compromise.

\`\`\`yaml
canonical_asset_id: bitcoin
observed_minute: 2026-08-05T09:00:00Z
reconciled_price_usd: null
reconciliation_status: unresolved
reason: fresh providers differ by 5.1%, above 2% tolerance
evidence:
  - provider: index_source
    value: 104200.00
  - provider: exchange_source
    value: 109514.20
next_action: review_provider_disagreement
\`\`\`

The dashboard can show a gap or a warning. That is more honest than a confident number with no defensible lineage.

## Model conflicts as first-class records

Create a reconciliation queue for values that cannot be resolved by policy.

\`\`\`sql
create table data_reconciliation_queue (
    issue_id text primary key,
    metric text not null,
    canonical_asset_id text not null,
    observed_at timestamp not null,
    severity text not null,
    reason_code text not null,
    observations jsonb not null,
    status text not null,
    created_at timestamp not null
);
\`\`\`

Use reason codes such as \`provider_value_outside_tolerance\`, \`asset_identity_ambiguous\`, and \`preferred_source_stale\`. A queue gives humans and agents a place to investigate without deleting the underlying observations or blocking every unrelated asset.

Repeated conflicts are useful signals. They may reveal a bad mapping, an undocumented provider methodology change, or a tolerance that does not match the market the product claims to represent.

## Version decisions that affect published history

Changing provider precedence can change historical marts. Treat it like a correction policy, not a silent model cleanup.

If a provider becomes unreliable, record when the new precedence rule takes effect. Decide whether historical reports stay pinned to the old rule or receive a versioned restatement. Consumers should not discover a revised number because a current query applied today's preference to last quarter's data.

This is where reconciliation meets point-in-time correctness. The data model needs both the original observations and the rule that selected a result at the time.

## Agents should investigate, not arbitrate

An agent can group conflicts, inspect source freshness, find a mapping mismatch, and draft a recommendation. It should not invent a provider-precedence rule or silently close a high-severity disagreement.

\`\`\`yaml
goal: Investigate unresolved BTC price discrepancy
allowed_actions:
  - inspect provider observations and freshness
  - check canonical asset mappings
  - draft a reconciliation note
requires_human_review:
  - change precedence policy
  - override a published price
  - launch a historical restatement
\`\`\`

The agent becomes useful because the disagreement has been stored in a queryable form. It does not need permission to choose which financial fact becomes official.

## Start with one metric and one rule

Choose the metric where a hidden provider disagreement would be most damaging. Write down the source scope, freshness limit, preference rule, tolerance, and unresolved path. Preserve both observations even when the rule selects one.

That gives the mart a useful answer and keeps the evidence for the day the answer needs to be questioned.

## References

- [The Crypto Asset Mapping Table](/posts/crypto-asset-mapping-table)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/data-quality-checks-save-pipelines)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/quarantine-tables-bad-crypto-data)
- [Point-in-Time Correctness in Crypto Analytics](/posts/point-in-time-correctness-crypto-analytics)
`;export{e as default};