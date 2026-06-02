---
title: "The FRAME Workflow: How I Structure My Day as a Crypto Data Analyst"
date: 2026-05-29
tags: [data-analyst, workflow, crypto, automation, dagster, dbt, compliance]
summary: "A practical breakdown of FRAME (Find, Review, Analyse, Model, Evaluate) — the workflow I use to cut through the chaos of crypto finance data work."
---

## The FRAME Workflow: How I Structure My Day as a Crypto Data Analyst

If you work with crypto data, you know the feeling: compliance needs KYC reports by EOD, the trading desk wants PnL reconciled before the morning meeting, asset management needs portfolio valuations, and somewhere in there you're supposed to keep the pipelines healthy. Every stakeholder is urgent. Every fire drill is real.

I built FRAME because jumping between fire drills wasn't scaling. Without a repeatable way to diagnose what's broken, decide what to fix first, and know when I'm done, I was just the person who made the loudest stakeholder happy — not the person who fixed the underlying problem.

FRAME stands for **Find, Review, Analyse, Model, Evaluate**. It formalises what I was already doing on good days — and forces me to do it on tired days too. Here's how each stage works in practice.

### The Shape of a Day

I work across six data domains, each with its own stack and its own definition of "urgent":

- **Compliance** — KYC/KYB flows through Dotfile, Salesforce, and Jumio. Travel Rules data for MAS, MiCA, and VARA filings. Hard deadlines, no extensions. Data lands in Postgres and needs to reconcile with screening results from compliance tools.
- **On-chain** — Treasury on Fireblocks. Transaction screening through Chainalysis KYT, TRM Labs, and Elliptic. Three KYT tools, three risk scales, zero alignment. DeFi positions and wallet activity across multiple chains.
- **Trading** — PnL and balance reconciliation across multiple exchanges. Orders and trades in different formats per venue. T+1 settlement cycles mean the data is never ready at the same time.
- **Asset Management** — CoinMarketCap and CoinGecko for portfolio valuations and NAV calculations. Different endpoints, different rate limits, different update cadences.
- **Dashboards** — Grafana for operational monitoring (pipeline health, data freshness). Looker for business-facing analytics (compliance KPIs, trading performance).
- **Pipelines and Modeling** — Dagster orchestrates the pipelines. dbt handles transformation. Data across BigQuery, CloudSQL, ClickHouse, and PostgreSQL.

The binding constraint across all of them: data arrives at different times, in different formats, with no standardised schema. My address book in Salesforce doesn't match my wallet labels in Chainalysis doesn't match my onboarding records in Dotfile. Reconciling them is table stakes.

---

### F — Find: Where I Start When Something Feels Broken

Find answers: *What is the actual problem? Where is the bottleneck? Is this worth solving?*

I ask myself five questions before touching any code:

**1. Is the source data clean?** If not, cleaning in dbt or Dagster is my first step, not an afterthought. I once spent a week building a unified compliance view only to discover Dotfile sends dates in DD/MM/YYYY and Salesforce sends MM/DD/YYYY. Both are strings, both are valid, neither is right.

**2. Is there a repetitive pattern?** "I run the same SQL every Monday to extract Travel Rules data for the MAS report" — yes, automate. "I investigate why this wallet suddenly moved 1000 ETH" — no, that's analysis, not toil.

**3. Is there a clear input and output?** Good: "Take yesterday's trades from ClickHouse, match against exchange CSVs, output reconciled PnL by 9 AM." Bad: "Build me something to monitor portfolio risk."

**4. Is someone actually waiting for this?** Regulator deadlines are hard. The trading desk's nice-to-have dashboard can wait.

**5. What's the cost of a mistake?** A wrong Travel Rules submission to MAS is a regulatory incident. A wrong number on my experimental Grafana panel costs nothing. I prioritise accordingly.

Here's how pain shows up across my domains and how I spot it:

| Domain | Pain point | How I spot it |
|---|---|---|
| Compliance | KYC data scattered across Dotfile, Salesforce, Jumio — no single customer view | Analyst manually cross-references three systems per applicant |
| On-chain KYT | Chainalysis, TRM, Elliptic label addresses differently — no unified risk score | Same wallet flagged "high risk" on one tool, "clean" on another |
| Trading | PnL from exchange A doesn't match exchange B for the same strategy | Daily reconciliation takes hours of manual diffing |
| Asset Management | CoinMarketCap and CoinGecko disagree on prices for the same asset | NAV calc differs depending which source I queried |
| Dashboards | Requests come as "can you add this?" — no spec, no priority | Pipeline of tickets with no triage |
| Pipelines | Dagster asset fails but downstream consumers don't know | "Hey, the report looks wrong" — hours after the silent failure |

The single biggest bottleneck I've hit wasn't analysis or visualisation — it was getting compliance data into a usable shape. Salesforce, Dotfile, and Jumio all hold pieces of the same customer, and none of them talk to each other. If I'd skipped Find and jumped straight to "let's build a compliance dashboard," I'd have a beautiful dashboard with a broken single customer view.

---

### R — Review: How I Clarify Fuzzy Requests

Review is the stage I used to skip. Someone says "this process is slow," and I used to immediately think "how do I make it faster?" Now I stop and ask why three times.

**A real example from my week:**

Compliance comes to me: "Travel Rules screening is taking too long — we're holding up deposits."

Why is it slow? My analyst checks each Travel Rules hit manually against Chainalysis KYT and TRM Labs. *Layer: manual cross-referencing — two KYT tools with no unified view.*

Why manual cross-ref? Chainalysis says "medium risk," TRM says "high" — the analyst has to decide which to trust. *Layer: no consensus risk score across KYT providers.*

Why no consensus score? Each KYT tool has its own API, its own response schema, and we store results in different BigQuery tables. *Layer: data fragmentation — the real root cause.*

**What I actually did:** Built a dbt model that ingests Chainalysis and TRM alerts into BigQuery, normalises the risk levels to a common 1-5 scale, and surfaces cases where they disagree. The analyst reviews only the disagreements. Screening time dropped 70%. No AI involved.

**The anti-pattern I still catch myself doing:** Stopping at Why #1. "Why is Travel Rules slow? — Lots of alerts. — OK let's get an LLM to summarise them all." That's how money gets wasted on the wrong problem.

**How I set goals after Review — vague to measurable:**

| Before | After |
|---|---|
| "Speed up Travel Rules" | "Cut per-case screening time from 12 min to 3 min with no false negatives on sanctions matches" |
| "Better compliance reporting" | "Reduce MiCA weekly report prep from 4 hours to 1 hour with under 2% error rate on customer counts" |
| "Improve PnL reconciliation" | "Detect 95% of exchange PnL discrepancies within 15 min of EOD data load" |
| "Help asset management" | "Deliver portfolio NAV by 8 AM with under 0.5% variance across CoinMarketCap and CoinGecko" |

If AI ends up in scope, I also define boundaries upfront:
- Which decisions can it make alone? (flag a transaction as low risk — auto-clear)
- Which need human review? (flag a transaction for investigator review)
- What if it's wrong? (fallback to manual, documented error budget)
- What data can it touch? (read-only on BigQuery views, no write to production)

---

### A — Analyse: How I Pick What to Optimise

Analyse is where I decide which dimension to optimise and whether I reach for AI, a dbt model, a Dagster pipeline, or a new Grafana panel.

There are three axes, and I cannot optimise all three in one pass:

```
                    Speed
                   /|\
                  / | \
                 /  |  \
                /   |   \
               /    |    \
          Accuracy +-----+ Cost
```

Rules I follow:
- Pick the axis my Review step identified as most urgent
- Different workflows optimise different axes. Trading PnL needs accuracy; ops dashboards need speed.
- Trying to optimise all three stalls me every time.

**How I decide by pain point:**

| What's hurting | Primary axis | What I typically do | Tool |
|---|---|---|---|
| KYC data scattered | Speed | dbt model to join Dotfile + Salesforce + Jumio into unified customer view | dbt + BigQuery |
| KYT alerts don't agree | Accuracy | Normalise risk scores across Chainalysis, TRM, Elliptic into one consensus field | dbt (rule-based) |
| PnL takes hours to reconcile | Speed | Dagster pipeline that pulls exchange CSVs, matches to ClickHouse trades, flags discrepancies | Dagster + Python |
| Grafana dashboard too slow | Cost | Tune ClickHouse queries, pre-aggregate, reduce refresh rate on expensive panels | ClickHouse + Grafana |
| MiCA report errors | Accuracy | Add dbt tests for data quality assertions on compliance tables | dbt tests + Dagster alerts |
| Client portfolio site stale | Speed | Build Vite + React MVP querying materialised views instead of live APIs | Vite + React + BigQuery |

**When I say no to AI:**

- If a dbt model + Dagster asset does it: I do that.
- If a ClickHouse materialised view solves it: I do that.
- If the rule is deterministic ("if KYT risk score >= 4, flag for review"): rule-based, not AI.
- If regulatory filings are involved: human in the loop. Always.

I only reach for AI when the task genuinely needs natural language understanding — like summarising a batch of KYT alert patterns for the compliance team's morning review.

**When things get complex enough to consider AI (rare), I break the workflow into roles:**

- **The Scanner** — watches on-chain activity via Chainalysis and TRM, flags anomalies. Rule-based for known patterns, AI for genuinely novel activity.
- **The Validator** — cross-checks PnL across exchanges, runs dbt tests, verifies data freshness. Always rule-based. Never AI.
- **The Reporter** — generates narrative summaries from structured compliance data. LLM with strict guardrails.
- **The Approver** — signs off on regulatory filings, high-value transactions. Always human.

---

### M — Model: How I Build the Minimum Testable Thing

Model is where I build the smallest version that tells me whether I'm on the right track. For me, that means one dbt model, one Dagster asset, one Grafana panel — never the full system.

**My prototyping rules:**

1. **Start with one source, one metric.** If I'm building a unified compliance view, I start with getting just the customer name to match across Dotfile and Salesforce. If that join is wrong, the whole view is wrong.

2. **Use the simplest tool that works.** My order of preference:
   - dbt model + BigQuery SQL — zero new infrastructure
   - Python script in a Dagster asset — I own the orchestration already
   - Grafana panel on existing data source — no new UI work
   - Vite + React page — only when stakeholders need something interactive
   - LLM agent — last resort. Prompt debugging takes longer than the model.

3. **Mock the data if the real pipeline isn't ready.** A dbt model that runs on yesterday's export is better than waiting for the perfect real-time feed.

4. **Human reviews the output before it reaches stakeholders.** The MVP produces output I check. Only after trust is established do I automate distribution.

**Cost reference for each approach:**

| Approach | Time to MVP | Iteration speed |
|---|---|---|
| dbt model + BigQuery | 2-6 hours | Fast |
| Python / Dagster asset | 2-8 hours | Medium |
| Grafana panel | 1-2 hours | Fast |
| Vite + React page | 4-12 hours | Medium |
| LLM agent | 4-16 hours | Slow (prompt debugging) |
| Full Airflow migration | 40-160 hours | Very slow |

Dagster + dbt is my default stack. I already own the orchestration and transformation layers. Adding a new asset or model costs hours, not days.

**Example one: unified on-chain risk score**

My KYT providers each return risk levels on different scales. Reconciling them was manual.

- Stage 1: dbt model pulling last 7 days of alerts from all three into BigQuery, mapping risk levels to a 1-5 scale, flagging disagreements. Half a day.
- Stage 2: Dagster schedule runs it daily, posts disagreements to a compliance Slack channel. Another half day.
- Stage 3: Looker dashboard showing trend of alert volume per provider. One hour.

Value at Stage 1 (no more SQL copy-paste across three tools). More value at Stage 2 (proactive alerts). Stage 3 was optional but nice.

**Example two: client portfolio site**

Asset management wanted a real-time portfolio view for investors. I didn't build a full platform.

- Stage 1: dbt models in BigQuery computing NAV from CoinMarketCap prices and internal positions. Already existed from reporting.
- Stage 2: Vite + React page querying those materialised views via a simple API. No live API wrangling, no cache layer. A weekend.
- Stage 3: Grafana alerts if price feeds are stale. An hour.

Stakeholders got their site at Stage 2, built on data they already trusted.

---

### E — Evaluate: How I Know Whether It Actually Helped

Evaluate answers: *Did this help? Should I keep it, change it, or kill it?*

**The metrics I track:**

| Category | Metric | How I measure |
|---|---|---|
| Time saved | Hours per week reclaimed per domain | Before/after time logs with my team |
| Speed | Report generation time | Pipeline run duration in Dagster |
| Accuracy | Error rate in outputs | Count of corrections, dbt test failures |
| Compliance | Regulator findings | Audit trail completeness, pass rate |
| Adoption | Stakeholder usage | Dashboard views, workflow runs, repeat requests |
| Maintenance | Hours per month | Dagster alert frequency, debug time |
| Satisfaction | Direct feedback | I ask — especially compliance and trading desk |

**A real evaluation from my work:**

Goal from Review: "Cut MiCA weekly compliance report from 4 hours to 1 hour with under 5% error rate."

| Metric | Before | Target | Actual | Verdict |
|---|---|---|---|---|
| Report prep time | 240 min | 60 min | 45 min | Pass |
| Error rate | 12% | < 5% | 2% | Pass |
| Team time saved | 0 hr/wk | 3 hr/wk | 3.5 hr/wk | Pass |
| Regulator feedback | No comments | No findings | Clean audit | Pass |
| Maintenance effort | N/A | < 2 hr/month | 30 min/month | Pass |

**My decision gates after evaluation:**

- Improvement > 50% → Expand scope — more KYT providers, more exchanges, more assets
- Improvement 20-50% → Keep running but investigate whether a different approach yields more
- Improvement < 20% → Return to Analyse — wrong axis? Wrong tool? Wrong problem?
- Worse than before → Return to Review — the 3 Whys missed the real problem

**The failure mode I watch for:** When something works, I move on. Six months later, a KYT provider changes its API, MiCA updates its reporting template, or someone leaves and nobody knows how the dbt model works. I now bake a heartbeat check into every Dagster pipeline — a weekly assertion that X rows were processed with under Y failures, with a Slack alert if the check stops passing.

---

### Putting FRAME to Work: Three Real Workflows

**Workflow A: Travel Rules Regulatory Reporting**

| Stage | What I did | Outcome |
|---|---|---|
| Find | Compliance spent 4 hours every Monday extracting Travel Rules data and cross-referencing with Chainalysis | Identified: no single view of Travel Rules + KYT — manual copy-paste between three tools |
| Review | 3 Whys: data lives in one system, KYT in another, report template changes quarterly | Goal: 1-hour report prep with 0 missed alerts |
| Analyse | Accuracy is regulatory — must be correct. Speed is secondary | Decision: dbt model to join and normalise, Dagster to automate |
| Model | dbt model pulling Travel Rules + Chainalysis into BigQuery, unified schema, Dagster runs Monday 6 AM | MVP in one day; I review output before it goes to compliance |
| Evaluate | Prep time dropped from 4 hours to 1 hour. Error rate from 12% to 2%. No regulator findings | Expanded to MiCA and VARA reporting next quarter |

**Workflow B: Exchange PnL Reconciliation**

| Stage | What I did | Outcome |
|---|---|---|
| Find | Trading desk spent 2 hours daily comparing PnL from exchange A vs B vs internal ClickHouse records | Identified: no automated reconciliation |
| Review | Exchanges send trade data at different times, no unified trade ID across venues | Goal: automated discrepancy detection within 15 min of EOD load |
| Analyse | Speed is the bottleneck — the desk needs PnL before the morning meeting | Decision: Dagster pipeline with Python matching logic |
| Model | Dagster asset pulling trades from ClickHouse, matching exchange CSVs, flagging unmatched rows | Pipeline runs, sends Slack summary with discrepancy count |
| Evaluate | Reconciliation time from 2 hours to 10 min. Detection rate > 95% | Added daily email digest for head of trading |

**Workflow C: On-Chain Transaction Screening Alignment**

| Stage | What I did | Outcome |
|---|---|---|
| Find | Analysts manually cross-checked Chainalysis KYT and TRM Labs for same transactions | Risk scoring was inconsistent: same transaction, two verdicts |
| Review | No unified risk model, no central repository, analysts trusted whichever tool they opened first | Goal: single source of truth for all KYT alerts |
| Analyse | Accuracy is everything — a false negative on sanctions is a regulatory event | Decision: normalise both providers, flag only disagreements |
| Model | dbt model ingesting both KYT APIs into BigQuery, mapping risk levels to 1-5 | Half-day build; 30% of cases flagged as disagreements needing human review |
| Evaluate | Analyst review time dropped 60%. False positives caught before reaching the team | Expanded to include Elliptic; planning weekly trend dashboard |

---

### What I'm Still Figuring Out

- **The right ratio of AI vs rules.** I'm roughly 80/20 rule-based/AI right now, but that's a guess — compliance and trading have inherently lower tolerance for non-deterministic logic.
- **Handing off to engineering.** The Model stage often reveals infrastructure needs I can't unblock myself — new API integrations, BigQuery slot scaling, productionisation decisions.
- **Different weights per domain.** A compliance workflow weights Accuracy > Speed > Cost. A trading pipeline weights Speed > Accuracy > Cost. A dashboard prototype weights Speed > Cost > Accuracy. The core cycle holds but the axis priority flips.
- **Plugging into sprint planning.** Evaluate naturally feeds into retrospectives, but I haven't formalised the handoff from analyst workflow to engineering ticket.

### The Takeaway

The biggest wins didn't come from building fancier dashboards or deploying AI agents. They came from stopping to ask the right question before reaching for a tool.

**Your first step:** Next time someone says "this is slow," ask why three times before you write a single line of code.
