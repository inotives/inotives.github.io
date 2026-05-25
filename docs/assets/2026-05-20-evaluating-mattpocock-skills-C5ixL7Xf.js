var e=`---
title: "Evaluating mattpocock/skills for Data Engineering and Analysis Workflows"
date: 2026-05-20
tags: [skills, ai-agents, workflow, data-engineering, data-analysis, developer-tools]
summary: "A practical evaluation of the mattpocock/skills ecosystem — how its composable agent skills apply to data engineering and analysis workflows, what works, what doesn't, and where it fits."
---

## Evaluating mattpocock/skills for Data Engineering and Analysis Workflows

Matt Pocock's \`/skills\` repository has grown to 105k stars by packaging real engineering practices into composable agent skills. The pitch: small, adaptable skill files that fix common failure modes in AI-assisted development — misalignment, verbosity, broken code, and architectural decay.

The skills live as \`SKILL.md\` files under \`skills/engineering/\`, \`skills/productivity/\`, and \`skills/misc/\`. You install them with \`npx skills@latest add mattpocock/skills\`, pick what you want, and your agent loads them from \`~/.agents/skills/<name>/SKILL.md\`.

This evaluation looks at them from the perspective of a data engineer or analyst — a workflow that involves pipelines, SQL, notebooks, dashboards, infrastructure-as-code, and a lot of context-switching between tools.

## The Skill Catalog

### Engineering skills (used daily for code work)

| Skill | What it does |
|---|---|
| \`diagnose\` | Structured debug loop: reproduce → hypothesise → instrument → fix → regression-test |
| \`grill-with-docs\` | Interview-driven plan alignment; builds CONTEXT.md glossary and ADRs inline |
| \`triage\` | State-machine issue triage with agent-brief generation |
| \`improve-codebase-architecture\` | Surface deepening opportunities in module design |
| \`setup-matt-pocock-skills\` | One-time per-repo config (issue tracker, labels, domain docs) |
| \`tdd\` | Red-green-refactor loop with vertical slicing |
| \`to-issues\` | Break plans into grab-and-go issues |
| \`to-prd\` | Synthesize conversation into a PRD |
| \`zoom-out\` | Request a high-level module map |
| \`prototype\` | Build throwaway code to answer a design question |

### Productivity skills

| Skill | What it does |
|---|---|
| \`caveman\` | Ultra-terse response mode — cuts tokens ~75% |
| \`grill-me\` | Plan grilling without documentation side effects |
| \`handoff\` | Compact conversation into a handoff doc for another agent |
| \`write-a-skill\` | Scaffold new skills with proper structure |

### Misc skills

| Skill | What it does |
|---|---|
| \`git-guardrails-claude-code\` | Block destructive git commands |
| \`setup-pre-commit\` | Configure Husky + lint-staged |

## What Makes It Different From Other Skill Systems

The skills ecosystem has some distinguishing characteristics compared to raw prompt files or graphify-style knowledge graphs:

**Composability over monoliths.** Each skill does one thing. \`grill-with-docs\` only aligns on terminology. \`diagnose\` only debugs. They are designed to be chained — you grill first, then diagnose, then fix. This is different from monolithic "do everything" system prompts.

**Philosophy-first, not tool-first.** The skills encode real software engineering principles: The Pragmatic Programmer (feedback loops, tracer bullets), Domain-Driven Design (ubiquitous language), Extreme Programming (test-driven development), A Philosophy of Software Design (deep modules). The tools are secondary to the principles. This means the skills work regardless of what model or platform you use.

**File-based, no runtime dependency.** Each skill is a \`SKILL.md\` file. No daemon, no server, no MCP, no database. The agent reads it from disk and follows the instructions. This is the same pattern as OpenClaw's \`SKILL.md\` convention and Anthropic's skills format.

**Setup matters.** \`setup-matt-pocock-skills\` is not optional — it configures which issue tracker, what triage labels, and where domain docs live. Skills that depend on this config (\`triage\`, \`to-issues\`, \`to-prd\`) fail gracefully if it is missing, but the intended workflow requires the setup step.

## What Works Well for Data Engineers and Analysts

### /diagnose — debugging data pipelines

Data engineering involves a lot of "why is this broken?" — failed dbt runs, unexpected NULLs, performance regressions in Spark jobs, Airflow DAGs that stall at 3 AM. The \`diagnose\` skill formalizes the loop that experienced engineers already follow:

1. Build a feedback loop (fast repro)
2. Reproduce the bug
3. Generate 3-5 ranked hypotheses
4. Instrument to distinguish them
5. Fix + regression test
6. Cleanup + ask "what would have prevented this"

The emphasis on building a fast feedback loop first is the key insight. For data work, that often means a minimal SQL query against a test dataset, a dbt test case, or a small PySpark script — not the full pipeline. The skill's guidance on non-deterministic bugs ("raise the reproduction rate until it is debuggable") is directly applicable to flaky tests in data test suites.

### /grill-with-docs — aligning on data model terminology

Data teams spend a lot of energy on naming. Is it \`customer_id\` or \`user_id\`? Is a "cancellation" an order-level or subscription-level concept? Is "revenue" recognized or booked?

\`grill-with-docs\` forces the agent to build and maintain a \`CONTEXT.md\` glossary as you discuss. Every resolved term gets recorded immediately. The skill checks for contradictions between your spoken language and the existing glossary. For data teams with multiple stakeholders using different terminology, this is valuable — it surfaces ambiguity before it gets encoded into pipeline logic.

The ADR (\`docs/adr/\`) pattern is also relevant for data teams: "Why did we choose incremental models over full refresh?" or "Why did we denormalize this table?" are exactly the kind of decisions that need structured capture.

### /prototype — testing transformations before committing

Data analysts often need to figure out whether a transformation or model design is correct before building the full pipeline. The \`prototype\` skill's logic branch — a throwaway terminal app that exercises the state model — maps neatly to:

- Testing a dbt model against a small sample before running full-refresh
- Validating a SQL window function's behavior on edge cases
- Checking that a Python transformation handles nulls correctly
- Exploring whether a star schema or a wide table is the right fit for a specific query pattern

The emphasis on "one command to run," no persistence, and explicit throwaway marking matches how good analysts already prototype in notebooks (but with better discipline around what gets kept).

### /caveman — token efficiency for long analysis sessions

Data analysis sessions tend to be long and involve large outputs (table schemas, query results, log files). \`caveman\` mode drops filler, articles, pleasantries, and hedging — keeping only the technical substance. For a 3-hour session debugging a pipeline, this saves significant context window and reduces token spend. The caveat is that some data results are sensitive to exact wording (column names, error messages), and the skill preserves those exactly — it only compresses the conversational wrapper.

### /handoff — passing context between investigation sessions

Data analysis often involves long-running investigations that span multiple sessions — or get handed off between team members. The \`handoff\` skill compacts the current conversation into a document a fresh agent can pick up from. It includes a suggested skills section and references artifacts (queries, dashboards, ADRs) rather than duplicating them.

### /zoom-out — understanding data architecture

New data engineers inheriting a warehouse with 200 tables, 50 dbt models, and 30 Airflow DAGs can invoke \`/zoom-out\` to get a module-level map. The skill tells the agent to go up a layer of abstraction and present the relevant modules and callers using the domain glossary. This is faster than manually tracing DAG dependencies or reading every model file.

### /improve-codebase-architecture — cleaning up tangled pipelines

Data pipelines are notorious for accumulating technical debt: monolithic dbt models, copy-pasted SQL, inconsistent naming, overloaded tables. The \`improve-codebase-architecture\` skill surfaces shallow modules (high interface complexity relative to behavior) and proposes deepening opportunities. For a data codebase, this might mean:

- Splitting a 500-line SQL model into a staging layer + intermediate + mart
- Extracting shared CTEs into reusable dbt macros
- Identifying tables that serve too many purposes

The HTML report with before/after Mermaid diagrams is useful for presenting refactoring plans to the team. The \`CONTEXT.md\` vocabulary discipline means the report uses the team's actual domain language, not generic terms.

### /triage and /to-issues — managing data engineering tickets

Data teams with a backlog of pipeline bugs, schema change requests, and new data source integrations can use \`triage\` to process incoming issues through a state machine (needs-triage → needs-info → ready-for-agent). The agent-brief format (\`ready-for-agent\`) produces issues that are fully specified for an AFK agent to pick up — which is useful when the team has agents that can autonomously implement changes to dbt models or Airflow DAGs.

## What Does Not Work as Well

**The skills assume a software engineering context, not a pure analysis context.** The vocabulary (deep modules, seams, interfaces, refactoring) comes from software design, not analytics. For a team doing only SQL transformations with no application code, some skills (\`improve-codebase-architecture\`, \`tdd\`) require mental translation. The concepts still apply, but the framing expects Python/TypeScript project conventions.

**No native SQL or pipeline awareness.** The skills do not come with baked-in knowledge of dbt, Airflow, Spark, or data warehousing patterns. They are general-purpose engineering skills that happen to be useful for data work. You will need to add your own context (e.g., a \`CONTEXT.md\` that defines your warehouse conventions, or custom skills for data-specific patterns). The \`write-a-skill\` tool helps here, but there is no pre-built data engineering skill pack.

**Setup friction for non-GitHub teams.** \`setup-matt-pocock-skills\` assumes GitHub or GitLab issue tracking. Teams using Jira, Linear, or Notion for data requests will need the "Other" workflow option, which falls back to freeform prose rather than structured integration. For data teams embedded in non-engineering organizations, this can feel like extra ceremony.

**/caveman mode loses context for non-engineers.** The ultra-terse mode assumes the reader is technically fluent. If your data team includes business analysts who need explanations framed in business terms, \`caveman\` is not appropriate for those interactions. It works best for agent-to-agent or senior-engineer-to-agent communication.

## Skills vs Graphify vs CodeGraph

Since these three tools are all in this site's workflow now:

| | CodeGraph | Graphify | Matt Pocock Skills |
|---|---|---|---|
| What it does | Structural code graph | Mixed-content knowledge graph | Composable agent workflows |
| Query style | MCP tools | MCP + LLM queries | \`/command\` invocation |
| Best for | Live code navigation | Cross-domain knowledge discovery | Planning, debugging, architecture |
| LLM cost per use | Zero (AST only) | Varies (semantic extraction) | Zero (skill files are instructions) |
| Data engineering fit | Low (code-centric) | Medium (docs + code) | High (debug + design + document) |

The skills are orthogonal to both graph tools. CodeGraph tells you where symbols are; Graphify tells you how concepts connect across docs and code; the Pocock skills tell your agent *how to think* about a task. They complement rather than overlap.

## Practical Workflow

For a data engineer, a typical day might look like:

1. **Morning triage.** \`/triage\` on the backlog: a dbt test failure, a request for a new data source, a performance complaint about a dashboard query.
2. **Investigate the test failure.** \`/diagnose\` on the dbt test: build a minimal repro with a \`WHERE\` clause against a test table, hypothesize root causes, instrument, fix, add a regression test.
3. **Design a new model.** \`/grill-with-docs\` to align on terminology with the requesting team. Produce a \`CONTEXT.md\` entry for the new domain concept and an ADR for the model design.
4. **Prototype the transformation.** \`/prototype\` to write a throwaway dbt model against a sample, validate the output, then fold the logic into the real pipeline.
5. **Handoff.** \`/handoff\` at end of day so a second session (or a colleague) can pick up without re-reading the full conversation.

This is not theoretical — this is the actual pattern I have been running. The skills replace ad-hoc prompting with structured process, and the file-based format means they survive model upgrades and platform changes.

## Verdict

Matt Pocock's skills are the most practical agent-workflow system I have used for day-to-day data engineering. Not because they know anything about data — they do not — but because they encode engineering discipline that applies regardless of the domain.

The strongest use case is \`diagnose\` for pipeline debugging. The weakest is onboarding non-technical team members who find the vocabulary alienating. The ideal user is a senior data engineer who already follows these practices manually and wants an agent to remember the steps.

The skills are free, MIT-licensed, and composable. There is no lock-in — each skill is a markdown file you could write yourself. The value is in the accumulated practice, not the platform.

## Sources

- mattpocock/skills: https://github.com/mattpocock/skills
- AI Hero newsletter: https://www.aihero.dev/s/skills-newsletter
- Skills installer: https://skills.sh/mattpocock/skills
- Prior evaluation — CodeGraph: /posts/2026-05-25-codegraph-for-agentic-codebase-work
- Prior evaluation — Graphify: /posts/2026-05-20-graphify-for-agentic-knowledge-work
`;export{e as default};