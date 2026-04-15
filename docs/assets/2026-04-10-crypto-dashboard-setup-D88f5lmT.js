var e=`---
title: "Setting Up a Crypto Dashboard"
date: 2026-04-10
tags: [crypto, dashboard, tutorial]
summary: "How to set up a real-time crypto dashboard using public exchange APIs."
---

# Setting Up a Crypto Dashboard

One of the things I enjoy building is real-time dashboards that pull data from public cryptocurrency exchange APIs.

## The Concept

The idea is simple:
1. Pick a few public REST APIs (Binance, Gemini, Kraken, etc.)
2. Poll them on an interval (every 5-30 seconds)
3. Display the data in widgets — text, gauges, sparklines

No backend needed. No database. Just a static HTML page making \`fetch\` calls.

## Public APIs Used

| Exchange | Endpoint | Data |
|----------|----------|------|
| Binance | \`/api/v3/ticker/24hr\` | 24h price and volume |
| Gemini | \`/v1/pubticker/:symbol\` | Last price, bid, ask |
| Kraken | \`/0/public/Ticker\` | OHLC, volume, VWAP |

## Example Fetch

\`\`\`javascript
async function getPrice(symbol) {
  const res = await fetch(
    \`https://api.binance.com/api/v3/ticker/price?symbol=\${symbol}\`
  );
  const data = await res.json();
  return parseFloat(data.price);
}
\`\`\`

## What's Next

In a future post, I'll show how to build a React component that wraps this into a reusable dashboard widget.
`;export{e as default};