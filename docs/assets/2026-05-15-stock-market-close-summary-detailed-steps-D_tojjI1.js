var e=`---
title: "Stock Market Close Summary: Detailed Steps"
date: 2026-05-15
tags: [trading, automation, analysis, market-close]
summary: "The full 11-section post-close analysis workflow for a single equity ticker — entry conditions, sub-agent dispatch, technical metrics, options derivatives, and entity bump."
---

## Stock Market Close Summary: Detailed Steps

The market close summary runs after 16:00 ET for a single ticker and produces a verdict-first analysis anchored by today's close. It covers options and derivatives, order flow, sentiment, peer and sector relative strength, catalyst timeline, RSI and EMA technical indicators, and explicit trigger lines for the next session.

### Entry Conditions

The skill runs **after 16:00 ET** for the session being analyzed. If invoked too early, it warns the user and asks whether to proceed with intraday data (marking \`[partial-corroboration]\` on the close).

**Inputs:**

| Parameter | Required | Default | Description |
|---|---|---|---|
| \`ticker\` | Yes | — | Uppercase symbol, e.g. \`NVDA\` |
| \`analysis_date\` | No | Today US/Eastern | YYYY-MM-DD |
| \`wiki_root\` | No | wiki memory path | Root of the wiki |

### Sub-Agent Dispatch

A \`general-purpose\` sub-agent with WebSearch and WebFetch is dispatched with a detailed prompt. The sub-agent is instructed to:

- Lead with the verdict — the reader should know the call before reading any data
- Cross-check the close on at least 2 sources; flag conflicts
- Use numbered inline citations \`[1]\`, \`[2]\` mapped to a Sources list with full URLs and access date
- Mark every unverifiable claim \`[could-not-corroborate]\`
- Target ~1500-2200 words — tight, scannable, no filler

**Primary sources:** Yahoo Finance, CNBC, Google Finance, Bloomberg, MarketWatch, Reuters, WSJ, Seeking Alpha, company IR site, SEC EDGAR.

### The 11 Sections

#### 1. TL;DR / Verdict

This is the most important section — traders read top-down. It contains:

- **Bull / Base / Bear probabilities** with explicit % (must sum to 100%)
- **Bull-trigger price level:** "Long break X, stop Y, target Z"
- **Bear-trigger price level:** "Short break A, stop B, target C"
- **Defined-risk alternative:** e.g. call spread with max loss / max gain
- **R:R ratio** for the suggested trade

Example:
\`\`\`
Bear 55% | Base 30% | Bull 15%

- Bull trigger: Reclaim $221 (VWAP) → $226 (daily R1) → ATH $236.54
- Bear trigger: Clean close below $214 (20 EMA) → $208 → $195.95 (50-day MA)
- R:R on short: ~1:3 from $215 to $195 vs $215 to $226
\`\`\`

#### 2. Today's Tape

Raw market data for the session:

| Metric | Description |
|---|---|
| Close | Final print price |
| Change | Absolute $ and % change |
| Open / High / Low | Session OHLC |
| Range | High - Low in $ and % |
| Volume | Total shares traded |
| RVOL | Relative volume vs 30-day average |
| VWAP | Whether close was above or below |
| After-hours | Post-close print and % change |

Plus two critical technical indicators:

**RSI(14):** 14-period Relative Strength Index with prior-day reference. >70 overbought, <30 oversold.

**5-key EMA table:**

| MA | Value | Distance % | Signal |
|---|---|---|---|
| EMA 10 | $X | +/-Y% | Near-term trend |
| EMA 20 | $X | +/-Y% | Nearest MA support |
| EMA 50 | $X | +/-Y% | Medium trend |
| EMA 100 | $X | +/-Y% | Intermediate trend |
| EMA 200 | $X | +/-Y% | Long-term trend |

Distance % tells the trader how extended the stock is from its trend. The closest EMA below spot is the first line of support.

#### 3. Cross-Tape & Macro Overlay

DXY, 2Y/10Y yields and curve shape, VIX level + term structure (front vs back month, contango or backwardation), HY/IG credit spreads, and any name-relevant macro (oil for energy, copper for industrials, USD/CNY for China ADRs).

#### 4. News Flow (last 48 hours)

Earnings, guidance, M&A, regulatory, executive moves, product launches, partnerships, lawsuits — anything material that moved the stock or changes the fundamental thesis.

#### 5. Options & Derivatives

| Metric | Why it matters |
|---|---|
| IV level + IV Rank / Percentile | Cost of options; where IV sits in its 1-year range |
| Put-call skew / risk reversal | Directional bias priced into the options market |
| Max pain (weekly + monthly) | Strike where options expire worthless — acts as gamma magnet near expiry |
| Gamma exposure / gamma flip | Where dealer hedging flips from stabilizing to amplifying |
| Expected move (1d / 1w) | ATM straddle price — the options market's expected range |
| Largest OI strikes | Open interest concentrations that can pin price |
| Unusual options activity | Large or out-of-the-ordinary flow |

#### 6. Order Flow & Microstructure

Opening and closing auction participation, dark-pool prints if available, block trades over $1M, time-of-day liquidity profile.

#### 7. Sentiment & Positioning

Short interest level + 30-day delta + days-to-cover + cost-to-borrow, ETF flows, 13F/13D fund positioning, insider Form 4 filings in the last 30/90/180 days, buyback execution pace vs remaining authorization, social-sentiment spikes on StockTwits/WSB if material.

#### 8. Sell-Side Snapshot

Table of recent analyst actions:

| Firm | Action | New PT | Old PT | Rating | Date |
|---|---|---|---|---|---|
| Evercore | Raise | $413 | — | Outperform | May 21 |

Plus consensus PT vs spot, upgrade/downgrade ratio over 30/60/90 days, and beat/miss cadence.

#### 9. Peer & Sector Relative Strength

Compares the ticker against its sector ETF and top 3 peers over 1d, 1w, 1m, and 3m. Includes sector breadth and one pair-trade idea if the relative strength setup is compelling.

#### 10. Next-Session Setup

This section bridges the close analysis to the next trading day and feeds directly into the pre-open prediction.

**Technical levels:**

| Level | Price | Confluence |
|---|---|---|
| R3 | $X | Prior swing, EMA confluence |
| R2 | $X | Fib level, volume shelf |
| R1 | $X | Prior high, EMA 10 |
| Pivot | $X | Current close |
| S1 | $X | EMA 20 — the line |
| S2 | $X | Channel support / gamma flip |
| S3 | $X | Prior swing, 50-day EMA |

**RSI trajectory:** Crossing into overbought or oversold? Rolling over? Diverging from price?

**EMA gap depth:** How extended spot is from its nearest EMAs. Large distance from the 50-day means vulnerability to mean reversion.

**Setup probabilities:** Bear X% / Base Y% / Bull Z%

#### 11. Risk Factors for Next Session

Numbered list ranked by probability multiplied by impact. Each risk cites the catalyst that would trigger it.

### Output and Entity Bump

After writing the brief to \`2_knowledges/researches/daily/{ticker}/{date}.md\`, the entity file at \`2_knowledges/entities/stocks/{ticker}.md\` is updated:

1. \`updated_at\` bumped to current timestamp
2. The new brief path added to \`sources:\`
3. A new "Update {date}" block is appended with a one-paragraph summary of the close, primary driver, next-session triggers

This entity bump prevents the snapshot anchor from going stale — the most-cited failure mode in the wiki.

### Error Handling

| Situation | Response |
|---|---|
| Before 16:00 ET | Warning + offer to proceed with intraday data (partial-corroboration flagged) |
| Source returns 403 | Notes the error in flags; uses alternative sources |
| No after-hours data | Skips AH section with \`[could-not-corroborate]\` |
| Weekend gap (Fri to Mon) | Explicitly flags 48h of weekend headline risk |
| Earnings night | Earnings print overrides normal technical triggers for next session |
`;export{e as default};