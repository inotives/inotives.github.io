---
title: "What Makes a Mart Agent-Safe"
date: 2026-07-23
tags: [ai-agents, data-engineering, crypto, data-marts, data-quality, mcp]
series: data-engineering
summary: "An agent-safe mart is not just a clean table. It has freshness metadata, canonical IDs, no secrets or unnecessary PII, clear column descriptions, bounded access, and refusal metadata agents can use before answering."
---

# What Makes a Mart Agent-Safe

A mart can be good for dashboards and still unsafe for agents.

Dashboards usually have fixed queries. Reports usually have fixed layouts. Agents explore. They choose joins, summarize columns, compare time ranges, and explain results in prose. That makes weak mart design more dangerous.

If a mart has stale prices, ambiguous symbols, hidden PII, vague timestamps, or no allowed-use metadata, an agent may still produce a clean answer.

That is the failure mode.

An agent-safe mart is a consumer table with enough metadata and boundaries for software to know when it should answer, when it should qualify, and when it should refuse.

## Agent-safe starts with identity

Crypto marts should not ask agents to infer identity.

Use canonical IDs:

```text
canonical_asset_id
account_id
venue_id
wallet_id
chain_id
contract_address
```

Use display fields for display:

```text
display_symbol
display_name
```

Then say it clearly in the catalog or column descriptions:

```text
display_symbol is for display only. Use canonical_asset_id for joins.
```

This prevents the obvious bad query: joining balances to prices through `symbol`.

Agents need fewer ambiguous columns, not more chances to be clever.

## Freshness must be visible

A mart that feeds agents should expose its age.

Useful fields:

```text
as_of
latest_observed_at
freshness_status
freshness_checked_at
max_age_minutes
```

For a crypto price mart, `observed_at` may be the source time, while `ingested_at` is pipeline time. The agent needs to know which timestamp controls the answer.

If `freshness_status = stale`, the agent should not answer current-price questions as if the data is fresh.

The mart should make that decision easy:

```json
{
  "dataset": "mart__portfolio_exposure",
  "as_of": "2026-07-23T02:00:00Z",
  "freshness_status": "stale",
  "allowed_for_agent_use": false,
  "refusal_reason": "price data is older than 15 minutes"
}
```

That is better than hoping the agent reads a monitoring dashboard.

## No secrets, no accidental PII

Agent-safe marts should not expose secrets. That sounds obvious until someone gives the agent a "convenient" wide table.

Keep out:

- API keys
- credentials
- session tokens
- private keys
- raw auth fields
- internal notes
- unnecessary customer PII

For customer or account data, expose the minimum fields needed for the workflow.

If an agent needs account-level portfolio exposure, it probably does not need full name, email, phone, address, KYC notes, and raw wallet labels in the same mart.

Read-only does not make sensitive columns safe. It only stops writes.

## Descriptions are part of the interface

Agents read schema descriptions as instructions.

Descriptions should be blunt:

```yaml
- name: canonical_asset_id
  description: "Stable internal asset identifier. Use this for joins across marts."

- name: display_symbol
  description: "Human-readable label. Do not use for joins."

- name: freshness_status
  description: "Whether this mart is fresh enough for agent-facing answers."

- name: allowed_for_agent_use
  description: "False means agents should refuse answers that depend on this row."
```

Avoid vague descriptions like "asset symbol" or "latest timestamp." They force the agent to guess.

Good descriptions are cheap guardrails.

## Refusal metadata belongs in the data

Agents need a way to say no for the right reason.

Put refusal metadata in the mart or the tool response:

```text
allowed_for_agent_use
refusal_reason
blocking_issue_type
blocking_run_id
review_item_id
```

Examples:

```text
allowed_for_agent_use: false
refusal_reason: stale_price_data
blocking_issue_type: freshness_sla_failed
```

```text
allowed_for_agent_use: false
refusal_reason: unmapped_asset_in_portfolio
review_item_id: dq_00142
```

Now the agent can refuse with evidence:

```text
I cannot answer this portfolio exposure question because the mart has unmapped assets. Review item dq_00142 is still open.
```

That is much better than a generic "data unavailable."

## Agent-safe marts should be narrow

A mart for agents should answer a workflow.

Do not expose a giant warehouse table because it is easier than designing the view.

For crypto analytics, useful agent-facing marts might be:

```text
agent__portfolio_exposure
agent__asset_prices
agent__data_freshness
agent__open_data_quality_issues
```

Each should have a clear purpose and bounded rows.

If the agent needs broad exploration, use a separate analyst interface with stronger review expectations. Production agent tools should be narrow.

## The minimum checklist

Before a mart becomes agent-safe, check:

```text
canonical join keys exist
display fields are labeled
freshness metadata exists
allowed_for_agent_use exists
refusal reasons are machine-readable
PII and secrets are excluded
row access is bounded
column descriptions are clear
contracts and tests cover identity/freshness
```

That is the first version.

No new platform required.

## The practical rule

An agent-safe mart is a table that can tell the agent how to use it and when not to.

Use canonical IDs. Expose freshness. Remove secrets and unnecessary PII. Write blunt descriptions. Add refusal metadata. Keep the surface narrow.

If the agent has to guess whether the data is safe, the mart is not agent-safe.

## References

- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
- [The Minimum Viable Data Catalog for a Solo Crypto Project](/posts/2026-07-22-minimum-viable-data-catalog-solo-crypto-project)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [When to Fail the Pipeline vs Warn](/posts/2026-07-22-when-to-fail-pipeline-vs-warn)
- [The Data Quality Review Queue](/posts/2026-07-23-data-quality-review-queue)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
