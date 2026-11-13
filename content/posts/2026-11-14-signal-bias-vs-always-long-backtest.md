---
title: "My signal bias loses to always-long: an honest backtest"
date: 2026-11-14
tags: [backtesting, technical-analysis, stock-signals, adx, look-ahead-bias, github-actions, cors, playground]
summary: "I added a track record view to my stock-signals playground mock, replaying ten classic indicators on every past session with no look-ahead. On all five tickers the combined bias was right less often than simply calling 'up' every day. ADX regime weighting didn't rescue it either. This note covers how the backtest works, why the base rate is the number that matters, why sixty-odd calls can't tell you much, and the small GitHub Actions workaround that keeps the page's data fresh on a static host."
---

A few weeks ago I put a [stock-signals mock](/mocks/stock-signals.html) in the playground. It pulls daily bars for a handful of tickers, runs the usual indicators (moving-average crosses, RSI, MACD, Bollinger Bands, OBV, pivots) and has each one vote bullish, bearish or neutral for the next session. The votes are averaged into a single bias: lean up, lean down, or no call.

It looks convincing. Green rows, red rows, a confident "Leans bullish" at the top. That's exactly the problem. A panel of indicators agreeing with each other says nothing about whether they're right, so this week I made the page grade itself.

The short version: **on all five tickers, the bias was right less often than a strategy that just says "up" every day.**

## How the track record works

The new **Track record** view replays the whole signal panel on every past session, using only the bars up to that session.

![A row of daily candles. Bars up to day i sit inside a dashed box labelled bars.slice(0, i + 1), the only data the replay can see. Day i + 1 is highlighted as the bar being scored and later bars are greyed out. Below, four steps: slice, recompute every indicator from scratch, vote a bias, score it against the next open and next close. Repeated from session 35, giving 84 calls from 120 sessions.](/assets/images/signal-backtest-replay.svg)

```js
for (let i = TRACK_START; i < bars.length - 1; i++) {
  const past = bars.slice(0, i + 1);              // nothing after day i
  const { rows } = readSignals(past, indicators(past));
  const c = bars[i].close, nx = bars[i + 1];
  calls.push({
    dir: lean(scoreOf(rows).score),               // +1, -1 or 0
    move: { open: nx.open / c - 1, close: nx.close / c - 1 },
  });
}
```

That slice is how the page avoids **look-ahead bias**. Computing indicators once over the full series and reading them back day by day is tempting, and easy to get subtly wrong for anything smoothed or windowed. Recomputing from a truncated series is slower but obviously correct, and 120 bars is nothing.

That gives **84 past calls per ticker** (16 July to 12 November 2026). Each is scored against the **next open** (the overnight gap, which is what the page forecasts) and the **next close**. Days where the bias doesn't lean either way (|score| < 0.25) are skipped.

## The number that matters is the base rate

Here's NVDA, scored on the next open:

- The bias made 68 calls and was right on 36: **52.9%**.

Better than a coin flip. Except NVDA gapped up on 58.3% of those sessions. A rule that says "up" every single day would have been right **58.3%** of the time, without reading a single indicator.

That comparison is the **base rate**, and it's the first thing to check in any backtest. Markets aren't coin flips: in this window all five tickers gapped up more often than not.

![Dot plot of next-open hit rates. NVDA: bias 52.9% on 68 calls against always-up 58.3%. AAPL: 45.5% against 57.1%. MSFT: 43.8% against 52.4%. TSLA: 48.4% against 54.8%. SPY: 44.2% against 58.3%. Each bias dot has a shaded 95% noise band of about ±12 points. Every bias dot is left of its base rate. Only SPY's gap is wider than the band.](/assets/images/signal-bias-vs-base-rate.svg)

The bias loses to "always up" on every ticker, and on four of five it's below 50%. Flipping it would have done better, but that's not a hidden edge, just the base rate again.

Two more things the chart doesn't show:

- **Hit rate isn't the whole story.** On NVDA, compounding only the gaps the bias called gives +14.8% against +8.5% for holding, despite the lower hit rate. A few big gaps happened to land on the right side. With 68 calls, that's luck.
- **Next close is no better.** Base rates drop to 46–54%, because much of these stocks' gains came overnight in this window. The bias still trails on four of five and only ties on NVDA (45.6% vs 46.4%).

### Sixty calls can't tell you much

Look at the shaded bands. With about 65 calls, a hit rate near 50% has a 95% interval of roughly **±12 points**. Only SPY's gap is wider than that. Six months of daily data can catch a signal that's badly broken. It can't confirm one that's slightly good.

The per-signal breakdown shows the same thing:

- **Bollinger %B**: 78% on SPY, on 9 calls.
- **Volume vs 20-day**: 71% on AAPL (14 calls), 23% on TSLA (13 calls).
- The signals with 80+ calls, like the SMA and EMA crosses, all land between 45% and 57%.

Look only at the SPY Bollinger row and you've found a "strategy". That's how overfitting starts: slice enough ways and one slice looks great.

## Does ADX regime weighting help?

The obvious objection: I'm averaging signals that contradict each other by design. **Trend** signals (MA crosses, MACD) say "it's going up, keep going". **Mean-reversion** signals (RSI, Bollinger %B) say "it's gone too far, expect a pullback". Which one is right depends on whether the market is trending or ranging.

**ADX** (Wilder's Average Directional Index) measures trend *strength* regardless of direction, which makes it the standard regime filter. So I added it to the panel and used it to reweight the votes, then reran the same backtest:

![Left: regime weights. Trending (ADX 25 or more) gives trend votes 1.5× and mean-reversion votes 0.5×. Mixed (20 to 25) leaves both at 1×. Ranging (20 or less) gives trend 0.5× and mean-reversion 1.5×. Right: next-open hit rate, equal votes to ADX-weighted. NVDA 52.9 to 53.3, AAPL 45.5 to 50.8, MSFT 43.8 to 44.3, TSLA 48.4 to 49.2, SPY 44.2 to 36.4. The always-up base rate sits to the right of every result.](/assets/images/signal-adx-weighting.svg)

Four small gains, one large loss. Only SPY's change is bigger than the noise, and it went the wrong way. Nothing gets near the base rate.

The regimes also turned out to be sticky. NVDA was "Ranging" on 73 of 84 days and MSFT "Trending" on 58, so in practice the weighting mostly applied one fixed tilt per ticker rather than adapting from day to day.

So **equal votes** stay the default. ADX weighting is a toggle in the bias card, and the track record shows both, so you can compare them yourself rather than take my word for it. The ADX row stays on the panel as one more vote, because "is there a trend at all?" is useful context even when it doesn't improve the forecast.

## Keeping the data fresh on a static host

All of this needs current data, and that was the other fix this week.

The site is static, on GitHub Pages. **Sync data** used to call Yahoo's chart API from the browser. That works locally through Vite's dev proxy, but not on `inotives.github.io`: Yahoo sends no CORS headers, so the browser blocks the response. The fallback public CORS proxies had both quietly died.

![Before: the browser on inotives.github.io calls Yahoo through public CORS proxies that are dead or rate-limited, and a direct call is blocked by CORS. After: a weekday GitHub Actions cron runs npm run stocks in Node, which writes stock-signals.json with 120 bars per symbol. npm run build deploys it to GitHub Pages, and the browser shows the newer of the snapshot and its own IndexedDB copy. If Yahoo refuses, continue-on-error ships the committed snapshot.](/assets/images/signal-snapshot-pipeline.svg)

The options were another free proxy (they come and go, and can see or alter whatever passes through), my own proxy such as a Cloudflare Worker (correct for live data, but a backend to run for a learning mock), or **fetching at build time**, where Node has no CORS problem. I went with the build. The deploy workflow got a weekday schedule and one extra step:

```yaml
on:
  push:
    branches: [master]
  # Weekdays after the US close (21:00 UTC in winter, 20:00 in summer)
  schedule:
    - cron: '30 22 * * 1-5'
  workflow_dispatch:

jobs:
  build:
    steps:
      # ...checkout, setup-node, npm ci
      - name: Refresh stock-signals snapshot
        run: npm run stocks          # fetches 120 daily bars per symbol from Yahoo
        continue-on-error: true      # if Yahoo refuses, ship the committed snapshot
      - run: npm run build
```

- **Build only, no commit back.** No bot commit every weekday. The committed JSON is just the fallback.
- **`continue-on-error`**: a Yahoo hiccup can't break a deploy. Worst case, yesterday's data ships.
- **Newest wins.** The page fetches the snapshot with `cache: 'no-cache'` and shows it or your earlier sync (kept in IndexedDB), whichever is newer.
- **Sync still works where it can**: through Vite locally, or your own proxy if you set one. On github.io it re-reads the snapshot and says plainly when a symbol isn't in it.

The trade-off is end-of-day data for a fixed list of symbols. For a page that reads daily bars, that's fine: free, no server, and the moving parts are one cron line and one npm script.

## What I'm taking from this

- **Always show the base rate next to the hit rate.** It's the cheapest honesty check there is. The track record view now puts both in the same sentence.
- **Indicators agreeing isn't evidence.** Most of these signals are different ways of measuring the same recent price move, so seven of them voting "up" is closer to one opinion than to seven.
- **Small samples produce great-looking slices.** If a 78% hit rate rests on 9 calls, treat it as a random result until it holds up over much more data.
- **Leave the losing result visible.** The mock still says "a learning mock, not trading advice", and now it shows why.

The [stock-signals mock](/mocks/stock-signals.html) has the Track record view next to Trend, Bands and Levels. Toggle next open / next close and equal / ADX-weighted to see the numbers above for each ticker. They'll drift as the daily snapshot rolls forward.

Sources: [Yahoo Finance](https://finance.yahoo.com) chart API (daily bars) · J. Welles Wilder, *New Concepts in Technical Trading Systems* (1978), for RSI, ATR and ADX · [GitHub Actions: schedule events](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule) · [MDN: Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · [Stock-signals mock (playground)](/mocks/stock-signals.html)
