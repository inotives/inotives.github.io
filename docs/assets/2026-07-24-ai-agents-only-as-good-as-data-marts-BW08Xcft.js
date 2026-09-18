var e=`---
title: "AI Agents Are Only as Good as Their Data Marts"
date: 2026-07-24
tags: [ai-agents, data-marts, data-quality, crypto, data-engineering, analytics]
series: data-engineering
summary: "Better models do not fix bad analytics tables. If an agent queries ambiguous symbols, stale prices, unsafe columns, or current-only dimensions, it will produce polished answers from broken data."
---

# AI Agents Are Only as Good as Their Data Marts

People keep trying to fix agent reliability at the model layer.

Use a better model. Add more context. Improve the prompt. Add another tool. Wrap the output in a critic. Ask the agent to double-check itself.

Some of that helps.

None of it fixes a bad data mart.

If the agent queries a table where \`symbol\` is treated like identity, prices are stale, PII sits beside reporting fields, and historical rows join to current metadata, the model can be brilliant and still wrong.

It will just be wrong in better prose.

That is the uncomfortable part of agent work. Model quality matters, but the model is usually the last thing touching a long chain of assumptions. The agent sees a table, a column name, a few descriptions, maybe a sample row, then it has to turn that into an answer someone might act on.

If the mart is vague, the agent guesses.

If the mart is stale, the agent repeats stale facts with confidence.

If the mart mixes safe reporting fields with sensitive operational data, the agent has no moral sense that one column is harmless and the next one should never leave the database.

The mart is the agent's operating surface. Treat it like one.

## The table is part of the prompt

When an agent queries a database, the schema is not neutral.

Column names, descriptions, joins, freshness fields, and allowed-use metadata all shape the answer. If the mart says:

\`\`\`text
symbol
price
updated_at
\`\`\`

the agent has to guess what those fields mean.

If the mart says:

\`\`\`text
canonical_asset_id
display_symbol
price_usd
observed_at
freshness_status
allowed_for_agent_use
\`\`\`

the agent has a much better interface.

That is not prompt engineering. That is data product design.

A good mart removes choices the agent should not be making. It gives the agent enough context to ask the right question, write a boring query, and know when not to answer.

For a human analyst, a sparse schema can still work because the missing rules live in memory:

\`\`\`text
Use asset_id, not symbol.
Ignore chain_id for centralized exchange balances.
Do not use today's mapping table for old reports.
If prices are older than 15 minutes, call it stale.
\`\`\`

Those rules are fragile even for humans. For agents, they are worse. They become hidden context the model has to infer from naming patterns, old SQL, or whatever docs happen to be in the context window.

The better version is to encode those rules directly into the mart:

\`\`\`text
canonical_asset_id
provider_asset_id
platform_id
contract_address
balance_as_of
price_observed_at
freshness_status
point_in_time_safe
allowed_for_agent_use
\`\`\`

Now the agent has fewer traps.

## Ambiguous marts create confident mistakes

Crypto is full of ambiguity.

\`BTC\`, \`XBT\`, wrapped BTC, bridged assets, exchange-specific symbols, provider IDs, contract addresses, chain IDs. A human analyst might pause before joining on \`symbol\`. An agent often keeps moving.

If the mart exposes ambiguous fields without guidance, the agent may write the obvious query:

\`\`\`sql
join prices p on balances.symbol = p.symbol
\`\`\`

That query can pass a demo and fail in production.

The fix is not telling the model to be careful. The fix is giving it a mart where the safe join is obvious and the unsafe join is unnecessary.

Use canonical IDs. Keep display fields as display fields. Describe both.

A real example: an agent is asked, "What is our BTC exposure across wallets and exchanges?"

If the mart has \`symbol\`, \`network\`, and \`balance\`, the agent may group by \`symbol = 'BTC'\`. That might include native Bitcoin. It might miss wrapped BTC on Ethereum. It might include a bridged token that uses the same display symbol but has different liquidity risk. It might combine centralized exchange balances with on-chain balances without telling the user.

The answer will look neat:

\`\`\`text
Total BTC exposure: 12.4 BTC, worth $1.47M.
\`\`\`

But the number may be a blend of assets that should not be blended.

An agent-safe mart should make the classification explicit:

\`\`\`text
canonical_asset_id
asset_type
display_symbol
platform_id
chain_id
contract_address
is_native_asset
is_wrapped_asset
economic_exposure_group_id
\`\`\`

Then the agent can answer with the right shape:

\`\`\`text
Native BTC exposure is 8.1 BTC.
Wrapped BTC exposure is 4.3 BTC across Ethereum and Arbitrum.
These are shown separately because the mart marks them as different asset forms.
\`\`\`

That is a better answer because the mart carried the distinction.

The same issue shows up with stablecoins. "USDC exposure" may mean native USDC on Ethereum, bridged USDC on another chain, exchange balances, or a token that still uses the USDC symbol after a migration. A model can know this problem exists. It still needs the table to encode which row is which.

## Stale data gives fresh-sounding answers

Agents do not naturally know when data is stale.

If a price mart is 90 minutes old and the table does not expose freshness, the agent may answer a current-exposure question as if the number is live.

That is worse than a dashboard with a stale timestamp. The agent wraps the stale number in explanation.

Agent-facing marts need freshness fields:

\`\`\`text
as_of
latest_observed_at
freshness_status
max_age_minutes
\`\`\`

And they need refusal metadata:

\`\`\`text
allowed_for_agent_use
refusal_reason
blocking_issue_type
\`\`\`

The agent should be able to say:

\`\`\`text
I cannot answer current exposure because the price mart is stale.
\`\`\`

That is a successful answer.

The refusal needs to be data-driven, not vibes-driven. The agent should not decide from prose alone that "90 minutes is probably old." The mart should say what freshness means for that use case.

For example:

\`\`\`text
mart_name: agent__portfolio_exposure
max_age_minutes: 15
latest_observed_at: 2026-07-24T09:40:00Z
freshness_status: stale
blocking_issue_type: price_source_lag
\`\`\`

Now the agent has a concrete boundary.

If the user asks, "What is exposure right now?" the agent refuses or qualifies the answer.

If the user asks, "What did exposure look like at the last completed run?" the same stale mart may still be usable, because the question is not asking for now.

This distinction matters in crypto because time changes the meaning of the answer. A wallet balance from an hour ago might be fine for a weekly review. It is not fine for a liquidation-risk question. A reference table of chain metadata can be a day old. A price table used for current NAV cannot.

One freshness field is better than none, but the useful pattern is a small freshness mart:

\`\`\`text
agent__data_freshness

mart_name
latest_run_id
latest_observed_at
expected_interval_minutes
max_age_minutes
freshness_status
blocking_issue_type
last_error_code
\`\`\`

Agents can query that first. Humans can read it too. No special magic.

## Unsafe columns leak through usefulness

The fastest way to make a database useful to an agent is to expose a wide table.

The fastest way to regret it is the same move.

A mart that mixes analytics fields with secrets, internal notes, unnecessary PII, or raw operational columns is not agent-safe. Read-only access does not solve this. Reading the wrong column can already be the incident.

Agent-facing marts should be narrow:

\`\`\`text
agent__portfolio_exposure
agent__asset_prices
agent__data_freshness
agent__open_quality_issues
\`\`\`

Each mart should have the fields needed for the workflow and no more.

If the agent needs broader access, make that a separate analyst tool with stronger review expectations.

Read-only is not the same as safe. A read-only agent can still leak a customer email, copy an API key that should never have been stored in a reporting table, or summarize internal notes into a user-facing answer.

This is where small projects often get sloppy. The first mart is built for convenience:

\`\`\`text
wallet_address
exchange_account_id
asset_symbol
balance
owner_email
internal_note
api_key_label
raw_payload
updated_at
\`\`\`

It feels practical because everything is in one place. It is also a poor interface for an agent. The agent should not need to know which columns are safe by vibes, and the user should not need to trust every future prompt to say "never expose internal notes."

A safer mart removes the problem:

\`\`\`text
agent__portfolio_exposure

portfolio_id
canonical_asset_id
display_symbol
exposure_quantity
exposure_usd
as_of
freshness_status
quality_status
\`\`\`

The unsafe fields stay in operational tables or restricted analyst views. The agent gets a clean surface.

This also helps with permissions. Instead of granting the agent broad read access and trying to police behavior in prompts, grant access only to \`agent__\` marts, read-only MCP tools, and a small query allowlist. Add row limits. Log every query with a run ID and the requesting task.

That sounds like security overhead, but it is mostly naming and permissions. The lazy version works:

\`\`\`text
agent__asset_prices
agent__portfolio_exposure
agent__data_freshness
agent__open_quality_issues
\`\`\`

If a table is not meant for agent use, do not put it behind the agent tool.

## Current-only marts break historical questions

A lot of marts are built for "now."

That is fine until the agent gets a historical question:

\`\`\`text
Why did USDC exposure change in June?
\`\`\`

If the mart joins historical balances to today's asset metadata, the answer may rewrite history. Delisted assets disappear. Token migrations get applied backward. Current mappings replace the mappings that were valid at the report time.

Agent-facing marts should say whether they are point-in-time safe:

\`\`\`text
point_in_time_safe
time_key
report_version
mapping_version
\`\`\`

If the mart is not point-in-time safe, the agent should not pretend it can answer historical questions.

Here is the common failure.

The user asks:

\`\`\`text
Why did portfolio value drop on May 10?
\`\`\`

The agent queries historical balances from May 10. Then it joins to today's asset mapping table and today's token metadata. A token that was later migrated now points to the new contract. A delisted asset has no active mapping, so it disappears. A provider changed its ID, so the join silently picks up the wrong row.

The answer explains a drop that did not happen, or misses the real cause.

Point-in-time marts need effective dates:

\`\`\`text
canonical_asset_id
provider
provider_asset_id
chain_id
contract_address
effective_from
effective_to
mapping_status
\`\`\`

Then historical reports can use the mapping that was true at report time:

\`\`\`sql
join asset_provider_mappings m
  on prices.provider_asset_id = m.provider_asset_id
 and prices.observed_at >= m.effective_from
 and prices.observed_at < coalesce(m.effective_to, 'infinity')
\`\`\`

The exact SQL can vary. The principle should not: a historical answer must use historical truth.

Agent-facing marts should expose whether that work has already been done. The agent should not need to reconstruct point-in-time logic from raw tables unless the task is explicitly a data investigation.

## Better models amplify good marts

This is the useful part.

When the mart is well-designed, a strong model becomes much more valuable.

It can explain lineage. It can compare report versions. It can summarize quarantine issues. It can refuse stale answers. It can generate useful SQL because the schema points toward safe joins.

The model is not fighting the data layer.

That is the target: make the correct path the easy path.

With a good mart, the agent can do practical work:

\`\`\`text
Show portfolio exposure by canonical asset.
Explain why today's NAV differs from yesterday's report.
List quarantined rows blocking the stablecoin mart.
Find assets with repeated mapping warnings.
Refuse current-risk questions when price freshness is stale.
Trace a report number back to the raw run ID.
\`\`\`

Those are not model party tricks. They are ordinary analytics workflows that become easier when the data has handles the agent can grab.

The strongest agent in the world will struggle with a mart called \`final_balances_v3\`. A decent agent can do useful work with a mart called \`agent__portfolio_exposure\` if the columns are honest and documented.

Small projects can do this without building a grand platform. Start with a few conventions:

\`\`\`text
agent__ prefix for approved marts
canonical IDs for joins
display fields for humans
freshness fields on every time-sensitive mart
quality status fields where rows may be incomplete
point-in-time flags for historical use
short descriptions in schema docs
\`\`\`

That is enough to move from "the agent can query the database" to "the agent can query the right thing."

## The practical rule

Before blaming the model, inspect the mart.

Does it have canonical IDs? Freshness metadata? Clear descriptions? No secrets or unnecessary PII? Point-in-time rules? Refusal metadata? Bounded rows? A contract?

If not, the agent is being asked to reason over a weak interface.

Better models help. Better marts help more.

For a solo crypto project, I would use this minimum bar before letting an agent answer from a mart:

\`\`\`text
1. The mart has a clear purpose.
2. The safe join keys are obvious.
3. Display names are not used as IDs.
4. Freshness is queryable.
5. Historical safety is explicit.
6. Unsafe fields are absent.
7. Known data quality issues are visible.
8. The mart has a short description and owner.
\`\`\`

That is not a lot of ceremony. It is mostly discipline.

The model still matters. A better model can reason more carefully, write cleaner SQL, and explain uncertainty more clearly. But if the mart lies, hides state, or leaves identity ambiguous, the model starts from bad ground.

Fix the ground first.

## References

- [What Makes a Mart Agent-Safe](/posts/2026-07-23-what-makes-a-mart-agent-safe)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [Point-in-Time Correctness in Crypto Analytics](/posts/2026-07-24-point-in-time-correctness-crypto-analytics)
- [The Minimum Viable Data Catalog for a Solo Crypto Project](/posts/2026-07-22-minimum-viable-data-catalog-solo-crypto-project)
- [Data Lineage for Small Crypto Pipelines](/posts/2026-07-24-data-lineage-small-crypto-pipelines)
`;export{e as default};