var e=`---
title: "Crypto Asset Data: Why Clean Data is the Difference Between an Agent That Works and One That Hallucinates"
date: 2026-06-08
tags: [crypto, data-quality, normalization, asset-mapping, agentic-systems, travel-rule, reporting, compliance, coinmarketcap, coingecko]
summary: "Every crypto firm that consumes data from multiple vendors faces the same problem: BTC on one provider is not the same BTC on another. This post covers the asset-provider mapping model we use at the firm, why data cleanliness determines whether your agents produce trustworthy output, and what happens when you pipe garbage into an AI agent."
---

## Crypto Asset Data: Why Clean Data is the Difference Between an Agent That Works and One That Hallucinates

Here's a scenario every crypto data engineer knows. [CoinGecko](https://www.coingecko.com) calls it \`bitcoin\`. [CoinMarketCap](https://coinmarketcap.com) calls it \`1\`. [Chainalysis](https://www.chainalysis.com) calls it something internal you can't even see. [Kraken](https://www.kraken.com) insists it's \`XBT\`. And none of them agree on what "it" is when you ask for the closing price.

This isn't a minor data quality issue. It's a systemic failure mode for any firm pulling data from multiple vendors. A [SEC audit published October 2025](https://www.sec.gov/files/cryptodata-sec-102525.pdf) found 21% of all assets on CoinGecko had labeling issues, 16% of CoinGecko IDs were reused across different assets, and cross-provider price discrepancies exceeded 20% on identical assets. Yes, 20%. On the same coin, on the same day, from two "authoritative" sources.

Now imagine piping that mess into an AI agent and asking it to generate a client report. The cleaner your data, the more predictable your result. When you pipe unclean data into an agent, the result becomes unpredictable — and in regulatory and client reporting, unpredictable is unacceptable. Accuracy is the single most important thing.

---

## What We Do at the Firm: Asset → AssetProvider → Provider

At the firm, we use a three-table model that I believe is the right baseline for any multi-vendor crypto shop:

**\`Asset\`** — owns the internal canonical truth. One row per asset. Immutable UUID, canonical ticker, canonical name. This never changes once created, even if the asset rebrands.

**\`Provider\`** — one row per vendor. CoinGecko, CoinMarketCap, Chainalysis, Sumsub, Notabene, Elliptic. Each has a type tag (market data, blockchain analytics, compliance) so we know which queries can go where.

**\`AssetProviderMapping\`** — the bridge. Every external identifier a vendor uses for a given asset lives here. CoinGecko's \`bitcoin\` slug, CMC's \`1\`, the contract address per chain, the ticker per exchange, the active window.

\`\`\`
Asset (1) ---<  AssetProviderMapping  >--- Provider (1)
+ id (UUID)      + provider_id                   + id
+ ticker (canon) + provider_asset_id             + name (e.g. "CoinGecko")
+ name (canon)   + provider_ticker               + type (market/analytics/compliance)
+ chain          + provider_slug
+ contract_addr  + contract_address
+ decimals       + chain
+ asset_class    + is_active
+ created_at
\`\`\`

When CoinGecko reuses an old ID or an asset rebrands, the bridge absorbs it. The canonical \`Asset\` record never changes. Client reports reference the internal UUID, giving a consistent audit trail across quarters.

This is the same pattern [CCXT's](https://github.com/ccxt/ccxt) \`commonCurrencies\` dictionaries implement per exchange, and the same architecture [TradingGoose-Market](https://dev.to/bwj2310/tradinggoose-market-canonical-ticker-identity-across-market-data-providers-31g) uses for canonical ticker identity. We just formalized it as a relational model with temporal windows.

---

## Why Clean Data Matters for Agentic Workflows

This is the part I want to emphasise. We run AI agents for reporting — agents that query multiple providers, reconcile differences, and generate client-facing output. The single biggest determinant of whether those agents produce trustworthy results is data quality at the input layer.

Here's the rule of thumb:

**Clean data in → predictable agent output. Unclean data in → unpredictable agent output.**

It sounds obvious. But in practice, teams jump straight to prompt engineering and agent orchestration before fixing their data model. They tweak the system prompt, add another validation step, throw a second agent at the problem. Meanwhile, the root cause is that \`BTC\` on provider A and \`XBT\` on provider B both resolve to different rows because the bridge table is incomplete.

The SEC audit numbers are sobering here:
- 21% of [CoinGecko](https://www.coingecko.com) assets mislabeled — per their [own standardization docs](https://support.coingecko.com/hc/en-us/articles/34869041269273-Understanding-our-Standardization-Process-for-Crypto-Assets)
- 16% of CoinGecko IDs reused (Terra -> Terra Luna Classic under the same ID)
- 21% of [CoinPaprika](https://coinpaprika.com) IDs change over an asset's lifetime
- Cross-provider volume disagreements exceeding 20%

If your agent uses CoinGecko for price data and CoinPaprika for volume data, and neither agrees on what "the asset" is, your output is already wrong before the LLM generates a single token. No prompt, no agent, no amount of AI polish fixes data that was wrong at ingestion.

---

## The Other Patterns (and Why They're Alternatives, Not Replacements)

The canonical glossary with a bridge table is our baseline. There are other approaches worth knowing about, but they solve narrower problems:

**[CCXT](https://github.com/ccxt/ccxt)-style dictionaries** — Hardcoded ticker rename maps per exchange. Kraken has 30+ entries (\`XXBT -> BTC\`, \`XETH -> ETH\`, \`ZEUR -> EUR\`). Works great for exchange trading pairs. Doesn't scale to compliance vendors or blockchain analytics because those providers don't publish their internal mappings. We use this pattern as a preprocessing step in our normalization layer, not as the primary model.

**[TradingGoose-Market](https://dev.to/bwj2310/tradinggoose-market-canonical-ticker-identity-across-market-data-providers-31g) symbol formatting** — Template-based symbol rendering per provider (\`{base}/{quote}\` for Alpaca, \`{base}-{quote}\` for Yahoo). Elegant for formatting. Doesn't solve identity resolution. We use this as a presentation-layer concern after the bridge table resolves the identity.

**[QuantConnect LEAN](https://github.com/QuantConnect/Lean) SecurityIdentifier** — Packs everything into a 64-bit integer that never changes. Impressively durable. Requires you to own the full infrastructure stack. Not practical for a firm that needs to integrate with 8+ external vendor APIs that all use their own ID systems.

**Agentic normalization ([CleanAgent](https://arxiv.org/html/2403.08291v3), [DeepPrep](https://arxiv.org/html/2602.07371v1), [GL Autopilot](https://github.com/sheharyarmonnoo/gl-autopilot))** — LLM agents that auto-standardize datasets. Promising for one-off cleanup. Too unreliable for production reporting without the bridge table underneath. An agent can guess that \`bitcoin\` on CoinGecko equals \`1\` on CMC, but a confirmed mapping in the bridge table is better every time.

These are all useful. None of them replaces having a canonical asset glossary. The glossary is the source of truth. The other patterns are helpers around the edges.

---

## How It Breaks in Practice

The [SEC paper](https://www.sec.gov/files/cryptodata-sec-102525.pdf) documented a real example that illustrates why this matters. SAFEMOON executed a 1000:1 token swap. After the swap:

- **[Live Coin Watch](https://www.livecoinwatch.com)** mixed old and new tokens under the same ticker
- **[CoinGecko](https://www.coingecko.com)** only reported the old token
- **[Santiment](https://santiment.net)** only reported the new token

A reporting agent querying all three would produce: three different prices for what it thinks is the same asset, no way to tell which is correct, and no audit trail of what happened. If that agent's output feeds a client report, the client sees contradictory numbers. If it feeds a regulatory filing, the regulator sees unreliable data.

The fix is the bridge table with temporal windows. The \`AssetProviderMapping\` for SAFEMOON would have two rows per provider: one for the old contract (with \`effective_to\` set to the swap date) and one for the new contract (with \`effective_from\` set to the swap date). The agent queries with a date filter and gets the correct identity for that point in time.

---

## What This Means for Your Reporting Pipeline

If you're building an agentic reporting system for crypto data, here's the priority order:

1. **Get the data model right first.** Asset glossary with bridge table. Contract address as the strongest identifier. Temporal windows for rebrands and swaps. If this isn't solid, nothing else matters.

2. **Then layer in agentic cleanup.** Agents can handle low-confidence matching, flag conflicts for human review, and cache confirmed mappings. But they operate on top of the bridge table, not instead of it.

3. **Then build the reporting agents.** Once the data layer produces consistent, predictable records, agents can generate reports with confidence intervals you actually trust.

The temptation is to start at step 3 because it's the visible, impressive part. The discipline is to start at step 1 because that's where the accuracy lives. And in client and regulatory reporting, accuracy is everything.

**Clean data, predictable agents. Unclean data, unpredictable results.** Pick your path.

---

### References

1. SEC / Aggarwal et al. "Aggregate Confusion In Crypto Market Data" (October 2025). https://www.sec.gov/files/cryptodata-sec-102525.pdf
2. TradingGoose-Market canonical ticker identity architecture. https://dev.to/bwj2310/tradinggoose-market-canonical-ticker-identity-across-market-data-providers-31g
3. CoinGecko Asset Standardization Process. https://support.coingecko.com/hc/en-us/articles/34869041269273-Understanding-our-Standardization-Process-for-Crypto-Assets
4. CoinMarketCap API — Standards and Conventions. https://coinmarketcap.com/api/documentation/guides/standards-and-conventions
5. CCXT library \`commonCurrencies\` (open-source). https://github.com/ccxt/ccxt
6. QuantConnect LEAN SecurityIdentifier (open-source). https://github.com/QuantConnect/Lean
7. CleanAgent: Automating Data Standardization with LLM-based Agents. https://arxiv.org/html/2403.08291v3
8. DeepPrep: LLM-Powered Agentic System for Autonomous Data Preparation. https://arxiv.org/html/2602.07371v1
9. GL Autopilot — vendor pattern learning. https://github.com/sheharyarmonnoo/gl-autopilot
10. Cross-source reconciliation: CMC vs CoinGecko date conventions. https://sstoeckl.github.io/crypto2/articles/cg-vs-cmc.html
`;export{e as default};