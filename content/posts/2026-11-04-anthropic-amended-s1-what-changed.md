---
title: "Anthropic's amended S-1: what changed since the playground snapshot"
date: 2026-11-04
tags: [anthropic, ipo, s-1, sec-filings, ai-economics, compute, valuation]
series: building-ai-systems
summary: "On November 2, Anthropic filed Amendment No. 1 to its S-1. It adds the third quarter: $17.0B of revenue, but a small operating loss after a profitable Q2, mainly from $5.0B of expensive short-term compute. It also puts the first all-in number on compute commitments, $895.4B, and adds a sentence saying its models may soon meet its own threshold for AI that speeds up AI research. The price range is still blank. Here is how it compares with the data in our ANT IPO playground, what it means for a $1.5T to $2T valuation, and, judged against the first six months of SpaceX, Cerebras, CoreWeave, Circle and Figma, where a long-term entry has historically made more sense than day one. Not financial advice."
---

Last week I built an [ANT IPO explorer](/mocks/anthropic-ipo.html?view=filing) in the playground: a 3D view of what Anthropic's [Form S-1 of October 26](https://www.sec.gov/Archives/edgar/data/0002130357/000162828026067168/anthropicpbc-sx1.htm) showed, with scenarios for the first day and week of trading. Seven days later, on November 2, Anthropic filed [Amendment No. 1 (S-1/A)](https://www.sec.gov/Archives/edgar/data/2130357/000162828026068676/anthropicpbc-sx1ax1.htm).

An amendment like this is normal. Companies update the S-1 as new quarters close and as the SEC comments, and a later amendment adds the price range just before the roadshow. This one matters because it adds a full quarter of results and fills in numbers the first filing left blank.

I read both filings from SEC EDGAR, compared them sentence by sentence, and took the third quarter as the nine-month totals minus the first half. All figures below come from the filings unless I say otherwise.

*Disclosure: this note was researched and written with Claude, which is made by Anthropic. Nothing here is financial advice; see the disclaimer in the entry-price section.*

## What the amendment changes

![A table comparing the October 26 S-1 with the November 2 S-1/A on eleven items, each marked as supporting the valuation, adding pressure, new, or unchanged.](/assets/images/ant-s1a-what-changed.svg)

In short:

- **It adds Q3.** The filing now covers the nine months to September 30. Revenue was $33.2B for the nine months and **$17.0B in Q3 alone**, up 1,127% on Q3 2025.
- **The operating profit did not last.** Q2 had a GAAP operating profit of $974M. Q3 has an **operating loss of $567M**. The company gives two reasons: $5.0B of compute bought on short-term deals, which "currently costs significantly more" than its multi-year contracts, and a $2.0B non-cash charge for its donation-matching program. Its own non-GAAP measure, Adjusted Operating Income, still rose from $2.2B to $2.5B, but the margin fell from 19% to 15%.
- **The net loss grew to $104.0B for nine months** ($23.3B in Q3). As in the first filing, almost all of it is the revaluation of convertible notes as the company's value rises ($21.9B in Q3), not cash spent.
- **Cash stayed flat** at $131.8B. Total liabilities rose by $29.2B to $146.7B.
- **Compute commitments get a full number: $895.4B.** The October filing left this total blank.
- **The Google cloud commitment rose** from at least $114.5B to at least $121.3B.
- **There is a new safety sentence in the risk factors.** It says internal estimates for *future* models "indicate that we may imminently meet our Responsible Scaling Policy's definition of 'dramatically accelerated progress attributable to AI'". No current model has been designated as crossing that threshold. The October filing already said models contribute to the pace of Anthropic's research; this sentence is new.
- **Still blank:** the price range, the number of shares offered, the proceeds, and run-rate revenue as of October 31. Those normally arrive in the next amendment.

## The quarter: revenue up, margin down

![Left: quarterly revenue from $1.4B in Q3 2025 to $17.0B in Q3 2026, with growth slowing from 147% to 46% quarter on quarter. Right: operating result of minus $1.67B in Q1, plus $0.97B in Q2 and minus $0.57B in Q3 2026.](/assets/images/ant-s1a-quarters.svg)

Two things are true at the same time. Revenue is still growing very fast: $4.7B, then $11.6B, then $17.0B a quarter. But quarter-on-quarter growth slowed from about +147% to +46%. That is expected as the base gets larger, and the filing itself warns that run-rate growth "may decline significantly and more rapidly than we anticipate".

The margin story is about compute supply, not demand. Anthropic signs most compute 12 to 18 months ahead. When demand runs ahead of that, it buys short-term capacity at higher prices, and it expects to keep doing so "in the near term", which will "compress our operating margin". In Q3, compute and infrastructure cost $9.9B, more than in the whole first half ($8.9B), and rose to 58% of revenue from 55% in the first half. This is the same problem I wrote about in [personal AI agents](/notes/2026-11-04-personal-ai-agents-same-soul-new-body): demand for agentic work is outrunning the compute bought for it.

## $895.4 billion of compute

The biggest new number is the commitments total.

![Three stacked bars of the $895.4B total: by counterparty, by timing and by firmness. Reference lines show cash on hand of $131.8B and the playground's $417B figure.](/assets/images/ant-s1a-commitments.svg)

- **By counterparty:** Google at least $121.3B, SpaceXAI (formerly xAI) up to $120.5B, Amazon $110.0B and Microsoft $44.9B. The remaining roughly $499B is other providers and leases; I derived that remainder myself.
- **By timing:** $69.8B is due in the 12 months after September 30. About $447.5B falls due by the end of 2030. The rest runs from 2031 to 2045.
- **By firmness:** about $213.8B depends on conditions such as the provider securing financing, facilities or approvals, or can be terminated. The rest is firm.

Against $131.8B of cash, the next year's $69.8B is covered almost twice over, before counting new revenue. The long tail only works if revenue keeps growing for years.

## How this compares with the playground data

The playground's **Filing** view was built from the October S-1 and press coverage. Most of it still holds, but three items need a note:

| Playground item | What it showed | After the amendment |
| --- | --- | --- |
| Revenue, first half of 2026 | $16.29B | Unchanged; Q3 adds $16.96B, so nine months are $33.24B |
| Net loss, first half of 2026 | $80.7B, about $72B non-cash | Unchanged; nine months are $104.0B, with $94.3B non-cash |
| Future compute commitments | $417B | **Not like for like.** $417B is a note in the October financial statements covering agreements signed *after* December 31, 2025. The headline total was blank. The S-1/A total is $895.4B and covers everything. |
| Operating expenses, first half | $17.0B, "including $9.7B of R&D and $3.8B of sales and marketing" | The total matches ($16.98B), but the filing has no R&D line. Its lines are compute and infrastructure ($8.9B), personnel ($3.2B), sales, marketing and partnerships ($3.2B) and other ($1.7B). The R&D and S&M split came from press coverage. |
| Gross margin "85%" | From press coverage | The filing does not report a gross margin. The ratio it does give, compute and infrastructure cost to revenue, was 55% in the first half and 58% in Q3. |
| Last private valuation, IPO target | $965B; $1.5T to $2T reported | Unchanged. No price range has been filed yet. |
| Share base | About 16.94B fully diluted | Unchanged. The same 846,840,960-share 5% figure appears in both filings. |

The playground's day-one and first-week scenarios do not need new inputs yet. They depend on the price range and float, which are still blank. The Filing view itself should move its compute cube to $895.4B and label the expense breakdown with the filing's own lines.

## Does it change the valuation?

The reported target is $1.5T to $2T; that comes from press reports, not the filing. The share count did not change, so the price-per-share maths in the playground still holds: $1.5T is about $88.55 a share and $2T about $118.06. What changed is how expensive that price looks against revenue:

![A dumbbell chart: at $1.5T the multiple of trailing revenue falls from 76 to 42 times and of the latest quarter annualised from 32 to 22 times; at $2T from 101 to 57 and from 43 to 30 times. A side panel lists what supports and what weighs on the valuation.](/assets/images/ant-s1a-valuation.svg)

Trailing 12-month revenue rose from $19.7B (to June 30) to $35.3B (to September 30). The same $2T price drops from about 101 times trailing revenue to about 57 times. On the latest quarter annualised, it drops from 43 to 30 times. In that narrow sense, the amendment makes the target easier to defend.

My reading, which is analysis and not investment advice:

- **Supports the $1.5T to $2T range:** a $17.0B quarter, a rising Adjusted Operating Income, more than 11,900 customers spending over $100,000 a year, and cash that held steady through a very expensive quarter.
- **Weighs on it:** slowing quarter-on-quarter growth, a return to a GAAP operating loss, $895.4B of commitments with more short-term compute to come, and new risk language about AI speeding up AI research. That last item is a safety disclosure first, but investors will read it as a sign of both opportunity and regulatory risk.
- **Net effect:** the amendment makes the revenue side stronger and the cost side clearer. It supports pricing inside the reported range rather than above it. The things that will actually move the valuation are still missing: the price range, the share count and run-rate revenue at October 31. The Q3 operating loss and the compute total are now known and will be part of the roadshow discussion.

Press reports say the roadshow cannot start before November 10; that date is not in the filing. The price range should arrive in the next amendment, and that is the point to revisit the playground's day-one scenarios.

## A possible entry price for long-term holders

> **Disclaimer: this is not financial advice.** It is a personal research note that looks at how five recent IPOs traded and maps those patterns onto an IPO that has not been priced yet. I am not a licensed adviser. Past IPO performance does not predict how ANT will trade, prices can fall well below any level mentioned here, and you should do your own research or talk to a licensed adviser before buying any security.

No price range has been filed, so any entry price has to be relative to the IPO price. To make the numbers concrete I use the middle of the reported range, **$1.75T, which works out to about $103.31 a share** on the 16.94B fully diluted shares in the filing. If the real price is different, every zone below scales with it.

### What happened after five recent big IPOs

I took five large, recent, well-watched listings and pulled their daily closing prices for the first six months (about 126 trading days). SpaceX and Cerebras listed less than six months ago, so their data runs to November 2.

| Company | Listed | IPO price | Day-one close | Lowest close in 6 months | When | Close at 6 months vs day-one close |
| --- | --- | --- | --- | --- | --- | --- |
| SpaceX (SPCX) | Jun 12, 2026 | $135 | $160.95 (+19%) | $108.27 (−20% vs IPO) | Day 37, Aug 5 | $136.37, −15% (day 99, so far) |
| Cerebras (CBRS) | May 14, 2026 | $185 | $311.07 (+68%) | $96.36 (−48% vs IPO) | Day 119, Nov 2 | $96.36, −69% (day 119, so far) |
| CoreWeave (CRWV) | Mar 28, 2025 | $40 | $40.00 (flat) | $35.42 (−11% vs IPO) | Day 16, Apr 21 | $122.52, +206% |
| Circle (CRCL) | Jun 5, 2025 | $31 | $83.23 (+168%) | $66.93 (+116% vs IPO) | Day 118, Nov 20 | $87.46, +5% |
| Figma (FIG) | Jul 31, 2025 | $33 | $115.50 (+250%) | $25.92 (−21% vs IPO) | Day 127, Jan 30 | $25.92, −78% |

![Line chart of the five IPOs over their first six months, indexed to each one's day-one close. CoreWeave ends at about 3.1 times, Circle at 1.05, SpaceX at 0.85, Cerebras at 0.31 and Figma at 0.22.](/assets/images/ant-ipo-comparables.svg)

Three patterns stand out:

1. **Buying at the day-one close lost money in three of five cases.** SpaceX, Cerebras and Figma were all below their first-day close six months later. The bigger the first-day jump, the worse it went: Figma rose 250% on day one and then fell 78%, and Cerebras rose 68% and then fell 69%. CoreWeave priced below its range, did not rise on day one, and did best.
2. **Four of five traded below their IPO price within six months.** Only Circle never did. Waiting for the IPO price to come back has usually worked, though not always.
3. **The lows often came late.** Three of the five hit their six-month low between trading days 118 and 127, around the time lock-ups expire and early holders can sell. ANT's S-1/A describes a staggered lock-up: some shares can be released from around the 27th day, and the full 180-day lock-up ends after that. Each release adds shares that can be sold.

### Mapping the patterns onto ANT

![A price ladder for ANT shares. At an illustrative $103.31 IPO price, a chasing-day-one zone runs from $123 to $174, an around-the-IPO-price zone from $93 to $108, and a post-lock-up discount zone from $62 to $83. Implied valuations and private-market marks are shown alongside, plus where each comparable's six-month low would land.](/assets/images/ant-entry-zones.svg)

| Zone | Price per share (at a $103.31 IPO) | Implied valuation | Trailing revenue multiple | What history says |
| --- | --- | --- | --- | --- |
| Chasing day one | $123 to $174 (IPO +19% to +68%) | about $2.1T to $2.9T | about 59× to 83× | Worst outcome in three of five cases |
| Around the IPO price | $93 to $108 (IPO −10% to +5%) | about $1.6T to $1.8T | about 45× to 52× | Four of five came back to this level |
| Post-lock-up discount | $62 to $83 (IPO −40% to −20%) | about $1.05T to $1.4T | about 30× to 40× | Where SpaceX and Figma bottomed; Cerebras went lower |

The discount zone also lines up with where private investors have recently valued the company: the board's September 30 mark ($71.43), the Nasdaq Private Market price ($85.10) and the Series H round ($58.90, equal to about $1.0T).

### Which zone looks best

On this evidence, the better zones for a long-term holder have been **at or below the IPO price, and after the first lock-up releases**, not on the first day. If I were planning an entry, I would think of it in stages rather than as a single price:

- **Avoid chasing the first-day jump.** Above roughly $123 (a $2.1T valuation at a $103.31 IPO price), history has punished buyers more often than it rewarded them.
- **Around the IPO price ($93 to $108)** is a reasonable zone for a first, smaller part of a position. Four of the five comparables traded back here.
- **The post-lock-up discount ($62 to $83)** has historically offered the most value, if it comes. At that level ANT would trade at roughly 30 to 40 times trailing revenue, close to private-market marks.
- **Keep some cash for the lock-up window.** The lows in this sample clustered around four to six months after listing.

The obvious counter-example is CoreWeave. It priced low, never really gave buyers a dip, and tripled. A company growing as fast as Anthropic could do the same, so there is a real risk of waiting and never buying. That is why I would spread purchases over time instead of betting everything on one level.

Once the real price range is filed, multiply it by 0.9 to 1.05 for the IPO-price zone and by 0.6 to 0.8 for the discount zone to rebuild these levels.

> **Disclaimer, again: this is not financial advice.** These zones come from five past IPOs and an assumed IPO price. They are not price targets or forecasts. IPO shares are volatile, and lock-up releases, new filings and market conditions can move the price far outside these ranges. Only invest money you can afford to lose, and consider speaking to a licensed financial adviser.

Sources: [Anthropic Form S-1, October 26, 2026](https://www.sec.gov/Archives/edgar/data/0002130357/000162828026067168/anthropicpbc-sx1.htm) · [Anthropic Form S-1/A, November 2, 2026](https://www.sec.gov/Archives/edgar/data/2130357/000162828026068676/anthropicpbc-sx1ax1.htm) · [Fortune on compute costs, November 3](https://fortune.com/2026/11/03/musk-says-grok-bots-costs-are-unsustainably-high-while-openai-admits-dots-are-compute-heavy-is-the-personal-ai-agent-push-dead-on-arrival/) · [Unite.AI on the compute commitments](https://www.unite.ai/anthropic-details-long-term-compute-commitments-in-amended-ipo-filing/) · [Crypto Briefing on the AI research threshold](https://cryptobriefing.com/anthropic-s1a-ai-progress-threshold-ipo/) · [PPC Land on the Q3 operating loss](https://ppc.land/anthropic-swings-to-567m-q3-operating-loss-on-5bn-of-short-term-compute/) · [ANT IPO explorer (playground)](/mocks/anthropic-ipo.html?view=filing)

IPO comparison data: daily closes from Yahoo Finance (SPCX, CBRS, CRWV, CRCL, FIG) · [CBS News on the SpaceX debut](https://www.cbsnews.com/news/spacex-stock-price-ipo-spcx-initial-public-offering/) · [CNBC on the Cerebras debut](https://www.cnbc.com/2026/05/14/cerebras-cbrs-stock-trade-nasdaq-ipo.html) · [CNBC on CoreWeave's $40 pricing](https://www.cnbc.com/2025/03/27/coreweave-prices-ipo-at-40-a-share-below-expected-range.html) · [Bloomberg on Figma falling below its IPO price](https://www.bloomberg.com/news/articles/2025-11-21/figma-falls-below-ipo-price-less-than-four-months-after-debut) · [FourWeekMBA on SpaceX below $135](https://fourweekmba.com/ai-spacex-shares-close-below-135-ipo-price-36-off-peak/)
