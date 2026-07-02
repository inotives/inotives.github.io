---
title: "Plan-and-Execute vs ReAct: The Architecture Decision That Shapes Your Agent's Cost, Speed, and Failure Mode"
date: 2026-07-02
tags: [agent-patterns, plan-and-execute, react, langgraph, ai-agents, agent-architecture]
summary: "ReAct and plan-and-execute are the two dominant agent architectures in 2026. They fail differently, cost differently, and suit different tasks. The real insight is that production systems use both — plan-and-execute as the outer loop, ReAct as the inner loop. Here is the full comparison with cost math, failure modes, and domain-specific workflows."
---

Every agent framework in 2026 faces the same architectural question: should the agent think step-by-step and adapt in real time (ReAct), or plan first and execute later (plan-and-execute)? The answer is not "one is better." The answer is that they fail in fundamentally different ways, cost fundamentally different amounts, and suit fundamentally different tasks. And production systems use both.

This article breaks down the comparison in detail — architecture, cost math, failure modes, and when each pattern wins. I will also relate this to our own agent systems: agent-rig's trinity pattern, git-conveyor's pipeline, and how we already compose these patterns without always naming them.

## The two architectures

### ReAct: Think, Act, Observe, Repeat

ReAct is the simpler pattern. The same LLM handles reasoning and execution at every step. It follows a loop: think about what to do next, take an action (call a tool), observe the result, and repeat.

```
Goal: "What were NVIDIA's Q2 earnings?"

Thought: I need to find NVIDIA's earnings release. Let me search.
Action: search("NVIDIA Q2 2026 earnings release")
Observation: [search results returned]
Thought: I found the 10-Q. Now I need to extract revenue.
Action: read(url="https://...")
Observation: [document content]
...repeat until done...
```

Key characteristics:
- Single model handles everything — reasoning and tool use in one loop
- Each step starts with chain-of-thought before selecting an action
- The agent adapts based on the most recent observation
- No global plan — the agent reasons one step at a time
- Context accumulates — every thought, action, and observation appends to the context window

### Plan-and-Execute: Plan First, Execute Later

Plan-and-execute splits the work into two phases. A planner LLM (strong model) generates an ordered list of steps upfront. An executor (cheap model) runs each step with its own tools and context. If intermediate results invalidate the plan, a re-planner adjusts.

```
Goal: "Generate Q2 financial report"

Planner (strong model):
  Step 1: Extract revenue data from Snowflake
  Step 2: Compute cohort-level metrics
  Step 3: Identify anomalies (>10% week-over-week change)
  Step 4: For each anomaly, run root-cause analysis
  Step 5: Generate visualizations
  Step 6: Assemble dashboard HTML
  Step 7: Deploy to server
  Step 8: Notify team on Slack

Executor (cheap model): runs each step one at a time
Replanner (strong model): checks if plan is still valid after each step
```

Key characteristics:
- Two roles — planner (strong model) and executor (cheap model) are separate
- The full plan is generated before any tool is called
- Each executor step sees only its own step plus relevant data — context stays lean
- The planner can revise remaining steps based on intermediate results
- Steps without dependencies can run in parallel

## The cost mathematics

This is where the comparison gets concrete. The cost difference comes from a structural asymmetry: ReAct runs the full reasoning model on every step, while plan-and-execute runs the planner once and uses a cheap executor for the rest.

**Cost formulas:**
- ReAct: `N × Cr` (N steps, each costing Cr — full reasoning model per step)
- Plan-and-Execute: `Cp + N × Ce + p × Cp` (planner call + N executor calls + replanning probability)

**10-step task on July 2026 pricing:**

| Component | ReAct (all Claude Sonnet) | Plan-and-Execute (Sonnet planner + Haiku executor) |
|---|---|---|
| Planner call | N/A (absorbed per step) | ~$0.05 (1 call, ~5K tokens) |
| Per-step execution | ~$0.05 per step (10K tokens avg) | ~$0.005 per step (5K tokens, Haiku) |
| Replanning (20% prob) | N/A | ~$0.01 per replan |
| **Total** | **~$0.50** | **~$0.07** |
| **Cost ratio** | **7x more expensive** | **Baseline** |

At scale the difference compounds:
- 100 tasks/day: ReAct $50/day vs Plan-and-Execute $7/day
- 10,000 tasks/day: ReAct $5,000/day vs Plan-and-Execute $700/day
- 100,000 tasks/day: ReAct $50,000/day vs Plan-and-Execute $7,000/day

The break-even point is around 4-5 steps. Below that, ReAct is simpler and cheaper because the planner call is a significant fraction of total cost. Above that, plan-and-execute wins on cost, predictability, and parallelism.

**Context window pressure** is the other cost axis. ReAct's context grows with every step. A 10-step ReAct task with 10K tokens per step accumulates roughly 100K tokens of context. Plan-and-execute keeps each executor step at roughly 5K tokens. This matters for models with context limits and for latency — longer context means slower inference.

## Failure modes: how they break differently

This is the part most comparisons skip. ReAct and plan-and-execute do not just succeed differently — they fail in fundamentally different ways. Understanding these failure modes is critical for production deployment.

### ReAct failures

1. **Goal drift.** After many steps, the agent forgets the original goal and optimizes for local observations instead. It chases interesting tangents.
2. **Infinite loops.** The agent gets stuck repeating the same action when it cannot find a better path. It searches, gets the same results, searches again.
3. **Context exhaustion.** The accumulated context exceeds the window, forcing truncation that loses critical earlier information.
4. **Reasoning degradation.** As context grows, the model's ability to reason about the full history degrades. Later steps make worse decisions.
5. **Cost runaway.** The agent keeps trying "one more thing" without a budget cap, burning tokens on unproductive exploration.

### Plan-and-execute failures

1. **Plan staleness.** The plan was correct when generated but intermediate results invalidate assumptions. The executor dutifully executes wrong steps.
2. **Cascading errors.** A wrong assumption in step 1 propagates through all subsequent steps, producing a coherent sequence of confident failures.
3. **Planner hallucination.** The planner generates a plausible-looking plan that references non-existent data or impossible tool calls.
4. **Replanning failure.** When the planner is re-invoked with new information, it may produce an equally wrong revised plan.
5. **Executor blindness.** The executor cannot deviate from the plan even when the current step's result clearly demands a different approach.

### The rigidity tradeoff

ReAct fails by drifting. Plan-and-execute fails by rigidly following a stale plan. A wrong assumption near the start of a plan propagates through all subsequent steps. The planner may produce a coherent sequence of confident failures — every step looks reasonable in isolation, but the sequence is wrong because the foundation was wrong.

This is why re-planning is not optional. Production implementations always include a re-plan trigger. Without it, plan-and-execute is just a fancy batch script that runs steps in order regardless of whether they still make sense.

### Mitigation comparison

| Failure Mode | ReAct Mitigation | Plan-and-Execute Mitigation |
|---|---|---|
| Goal drift | Explicit goal reminder in context | Plan serves as persistent goal reference |
| Infinite loops | Max iteration budget, no-progress detector | Max steps cap, replan on no-progress |
| Context exhaustion | Context compression, summarization | Step-scoped context avoids accumulation |
| Cascading errors | N/A (each step is independent) | Replanner with validation after each step |
| Cost runaway | Token budget per run | Step-level token budgets + total budget |

## When each pattern wins

### ReAct wins when:

- The next step depends entirely on the previous result — debugging, exploration
- The task is short (1-5 steps) where planner overhead does not amortize
- The environment is highly dynamic and plans go stale quickly
- You need real-time adaptation to unexpected inputs — chat, triage
- The task requires creative exploration where the path is not known upfront
- Examples: debugging a failing test, exploring an unfamiliar codebase, answering a complex question, interactive customer support

### Plan-and-execute wins when:

- The task has 5+ discrete, predictable steps
- Steps are mostly independent and can sometimes be parallelized
- Cost predictability matters — you want to know total cost before execution
- Auditability is required — the plan serves as a human-readable execution log
- The task runs asynchronously and a human will see only the final result
- Failures should be handled by re-planning rather than mid-flight reasoning
- Examples: generating a financial report, running an ETL pipeline, deploying infrastructure, processing a batch of documents

### The decision heuristic

| Steps | Pattern |
|---|---|
| 1-5 steps, well-defined | Single ReAct agent |
| 6-15 steps, predictable structure | Plan-and-Execute |
| 15+ steps, parallel subtasks | Multi-agent hierarchical |
| Exploratory, undefined steps | ReAct with high max_iterations |

## The CPU analogy

Jatin Bansal's analogy is the best way to understand the tradeoff intuitively.

Plan-and-execute is **speculative execution** at the agent level. The planner emits a sequence of predicted tool calls. The executor runs them as if the world will not change. If a step fails, the re-planner is the pipeline flush — expensive but recoverable.

Pure ReAct is the **in-order, non-speculative pipeline**. It waits at every step, so it cannot get ahead, but it never has to throw work away.

The cost-of-replanning math is the cost-of-misprediction math. On tasks with high branch-prediction accuracy — well-specified tasks with predictable structure — speculation wins big. On tasks with low branch-prediction accuracy — highly dynamic environments, exploratory work — the non-speculative pipeline wastes less.

This analogy explains why the hybrid pattern dominates production. The outer loop speculates (plan), the inner loop adapts (react). You get the cost benefits of planning with the adaptability of reactive execution.

## The three primitives

The 2026 production sweet spot is not just plan-execute but plan-execute-reflect with budget caps. Every production agent needs three roles:

**Planner.** Converts a goal into a sequence of steps. Uses a strong model (GPT-4o, Claude Sonnet, o3). Produces structured output — a JSON list of typed steps. The prompt is small and focused on decomposition.

**Executor.** Takes one step at a time from the plan. Calls tools, reads results, reports back. Uses a cheap model (GPT-4o-mini, Claude Haiku). The prompt is small and focused on doing the next step well.

**Reflector.** Evaluates: are we on track, done, or stuck? This is the most undervalued of the three primitives. Without a real reflector, agents drift, loop, or quit prematurely. The reflector decides whether to continue, replan, or escalate.

**Three budgets every production agent needs:**
1. Max steps — typically 10-20 for routine tasks — hard ceiling on loop iterations
2. Max tokens — total tokens spent across the loop — stops cost runaway
3. Max wall-clock time — total time including tool calls — important for user-facing agents

**Anti-patterns to avoid:**
- No reflector: agent executes blindly until something obvious fails or budget exhausts
- Reflector folded into executor: optimism bias produces false success
- Unbounded plans: agent generates 30 steps, executes 8, gets lost
- No budget caps: cost runs away when something goes wrong
- No escalation path: agent produces nonsense rather than asking for help
- Fresh planner per turn: planner has no memory of why previous plan failed

## The hybrid pattern: what production actually looks like

Most production agentic systems do not pick one pattern. They route between them.

**Outer loop = Plan-and-Execute:**
- Decomposes the goal into sub-goals
- Manages overall progress and budget
- Re-plans when sub-goals fail

**Inner loop = ReAct:**
- Each sub-goal is solved with a ReAct agent
- The ReAct agent adapts to what shows up in the sub-task
- Falls back gracefully within the sub-task scope

This is exactly how Claude Code and Codex work. The outer planner decomposes "build feature X" into: write tests, implement code, run tests, fix failures, update docs. Each step runs a ReAct loop — read code, write code, run tests, observe output, iterate. The outer loop re-plans if a step fails repeatedly.

The hybrid pattern gives you the cost predictability of planning with the adaptability of reactive execution. The planner sets the budget and structure. The executor adapts within that structure. The reflector catches problems before they cascade.

## Domain-specific workflows

### Engineering: incident response

```
Goal: "Investigate and resolve the elevated error rate on the payments API"

Plan:
1. Pull error logs from Datadog for payments API (last 2 hours)
2. Identify the top 3 error patterns by frequency
3. Check recent deployments to payments API (last 24 hours)
4. Correlate error spikes with deployment timestamps
5. If correlation found: generate rollback command
6. If no correlation: check upstream dependencies
7. Write incident report
8. Post summary to Slack #incidents
```

The reflector checks whether root cause was identified before proceeding to resolution. If step 4 finds no correlation, the planner is re-invoked to generate a deeper investigation plan. This is the hybrid pattern in action — plan-and-execute for the overall flow, with re-planning on failure.

### Data and reporting: automated dashboard

A financial consultancy built a production workflow that automates report generation. Seven coordinated AI agents process 53 data tables through 68 individually crafted prompts, generating 230 pieces of narrative content and assembling 82-slide presentations. Every output carries full provenance.

```
Goal: "Generate the weekly product metrics dashboard"

Plan:
1. Query Snowflake for activation, retention, and revenue data
2. Compute cohort-level metrics
3. Identify top 3 metric anomalies (>10% week-over-week change)
4. For each anomaly: run root-cause analysis query
5. Generate Chart.js visualizations
6. Assemble dashboard HTML with annotations
7. Deploy to internal server
8. Notify #product-metrics on Slack
```

The key insight: financial figures are extracted and placed, never generated. Zero tolerance for hallucinations. The plan ensures every data point traces back to a source. The reflector verifies that numbers match before the report ships.

### Finance: post-earnings analysis

```
Goal: "Analyze NVIDIA's Q2 earnings and produce an investment memo"

Plan:
1. Pull NVIDIA's 10-Q from SEC EDGAR
2. Extract key financials: revenue by segment, margins, guidance
3. Compare actuals vs. consensus estimates (FactSet)
4. Analyze management commentary from earnings call transcript
5. Identify top 3 surprises (beat/miss)
6. Assess thesis impact: bull/bear case stronger or weaker?
7. Generate comparable company multiples table
8. Write investment memo (1-page summary + 5-page analysis)
```

Each executor step uses a cheap model with specific tool calls — EDGAR API, FactSet, transcript parser. The reflector checks whether the surprises identified in step 5 are supported by the data extracted in steps 2-4 before the memo is written.

## How this maps to our agent systems

We already compose these patterns without always naming them.

**agent-rig's trinity pattern** (planner + worker + verifier) is a plan-and-execute variant. The planner decomposes goals into task docs. The worker executes each task with a ReAct loop — reading code, writing code, running tests. The verifier checks acceptance criteria. The human decides whether to approve or send back for re-planning.

**git-conveyor's pipeline** (backlog → ready → in progress → review) is the same pattern with a filesystem state machine. The PM plans (scopes issues), the coder executes (ReAct loop per task), the reviewer reflects (verifies the result).

**The key difference** from Codex plugins: our systems are filesystem-first and tool-agnostic. The plan is a Markdown task doc. The execution is whatever tool the worker uses. The reflection is the verifier's acceptance criteria check. The state machine is SQLite or filesystem conventions.

Codex plugins package this pattern for non-technical users. The Data Analytics plugin is a pre-built plan-and-execute workflow for data analysis. The Sales plugin is a pre-built plan-and-execute workflow for account prioritization. The plan is baked into the plugin's skills. The execution uses the plugin's MCP servers. The reflection uses the plugin's governance layer.

The architecture is the same. The packaging is different. We build it from files. They build it from installable bundles.

## Model selection strategy

| Role | Model | Why |
|---|---|---|
| Planner | Claude Sonnet, GPT-4o, o3 | Needs strong reasoning and decomposition ability |
| Executor | GPT-4o-mini, Claude Haiku | Cheap, fast, just needs to follow instructions and call tools |
| Reflector | Claude Sonnet, GPT-4o | Needs judgment to evaluate progress and decide next action |
| Replanner | Claude Sonnet, GPT-4o | Needs full context to revise the plan |

The planner and reflector need the same model quality. The executor can be much cheaper. This is the core cost advantage — you pay for intelligence once (planning) and once more (reflection), but the bulk of the work runs on cheap models.

## Open questions

Several things are still unclear from the research:

- How does plan-and-execute perform on tasks with high branching probability (p > 0.3)? The theoretical model suggests ReAct wins in that regime, but production data is limited.
- Will the hybrid pattern become the universal default, or will a new pattern supersede both?
- How do you tune re-planning frequency? Too frequent means cost overhead. Too rare means stale plans. Is there a data-driven approach?
- What happens when the planner hallucinates a valid-looking but wrong plan? How do you detect this before execution wastes budget?
- How does plan-and-execute interact with human-in-the-loop approval flows? Should the plan be approved before execution begins, or should individual steps require approval?
- Will model cost reduction (Haiku at $0.25/M input) make plan-and-execute's cost advantage less significant, shifting the decision toward ReAct's simplicity?

The cost reduction trend is the most interesting one. If Haiku-class models get cheap enough, the cost advantage of plan-and-execute shrinks. At that point, the decision shifts toward simplicity — and ReAct is simpler. But plan-and-execute's other advantages (auditability, parallelism, cost predictability) do not depend on cost. They hold even if execution is free.

---

## References

1. Agent Patterns Catalog — "Plan-and-Execute" (May 2026)
2. GenAI Patterns — "Plan and Execute" (April 2026)
3. SitePoint — "Agentic Design Patterns: The 2026 Guide" (March 2026)
4. Alice Labs — "AI Agent Architecture Patterns Explained" (May 2026)
5. CallSphere — "Plan-Execute-Reflect for Production Autonomy" (April 2026)
6. Promtable — "AI agents in 2026: the working reference" (June 2026)
7. LangChain — "Plan-and-Execute Agents" (May 2023, updated 2024)
8. Building Agentic AI — "ReAct vs Plan-and-Execute" (May 2026)
9. Laxaar — "Agent Planning: ReAct vs Plan-and-Execute Tradeoffs" (June 2026)
10. Context Is Everything — "Agentic Workflow Automation" case study (January 2025)
11. LangGraph — Plan-and-Execute tutorial (GitHub)
