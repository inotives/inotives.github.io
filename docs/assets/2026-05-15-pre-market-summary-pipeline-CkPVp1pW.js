var e=`---
title: "How the Pre-Market Summary Pipeline Works"
date: 2026-05-15
tags: [trading, automation, pipeline, market-prediction]
summary: "The full workflow, skills, metrics, and reasoning behind the daily pre-market opening-price prediction and intraday forecast system."
---

## How the Pre-Market Summary Pipeline Works

The daily pre-market summary is the terminal output of a two-skill pipeline that runs every trading day. The close summary runs after market close (post-16:00 ET) to produce a forensic anchor. The pre-open prediction runs the next morning (before 09:30 ET) to layer live overnight tape on top and produce an opening cone, intraday path, and monitoring checklist.

When multiple tickers are predicted in one run, the results are consolidated into a single HTML report with a market overview banner, snapshot table, detail cards, catalysts calendar, and risks matrix.

### Pipeline Overview

\`\`\`
stock_market_close_summary        (after 16:00 ET, prior day)
        ↓
2_knowledges/researches/daily/{ticker}/{date}.md
        ↓
stock_pre_open_prediction         (between 16:00 ET → 09:30 ET)
        ↓
2_knowledges/researches/predictions/{ticker}/{date}.md
        ↓
Consolidated HTML report          (multi-ticker runs)
reports/researches/{date}-pre-market-summary.html
\`\`\`

The close summary establishes the anchor — technical levels, triggers, options topology, catalyst calendar. The pre-open prediction is a delta on top. It reads the anchor, adds live overnight data (futures, cross-listings, headlines), and produces an opening cone + intraday path + monitoring checklist. The prediction is intentionally under 1500 words — it is a focused delta, not a full rewrite.

### Phase A: Market Close Summary

The close summary is a full forensic read of the trading day. A general-purpose sub-agent with WebSearch and WebFetch gathers ~1500-2200 words covering 11 sections:

1. **TL;DR / Verdict** — bull/base/bear %; explicit bull-trigger and bear-trigger price levels with stop and target; defined-risk alternative; R:R ratio
2. **Today's Tape** — close, % change, range, RVOL, VWAP cross, RSI(14), 5-key EMA table (10/20/50/100/200) with distance % and signal
3. **Cross-Tape & Macro** — DXY, 2Y/10Y curve, VIX term structure, credit spreads
4. **News Flow (48h)** — earnings, M&A, regulatory, product, partnerships
5. **Options & Derivatives** — IV + IV Rank, put-call skew, max pain (weekly + monthly), gamma flip levels, expected move (1d/1w), unusual flow
6. **Order Flow & Microstructure** — auction participation, dark pools, blocks >$1M
7. **Sentiment & Positioning** — short interest, ETF flows, 13F, insider transactions, buyback pace
8. **Sell-Side Snapshot** — table of firm/action/PT changes, consensus vs spot
9. **Peer & Sector RS** — 1d/1w/1m/3m vs peers and sector ETF
10. **Next-Session Setup** — S1/S2/S3, R1/R2/R3 levels with confluence; RSI trajectory; EMA gap depth
11. **Risk Factors** — ranked by probability x impact

After the brief is written, the entity file for that ticker gets bumped with a new "Update {date}" block and the brief path added to sources.

### Phase B: Pre-Open Prediction

This runs between 16:00 ET (prior close) and 09:30 ET (target session open). It reads the anchor close summary and layers live overnight data on top.

The sub-agent fills 11 focused sections:

1. **Verdict card** — predicted open (point estimate + 1 sigma cone), most-likely intraday path (one sentence), predicted close (95% cone), confidence H/M/L, single biggest risk, net directional bias with %
2. **Inputs — Anchor** (verbatim from prior brief) — anchor close, trigger lines, bull/base/bear probabilities
3. **Live overnight tape** — US futures (ES/NQ/YM/RTY), cross-listings (HKEX, TWSE, Tokyo, London), Asia/Europe cohort (Nikkei, KOSPI, STOXX 600, DAX), commodities (WTI, copper, gold), currencies (DXY, USD/CNY, USD/JPY), bonds (2Y/10Y), crypto (BTC/ETH for relevant names), breaking headlines (name-specific + macro)
4. **Pre-market action** — latest print + % change, volume vs typical, unusual options OI
5. **Opening prediction** — cone $lower-$upper + midpoint; gap distribution (gap-up/flat/gap-down %); gap-fill risk; first-30-min range
6. **Intraday path** — 5 time-bucket table with price ranges and tone
7. **Closing prediction** — expected close ±; close-vs-open probability; day's expected range; realized-vs-implied move (vs ATM straddle)
8. **Monitoring checklist** — 5 checkpoints with confirm boxes plus single-line invalidator
9. **Trigger validation IF-THEN tree** — mirrors anchor triggers with updated overnight context
10. **Backtest hooks** — blank fields \`[pending fill EOD]\` for post-session accuracy review
11. **Confidence & flags** — every \`[could-not-corroborate]\`, source errors, trigger conflicts

### Phase C: Consolidated HTML Report

When multiple tickers are predicted, the results merge into a single HTML report at \`reports/researches/{date}-pre-market-summary.html\`. The layout:

- **Header** — title, date, generation timestamp, prior close date, ticker count
- **Market Overview banner** — 8-key grid (ES, NQ, YM, VIX, 10Y, DXY, WTI, BTC) + key themes + Asia/Europe overnight
- **Snapshot table** — all tickers in one sortable table: prior close, pre-market, open cone, expected close, bias (color-coded), confidence, biggest risk
- **Detail cards** — 2-column grid, one card per ticker with full prediction details and triggers
- **Catalysts calendar** — upcoming events with dates and tickers affected
- **Risks matrix** — 3-column grid of named risk cards with descriptions
- **Footer** — generation timestamp, data sources disclaimer

The HTML uses Tailwind CSS (loaded from CDN, no build step) with dark mode and color-coded bias badges (green for bullish, red for bearish, yellow for range-bound).

### Phase D: Backtest Loop

After each cash session closes, the next pre-open prediction run fills in the prior prediction's backtest hooks:

- Predicted open vs actual open → HIT / NEAR-MISS / MISS (delta $X)
- Predicted intraday path vs realized → HIT / PARTIAL / MISS
- Predicted close vs actual → HIT / MISS
- Trigger lines hit? Y/N

After 5+ predictions per ticker, a calibration summary is included in new predictions showing open-cone hit-rate, close-direction hit-rate, trigger-resolution hit-rate, and last miss reason.

### Metric Reasoning

**Opening cone (1 sigma):** Derived from the anchor brief's S1/S2/S3 and R1/R2/R3 levels, the overnight futures delta, and pre-market print + volume. Cone width is calibrated against the ATM straddle implied 1-day move.

**Gap distribution (must sum to 100%):** Gap-up = ≥+0.5% from prior close, gap-down = ≤-0.5%, flat = in between. Derived from overnight futures direction, pre-market tape, cohort cross-tape (e.g. Korean semi stocks for MU/NVDA/AMD), and macro binary risks.

**Intraday path (5 time buckets):** The path maps to known market microstructure. The opening range (9:30-10:00) sets the day's tone. Morning trend (10:00-11:30) develops the dominant move. Midday drift (11:30-13:30) sees options dealers pin near max pain. The afternoon (13:30-15:30) extends or fades the trend. The closing auction (15:30-16:00) is dominated by MOC imbalances.

**Confidence (H/M/L):** High = pre-market price established, futures aligned, no overnight shock, volume confirming. Medium = thin pre-market or mixed signals. Low = no pre-market print, weekend gap, or conflicting macro.

**Trigger validation IF-THEN tree:** The anchor brief provides explicit bull and bear trigger levels. The pre-open prediction must validate them against overnight tape. If a weekend headline invalidates a trigger, the prediction says so explicitly and proposes updated levels.

**Realized-vs-implied move:** Compares the prediction's expected range against the options market ATM straddle price. Inside implied = low conviction (market has already priced this). Outside implied = high conviction event with a clear catalyst.

### Skills Used

| Skill | Location |
|---|---|
| Close Summary | \`skills/trading/stock_market_close_summary/SKILL.md\` |
| Pre-Open Prediction | \`skills/trading/stock_pre_open_prediction/SKILL.md\` |
| Price Fetching | \`skills/trading/price_fetching/scripts/fetch_prices.py\` |

### Tickers Tracked

AAPL, AMD, AMZN, CRCL, CRWV, GOOG, INTC, META, MU, NIO, NVDA, ORCL, TSLA, TSM — 14 tickers across mega-cap tech, semiconductors, China ADRs, and EVs.
`;export{e as default};