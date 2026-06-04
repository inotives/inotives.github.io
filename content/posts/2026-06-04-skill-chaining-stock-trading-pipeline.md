---
title: "Skill Chaining: Building Connected AI Workflows That Pass Data Between Skills"
date: 2026-06-04
tags: [claude-skills, skill-chaining, trading, stock-analysis, pre-market, workflow-automation, skill-packs, agent-skills]
summary: "Individual skills handle single workflows. Skill chaining connects them into pipelines — where one skill's output becomes another's input, with explicit interface contracts, prerequisite enforcement, and state management rules between each step."
---

## Skill Chaining: Building Connected AI Workflows That Pass Data Between Skills

Individual skills are self-contained. They take an input, follow a procedure, produce an output. But most real workflows aren't single-step — they're chains: this runs, then that runs on top of the result, then something else consolidates everything.

Anthropic's skills guide describes skills as recipes. Skill chaining is the cookbook — multiple recipes sequenced so the output of one dish becomes the ingredient for the next. The skills don't call each other directly. They don't need dependency management or orchestration layers. The chain works because each skill defines a clear **interface contract** — what it needs as input, what it produces as output, and what state it expects before it runs.

This post covers the guidelines for skill chaining first, then maps them to a real two-skill trading pipeline.

---

## Part 1: The Guidelines

### 1. Interface Contracts — The Foundation of Skill Chaining

Every skill that participates in a chain must define explicit inputs and outputs. This is the single most important rule. Without it, you cannot guarantee that Skill A's output is usable as Skill B's input.

The interface section sits in the skill's YAML frontmatter or a dedicated section in the body:

```yaml
## Interface

* **Input:** `ticker` (`String`) — single uppercase symbol (e.g. `NVDA`)
* **Input:** `analysis_date` (`String`, optional) — `YYYY-MM-DD`; defaults to today
* **Output:** `brief_path` (`Path`) — path to the generated summary file
* **Output:** `entity_updated` (`Boolean`) — whether the entity file was bumped
* **Return (JSON):** `{"status": "OK", "message_log": [...], "output": "<path>"}`
```

**The rules:**
- Every input specifies its **type** (`String`, `Path`, `Int`, `Enum`, `Boolean`) — this tells the downstream skill what to expect
- Every output specifies a **concrete path** or data shape — the downstream skill knows exactly where to find its input
- Optional inputs have explicit defaults — the chain doesn't break when they're omitted
- Return values use a consistent JSON envelope — any skill in the chain can parse any other skill's result

### 2. Prerequisite Enforcement — Fail Early, Fail Clearly

A chained skill must verify its prerequisites before doing any work. This is the guardrail that prevents cascading failures where Skill B silently produces garbage because Skill A hadn't run yet.

The pre-open prediction skill demonstrates this rule explicitly:

> "The anchor market close summary must exist at the expected path. If missing, instruct the user to run stock_market_close_summary first; do not fabricate the anchor."

This is the correct pattern: **check, refuse, explain**. The skill does not attempt to work around a missing prerequisite. It tells the user what to run and why.

**The rule:** Every chained skill's first step is a precondition check. If the upstream output doesn't exist, the skill stops immediately with a clear message about what's missing.

### 3. Read-Only vs Write Ownership — State Sharing Protocol

When two skills share state through the filesystem, they need rules about who writes what. The pair demonstrated here uses a clear protocol:

| Skill | Reads | Writes |
|-------|-------|--------|
| Market close summary | Entity snapshot files (read-only) | `daily/{date}.md` brief, entity `sources:` update |
| Pre-open prediction | `daily/{date}.md` brief (read-only), prior predictions (backtest append) | `predictions/{date}.md` prediction card |

**The rules:**
- The close summary **owns** the daily brief directory. The prediction skill only reads from it.
- The prediction skill **owns** the predictions directory. It never writes to the daily briefs.
- Entity files are updated only by the close summary (which records realised data). Predictions are forward-looking and ephemeral — they never bump entity state.
- The prediction skill appends backtest data to **prior** prediction files (not the current one), preserving the write boundary.

This prevents the most common failure mode in chained systems: two skills overwriting each other's state.

### 4. Production Path — Deterministic File Layout

Skills in a chain must agree on file paths. Hard-coding paths in each skill creates coupling. The solution is a **shared convention** that both skills derive from the same parameters:

```
{ticker_lower}/daily/{date}.md    — close summary output
{ticker_lower}/predictions/{date}.md  — prediction output
```

Both skills derive `ticker_lower` from the input ticker and `date` from the analysis date. No skill stores the other's path. The convention is implicit — both follow the same pattern.

**The rule:** Skills in a chain should share a path convention, not hard-coded paths. Derive every path from the same input parameters.

### 5. Delta, Not Replacement — Chain Skills That Layer

The pre-open prediction skill includes an important constraint: "Do not re-run the full 11-section close-summary template. This skill is a **delta on top of the prior close summary**, not a replacement for it. Keep output ≤ 1500 words."

This is the correct layering pattern. Skill B references Skill A's output as authoritative for certain data — trigger lines, support/resistance, catalyst calendar — and adds new information on top. It doesn't duplicate or regenerate what A already produced.

**The rules:**
- A chained skill should be smaller than its upstream — it's adding to existing analysis, not rederiving it
- Explicitly state what information is inherited from the upstream skill and what is new
- Keep output tight — the user already has Skill A's output; Skill B is a supplement

### 6. Backtest Hooks — Self-Calibrating Chains

The most sophisticated pattern in this chain is the backtest hook. When the prediction skill finishes, it checks if a **prior** prediction exists for the same ticker and appends realised values:

> "When a new prediction is written, if the prior session's prediction for the same ticker exists, scan its backtest section and append realised values (actual open with cone-hit? actual high/low, actual close with band-hit?, direction correct?) to that prior file."

This turns the chain into a closed loop: close summary → prediction → realised close summary → backtest against prediction → improved future predictions. No separate audit pass needed.

**The rule:** Every Nth run, include a calibration summary that references the backtest trail. This is how a skill chain improves over time without manual review.

### 7. Parallel Execution — When the Chain Fans Out

Some chains are linear (A → B → C). Others fan out: one skill produces output for multiple tickers, then a downstream skill processes each one in parallel.

The pre-open prediction skill explicitly supports parallel execution:

> "For each ticker, run the skill in parallel (one sub-agent each, run_in_background=true)."
> "After all predictions are written, generate a consolidated HTML report."

The chain here is: close summary (per ticker, individual) → pre-open prediction (per ticker, parallel) → consolidated report (single, collects all predictions).

**The rule:** Design your skill chain so each step can run independently. Parallel execution is an optimisation — the chain works serially too, but the interface contracts make parallelism trivially safe.

---

## Part 2: Real Trading Pipeline — Close Summary → Pre-Open Prediction

This is a two-skill chain I use after every US market close. It runs in sequence: close summary during the evening (after 16:00 ET), then pre-open prediction the next morning (before 09:30 ET).

### Pipeline Overview

```
[T-1 close]                        [T open]
    |                                  |
stock_market_close_summary    stock_pre_open_prediction
    |                                  |
    v                                  v
daily/{date}.md  ──── reads ────>  predictions/{date}.md
                                       |
                                       v
                               consolidated HTML report
                                       |
                                       v
                               backtest against prior prediction
```

The pipeline is linear at the per-ticker level but fans out across tickers: run close summaries for 5-10 tickers after close, then run predictions for all of them in parallel the next morning.

### Skill 1: Stock Market Close Summary

**Interface contract:**

```
Input:  ticker (String), analysis_date (String, optional)
Output: brief_path (Path to daily/{date}.md)
        entity_updated (Boolean)
Return: {"status": "OK", "message_log": [...], "output": "<brief_path>"}
```

This skill runs after market close. It dispatches a sub-agent to collect live data (close price, options chain, order flow, sentiment, peers), formats into an 11-section markdown template, and writes to a dated file per ticker. It also bumps the entity's snapshot anchor and `updated_at` timestamp.

**Key design choices for chaining:**
- The output path is deterministic: `{wiki_root}/2_knowledges/entities/stocks/{ticker_lower}/daily/{date}.md`
- The return value includes the path as a structured field, not buried in prose
- The file is self-contained — another skill can read it without any parsing beyond markdown

### Skill 2: Stock Pre-Open Prediction

**Interface contract:**

```
Input:  ticker (String), target_date (String, optional),
        anchor_brief_date (String, optional)
Output: prediction_path (Path to predictions/{date}.md)
        opening_cone (String), expected_close (String)
        confidence (Enum: H|M|L)
Return: {"status": "OK", "message_log": [...], "output": "<prediction_path>"}
```

This skill runs between prior close (16:00 ET) and target open (09:30 ET). It consumes the close summary as its anchor, dispatches a sub-agent for overnight data (futures, AH trading, cross-listings, news), and produces a forward-looking prediction card.

**Chain-specific behaviour:**
- **Prerequisite check:** First step is verifying the anchor brief exists. If not, it refuses and tells the user to run the close summary first.
- **Inherited data:** Trigger lines, support/resistance, gamma topology, and catalyst calendar are read directly from the anchor brief — never re-derived.
- **Delta-only output:** The prediction is kept under 1500 words. It's a supplement to the anchor brief, not a replacement.
- **Backtest hook:** After writing the new prediction, it opens the prior session's prediction and appends realised values — building a calibration trail without manual effort.
- **Sector momentum overlay:** Before generating any prediction, it checks the ticker's sector ETF pre-market performance. If the sector is strongly trending, it suppresses contrary biases — preventing the most common prediction failure mode observed across backtests.

### How the Chain Handles State

The two skills share a wiki filesystem but never conflict:

| Resource | Close Summary | Pre-Open Prediction |
|----------|---------------|---------------------|
| `daily/{date}.md` | Writes (owns) | Reads only |
| Entity `{ticker}.md` | Updates snapshot + sources | Does not touch |
| `predictions/{date}.md` | Does not touch | Writes (owns) |
| Prior `predictions/{prev_date}.md` | Does not touch | Appends backtest data |
| Consolidated HTML report | Does not touch | Generates (multi-ticker) |

The write boundaries are strict. The close summary is the sole writer to daily briefs and entity files because it records **realised data**. The prediction skill writes only forward-looking artifacts and backtest annotations — it never overwrites what actually happened.

### The Backtest Loop as a Chain Improvement Mechanism

The most interesting part of this chain isn't the forward flow — it's the feedback loop. Every prediction run automatically backtests the prior session's prediction:

```
Run 1: Predict NVDA open → writes prediction for T+1
Run 2: Close summary runs → records actual T+1 data
Run 3: Predict NVDA open again → before writing new prediction,
       opens Run 1's prediction, appends: "Actual open was $X
       (within cone? Y/N), actual close was $Y (within band? Y/N),
       direction correct? Y/N"
```

After 5 runs per ticker, the prediction skill includes a calibration summary: hit-rate on opening cone, on close band, on directional bias, on trigger lines. The chain learns which tickers it predicts well (low vol, catalyst-driven) and which it doesn't (overnight-gap names, Trump-linked).

This is the difference between a vibe-coded prompt and an engineered skill chain. The prompt doesn't track its own accuracy. The skill chain does — automatically, every run.

### What This Demonstrates About Skill Chaining

1. **Interface contracts make chains possible** — both skills declare typed inputs/outputs. The downstream skill knows exactly where to find its input and what shape it will be in.

2. **Prerequisite enforcement prevents silent failure** — the prediction skill checks for the anchor brief before doing work. If it's missing, the user gets a clear instruction, not a garbage output.

3. **Write boundaries prevent state corruption** — each skill owns its output directory. Neither overwrites the other's data.

4. **Deterministic paths from convention, not coupling** — both skills derive paths from the same parameters (ticker, date). Neither stores the other's path.

5. **Delta layering keeps output tight** — the prediction skill inherits trigger lines and catalysts from the close summary. It doesn't re-derive them. The output is a supplement, not a replacement.

6. **Backtest hooks close the loop** — the chain records its own accuracy every run. No separate audit infrastructure required.

7. **Parallel execution is safe because of write boundaries** — running predictions for 5 tickers simultaneously works because each prediction writes to its own ticker's directory. No locks, no coordination, no conflicts.

### The Pattern to Replicate

The minimal skill chain pattern that generalises beyond trading:

```
Skill A:
  Input:  domain object + date
  Output: structured file at deterministic path
  State:  owns the "records" directory

Skill B (depends on A):
  Input:  same domain object + date
  Prerequisite: A's output exists at derived path
  Output: forward-looking artifact at separate path
  State:  owns the "predictions" directory, reads from "records" only

Backtest hook:
  On every B run, append actuals to prior B's output
  Every N runs, produce calibration summary
```

This pattern works for any domain with an evaluate-then-predict cycle: compliance reporting (file today → predict filing outcome), data pipeline monitoring (record lag → predict next failure), or portfolio analysis (record NAV → predict rebalance need).

The skills themselves don't know about each other. They don't import each other. The chain exists because their interface contracts align — and that alignment is the engineering work.

---

### References

1. Anthropic. "The Complete Guide to Building Skills for Claude" (PDF, 32 pages, January 29, 2026). https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf
2. Shihipar, Thariq (Anthropic). "Lessons from building Claude Code: How we use skills." Claude Blog, June 3, 2026. https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills
