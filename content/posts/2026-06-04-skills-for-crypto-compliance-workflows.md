---
title: "How to Build Agent Skills the Right Way — With Real Data Workflow Examples"
date: 2026-06-04
tags: [claude-skills, agent-skills, workflow-automation, crypto-compliance, data-analyst, progressive-disclosure, skill-design]
summary: "Anthropic's skills guide defines a clear architecture and set of patterns for building repeatable agent workflows. This post walks through the guidelines and shows how they apply to real data analyst workflows — regulatory reporting, KYC tooling, and CRM reconciliation."
---

## How to Build Agent Skills the Right Way — With Real Data Workflow Examples

Anthropic published a 32-page guide in January 2026 defining the architecture and conventions for building agent skills. The Claude Code team followed in June with lessons from hundreds of skills they built internally. Between the two documents, there's a clear set of guidelines for *how* to build skills correctly — and just as importantly, what distinguishes a well-structured skill from one that won't trigger reliably.

### Why Skills Matter — The Shift from Vibe Coding to AI Engineering

A lot of people using AI right now are still in vibe coding mode: describe what you want in a paragraph, get something back, tweak the prompt, repeat. It works for one-off tasks. It falls apart the moment you need consistency, auditability, or handoff to someone else.

Skills are the professionalisation of that workflow. The difference between a vibe coder and an AI engineer is the ability to look at a vague, human-described process — "every Monday we pull Travel Rules data and send it to the regulator" — and decompose it into a structured, replicatable skill: the triggers, the sequential steps, the guardrails, the validation gates, the failure modes, and the output contract.

This is pattern extraction. A compliance analyst saying "I check Salesforce against Dotfile" is not a prompt — it's a signal that you need to identify the matching rules, the edge cases, the escalation paths, and encode them so an agent can execute them reliably every time. That translation from fuzzy human process to structured machine-readable workflow is the core competency that separates one-off prompting from engineering.

This post covers the pattern extraction process first — how to identify triggers, steps, guardrails, and outcomes from real workflows — then maps them to skills built for crypto compliance and analytics.

---

## Part 1: The Guidelines

### 1. Progressive Disclosure Architecture

Skills use a three-tier loading model. Understanding this is the foundation of everything else:

| Level | What loads | Token cost | When |
|-------|------------|------------|------|
| 1 | Name + description (YAML frontmatter) | ~50-100 tokens per skill | At session start, always |
| 2 | Full `SKILL.md` body | ~500-5000 tokens | When Claude matches the task to the description |
| 3 | Supporting files (scripts/, references/, assets/) | Variable | On demand during task execution |

**The rule:** Keep level 2 under 5000 tokens. Move reference material (templates, data dictionaries, API docs) to `references/`. Claude loads them when it navigates there — not before. This keeps the trigger evaluation cheap and the skill execution context-aware.

### 2. Skill Folder Anatomy

```
my-skill/
├── SKILL.md          # Required — YAML frontmatter + markdown body
├── scripts/          # Optional — executable code
├── references/       # Optional — docs, templates, data dictionaries
└── assets/           # Optional — fonts, icons, images
```

**The rules:**
- Folder name must be **kebab-case** (`salesforce-dotfile-reconcile`, not `salesforceDotfileReconcile` or `Salesforce Dotfile Reconcile`)
- File name must be exactly **`SKILL.md`** — case-sensitive
- YAML frontmatter requires `name` and `description`; optional fields include `allowed-tools`, `disable-model-invocation`, `user-invocation`, `compatibility`, `license`

### 3. Description Formula — The Most Important Part

The description field is the single point of failure. If Claude doesn't match a task to your skill, the skill never loads — regardless of how good the body is.

**The formula:** *What it does + When to use it + What it produces + trigger phrases*

Good:
```yaml
description: >
  Reconcile customer records between Salesforce CRM and Dotfile KYC.
  Fires when asked to check customer identity status, cross-reference
  KYC data against CRM records, or investigate mismatches between
  Salesforce and Dotfile. Produces a per-customer match report with
  discrepancies flagged.
```

Bad:
```yaml
description: Helps with compliance data
```

The Claude Code team measures their skill trigger rates and found that vague descriptions are the top reason skills never fire. Specificity in the description directly determines whether the skill delivers value.

### 4. Nine Skill Categories — The Framework

The Claude Code team categorised their internal skills into nine types. This is useful as a diagnostic — it tells you what *kind* of skill you're building and what patterns apply:

| Category | When to use | Example |
|----------|-------------|---------|
| Library & API reference | Your codebase has unique APIs or edge cases | `billing-lib` — billing library footguns |
| Product verification | You need to drive a UI or flow in a headless browser | `signup-flow-driver` — Playwright script |
| Data fetching & analysis | You run the same query pattern with different parameters | `funnel-query` — join events for signup→activation→paid |
| Business process automation | Fixed multi-step procedure with hard deadlines | `standup-post` — aggregate tickets into standup format |
| Code scaffolding & templates | You start the same type of project repeatedly | `new-migration` — migration template + gotchas |
| Code quality & review | You need consistent review output per PR | `adversarial-review` — subagent critique + iteration |
| CI/CD & deployment | Safe, repeatable deploy with rollback | `deploy-service` — build→smoke→gradual rollout |
| Runbooks | Debugging and incident response | `service-debugging` — symptom→checks→remediation |
| Infrastructure operations | Cleanup and maintenance | `resource-orphans` — find orphaned pods, alert, clean |

**The rule:** Most skills fit one category. If your skill spans three, it's probably too broad — split it.

### 5. Five Design Patterns

The guide documents five patterns that emerged from early adopters. These are the reusable structural templates:

**Pattern 1: Sequential workflow orchestration** — Multi-step processes with explicit ordering and dependency management. Each step validates before the next proceeds. Use for: onboarding flows, report generation, approval chains.

**Pattern 2: Multi-MCP coordination** — Workflows that span multiple external services. One skill orchestrates calls across Salesforce MCP, Dotfile MCP, database MCP. Use for: reconciliation, cross-system data validation.

**Pattern 3: Iterative refinement** — Produce an output, validate it, fix issues, re-validate. Use for: report generation where quality matters, data cleaning with verification loops.

**Pattern 4: Context-aware tool selection** — Same goal, different approach depending on data volume or sensitivity. Large datasets → database queries, small datasets → API calls, sensitive data → read-only views.

**Pattern 5: Domain-specific intelligence** — Embed specialised knowledge that Claude doesn't have natively. Sanctions screening rules, risk scoring methodology, regulatory interpretation guidance.

**The rule:** Pick one pattern per skill. A skill that combines Pattern 1 (sequential) and Pattern 3 (iterative) should probably be two skills chained by naming.

### 6. Skills vs MCP vs Subagents — Decision Framework

This is the most practically useful guideline from the ecosystem. Knowing *which mechanism* to use for *which problem* prevents architectural mistakes:

| Mechanism | Invoked by | Best for | Example |
|-----------|------------|----------|---------|
| Skills | Claude (auto) | Repeatable workflows with judgment | Code review, data analysis |
| MCP servers | Claude (tool call) | External system access | Database queries, file storage |
| Subagents | User (explicit) | Complex tasks with sub-delegation | Multi-file refactoring |

**Analogy from the guide:** MCP is the kitchen (knives, pots, ingredients). Skills are the recipes (how to cook). Either alone is functional; together they produce reliable meals.

**Decision rules:**
- Task needs external data? → MCP (DB queries, file system, API)
- Task needs judgment and sequential steps? → Skill (review, analysis, report generation)
- Task is too large for one context window? → Subagent (project-wide analysis)

### 7. Encoded Preference vs Capability Uplift

BuildFastWithAI's analysis introduces a distinction that directly informs build order:

| Dimension | Encoded Preference | Capability Uplift |
|-----------|-------------------|-------------------|
| Purpose | Capture how your team does something Claude already knows how to do | Give Claude abilities it lacks |
| Code required | Rarely (just SKILL.md) | Usually (scripts/) |
| Build time | 15-30 minutes | 30-90 minutes |
| Value per use | Medium-high (consistency) | High (new capability) |

**The rule:** Start with encoded preference skills. They require no code, encode valuable institutional knowledge, and give immediate consistency benefits. Capability uplift skills come later when you've validated the skill workflow pattern.

### 8. The Iteration Cycle

The Claude Code team's most practical finding: skills improve fastest when you ship minimal and iterate.

**The cycle:**
1. Build a minimal skill (SKILL.md + description)
2. Use it for a week
3. Add gotchas to the skill as Claude hits edge cases
4. Refine the description if it's not triggering reliably
5. Share with the team

**The gotchas rule:** The highest-signal content in any skill isn't the main procedure — it's the gotchas section. The field that's sometimes null. The API that rate-limits after 100 rows. The format that changes without notice. Build minimal, add gotchas from real usage.

---

## Part 2: Real Workflow Examples

The following are not hypothetical. These are the actual workflows I encoded as skills while handling crypto compliance data at a digital asset firm.

### Example 1: Salesforce–Dotfile Customer Reconcile — Encoded Preference + Multi-MCP Coordination

**The problem:** Salesforce had 2,300 customer records. Dotfile had 1,800 verified identities. Nobody knew how many were the same entity because the matching was manual — an analyst cross-referenced legal names and registration numbers across two browser tabs.

**Skill anatomy:**

```
salesforce-dotfile-reconcile/
├── SKILL.md
└── references/
    └── field-mapping.csv      # Salesforce field → Dotfile field
```

**Description:**
```yaml
name: salesforce-dotfile-reconcile
description: >
  Cross-reference customer records between Salesforce and Dotfile.
  Fires when asked to reconcile KYC data, check customer identity
  status, or sync CRM records with verified identities. Matches on
  legal name, registration number, and LEI. Produces a per-customer
  match/mismatch report.
allowed-tools:
  - salesforce-mcp
  - dotfile-mcp
```

**Pattern:** Multi-MCP coordination (Pattern 2). The skill coordinates two MCP servers — query Salesforce for the commercial record, query Dotfile for the verified identity, compare fields, flag mismatches.

**Category:** Business process automation.

**Gotchas added after first week:**
- "Dotfile returns dates in ISO 8601; Salesforce returns MM/DD/YYYY. Convert Salesforce dates before comparing."
- "Some customers have multiple Dotfile entities under different registration numbers but the same beneficial owner. Flag for human review instead of marking as mismatch."
- "Salesforce account names sometimes include suffixes like 'Ltd' or 'Pte Ltd' that Dotfile omits. Strip suffixes before matching."

**Outcome:** Matching time dropped from 45 minutes per batch to under 5. The mismatch rate was 12% in week one (most were suffix-related), down to 3% by week three after gotcha refinement.

### Example 2: MiCA Weekly Travel Rules Report — Sequential Orchestration + Iterative Refinement

**The problem:** Every Monday, the compliance team extracted Travel Rules data from Dotfile, cross-referenced against Chainalysis KYT alerts, formatted into the MiCA Annex III template, and filed via the regulator portal. It took 4 hours and had a 12% error rate.

**Skill anatomy:**

```
mica-weekly-report/
├── SKILL.md
└── references/
    └── mica-annex-iii-template.md    # Current template with field mapping
```

**Description:**
```yaml
name: mica-weekly-report
description: >
  Generate the weekly MiCA Travel Rules report. Queries Dotfile for
  CASP-to-CASP transfers, cross-references against Chainalysis KYT
  alerts, formats into Annex III template, and validates before output.
  Fires when asked for "MiCA report", "Travel Rules submission",
  "weekly compliance report", or "Annex III filing".
allowed-tools:
  - dotfile-mcp
  - chainalysis-mcp
  - postgres-mcp
```

**Body structure (condensed):**

```
1. Query Dotfile — all CASP-to-CASP transfers in the reporting period with
   sender/receiver identity verification status
2. Query Chainalysis KYT — all alerts for the same wallets in the same period
3. For each transaction:
   a. Both parties verified → include standard fields
   b. Sender is unhosted → append wallet risk score
   c. Any KYT alert triggered → append alert disposition
4. Load Annex III template from references/
5. Populate template rows from merged data
6. Validate: row count matches Dotfile export count, KYT references are complete
7. Deliver draft report to compliance officer for human review and approval
8. Block submission until compliance officer signs off — agent does not file
```

**Pattern:** Sequential workflow orchestration (Pattern 1) + Iterative refinement (Pattern 3). Steps 1-5 are sequential. Step 6 is a validation loop — if row counts don't match, the skill re-queries and flags discrepancies. Step 7-8 enforces **human-in-the-loop** — the agent prepares and validates the report but never submits to the regulator portal. This is a hard rule in the skill body: the output is a draft for review, and the skill only proceeds to filing when the compliance officer explicitly confirms.

**Category:** Data fetching & analysis (primary) + Business process automation (secondary).

**Gotchas added:**
- "Chainalysis KYT rate-limits at 50 wallet lookups per minute. Batch the wallet list and add 2-second delays between batches."
- "If Dotfile returns more than 500 transfers, the report exceeds the template row limit. Split into primary and supplementary reports."
- "The template changes quarterly. Don't hardcode column positions — read column headers from the template file."

**Verdict from the Evaluate stage of my FRAME workflow:**
- Prep time: 240 min → 45 min
- Error rate: 12% → 2%
- Team time saved: 3.5 hours/week
- Maintenance: ~30 min/month (usually a template update)
- Regulator feedback: clean audit

### Example 3: KYT Alert Triage Runbook — Domain-Specific Intelligence

**The problem:** The team ran three transaction screening tools (Chainalysis KYT, TRM Labs, Elliptic). Each returned risk scores on different scales. Analysts spent hours cross-referencing them for the same transaction.

**Skill anatomy:**

```
kyt-alert-triage/
├── SKILL.md
└── references/
    ├── risk-scale-mapping.md       # Chainalysis 0-10 → TRM low-med-high → Elliptic 1-5
    └── escalation-matrix.md        # Which risk combos auto-clear vs flag vs escalate
```

**Description:**
```yaml
name: kyt-alert-triage
description: >
  Cross-reference KYT alerts from Chainalysis, TRM Labs, and Elliptic.
  Normalises risk scores to a unified 1-5 scale, identifies
  disagreements, and routes to auto-clear, flag-for-review, or
  escalate-to-compliance based on the escalation matrix. Fires when
  asked to triage KYT alerts, check screening results, or reconcile
  risk scores across providers.
```

**Category:** Runbook (primary) — it's a debugging/triage flow with decision gates.

**Pattern:** Domain-specific intelligence (Pattern 5). The skill embeds knowledge about how the three risk scales map to each other and what combinations require human review. This knowledge was previously in the head of one senior compliance analyst.

**Gotchas added:**
- "TRM Labs does not return risk scores for unhosted wallets with volume under $10k — mark those as 'no data' rather than zero risk."
- "If Chainalysis says 'high' and TRM says 'low' for the same transaction, check whether they're scoring different attributes (Chainalysis scores the counterparty, TRM scores the transaction itself). Flag for human review regardless of the matrix."
- "Elliptic returns risk scores as strings ('very_low', 'low', 'medium', 'high', 'very_high'). Normalise before comparing."

**Outcome:** Review time per alert batch dropped 60%. Disagreement detection went from manual to automatic. The senior analyst who previously handled all escalations could focus only on the 8% of cases that genuinely needed their judgment.

### Example 4: New Customer Onboarding QA — Encoded Preference + Sequential Orchestration

**The problem:** Every new corporate client went through KYC/KYB onboarding — identity check, source of funds, sanctions screening, PEP check, risk scoring, board resolution verification. The QA review was done by a senior analyst who checked each step manually. Quality depended on who was reviewing.

**Skill anatomy:**

```
kyc-onboarding-qa/
├── SKILL.md
└── references/
    ├── qa-checklist.md          # 22-point checklist with pass/fail criteria
    ├── jurisdiction-rules.md    # Per-country document requirements
    └── risk-scoring-guide.md    # How the firm weights each risk factor
```

**Category:** Business process automation.

**Pattern:** Sequential workflow orchestration (Pattern 1) — each check depends on the previous step passing.

**Key design choice:** This is purely an encoded preference skill — no scripts, no MCP servers. It encodes the QA manual that the team had been maintaining as a Google Doc. The skill doesn't execute anything; it *reviews* the output of the existing onboarding process and produces a pass/fail verdict per check with remediation steps for failures.

**The gotcha that justified the whole skill:** "Board resolutions from Qatar require a Ministry of Foreign Affairs attestation. If the jurisdiction is Qatar, verify the attestation stamp before accepting the resolution document. This was not in the QA manual — discovered when a Qatar onboarding was rejected three weeks in."

**Outcome:** Junior analysts started producing QA reviews at the same quality level as the senior analyst. The skill absorbed edge cases that the documentation never captured.

### What These Examples Demonstrate About the Guidelines

Looking back at the four skills:

1. **Progressive disclosure worked** — all four skills loaded only when asked about their specific domain. Having them installed didn't slow down any other work.

2. **The description formula determined trigger reliability** — the MiCA report skill fired reliably on "need to file the weekly" because the description included trigger phrases from how people actually ask. The KYT triage skill initially had a vague description and fired about 30% of the time. After adding "reconcile risk scores" and "check screening results" to the description, it hit >90%.

3. **One pattern per skill held** — none of these skills combined conflicting patterns. The MiCA report is sequential with a validation loop (iterative refinement nested inside sequential, which works). A skill that tried to be sequential + multi-MCP + domain-specific at the same time would have been unwieldy.

4. **Gotchas beat instructions** — in every case, the value of the skill grew most when real usage exposed edge cases. The initial SKILL.md was always too optimistic about data quality. The gotchas section became the most-read part of each skill.

5. **Encoded preference first, capability uplift later** — three of four skills are pure SKILL.md with no executable code. The MiCA report uses MCP servers for data access (which already existed) but the skill itself is instructions. This kept build time under 30 minutes per skill and made iteration fast.

The build order I followed: reconcile skill (2 weeks of gotcha refinement) → KYT triage (1 week) → MiCA report (3 weeks, because regulator deadlines concentrate the mind) → onboarding QA (ongoing). Each skill informed the structure of the next. The first one took the longest because the patterns weren't familiar. The third one took about 20 minutes to draft.

There are no best skills, only skills that fits.

---

### References

1. Anthropic. "The Complete Guide to Building Skills for Claude" (PDF, 32 pages, January 29, 2026). https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf
2. Shihipar, Thariq (Anthropic). "Lessons from building Claude Code: How we use skills." Claude Blog, June 3, 2026. https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills
