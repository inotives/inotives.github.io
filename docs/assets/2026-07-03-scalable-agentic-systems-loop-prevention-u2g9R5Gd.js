var e=`---
title: "Scalable Agentic Systems: Seven Loop Types, Layered Guardrails, and When Humans Should Pull the Plug"
date: 2026-07-03
tags: [agentic-systems, ai-agents, loop-detection, token-cost, human-in-the-loop, workflow-design]
series: building-ai-systems
summary: "Agentic systems iterate, and iteration consumes tokens. Without guardrails, a stuck agent burns through budget while producing nothing. This covers the seven loop types that show up in production, the layered defense that actually works, and the R.A.I.L. framework for deciding when to involve humans. First in a series on building ai-systems that don't eat your wallet."
---

# Scalable Agentic Systems: Seven Loop Types, Layered Guardrails, and When Humans Should Pull the Plug

This is the first post in a series on building ai-systems that scale. The starting point is the problem that kills most agentic deployments: loops.

Agentic workflows are loops by design. The ReAct pattern, Andrew Ng's four design patterns, multi-agent orchestration — they all repeat. Iteration is the entire point. But every iteration costs tokens, and every stuck loop costs tokens without progress. The $47K LangChain incident (Analyzer produces analysis, Verifier requests more analysis, mutual recursion runs for 11 days) is the worst-case scenario, but the everyday version is subtler: agents burning through budgets on marginal improvements, retrying failed tools with identical arguments, or oscillating between two equivalent approaches.

The fix is not to avoid loops. It is to detect, bound, and escalate them.

## The seven loop types

Production agentic systems produce seven distinct loop failure modes. Each needs a different detection strategy.

**Retry loops.** The agent retries a failed tool call. The "Agent Loop Trap" is the canonical failure: agent calls tool, tool returns error, agent says "I'll try again," calls the exact same tool with the exact same arguments, repeats 15 times until credit hits zero. Retry amplification in agentic systems is worse than in microservices because every retry resubmits the full conversation context. A single flaky API can amplify into a 200x token cost increase.

Fix: exponential backoff with max retry count (3), then escalate or circuit-break.

**Reasoning/reflection loops.** The agent re-examines its reasoning without making progress. Reflection works — Andrew Ng's data shows GPT-3.5 jumping from 48.1% to 95.1% on HumanEval with the reflection pattern. But without convergence detection, the agent oscillates between two near-equivalent solutions. An agent reconciling conflicting on-chain data oscillates between two interpretations, re-reading the same blocks each time.

Fix: cosine similarity check (threshold ~0.92) on successive outputs. If they converge, stop. If they oscillate, halt and return best-so-far.

**Tool-use loops.** The agent calls the same tool repeatedly with slightly different inputs. AgentBrake detects this via SHA-256 hashing over JSON-sorted (name, args) payloads — argument ordering doesn't fool it. A data ingestion agent querying a blockchain indexer with different block ranges, getting partial data each time, is a textbook case.

Fix: hash tool calls, count repeats in a sliding window, escalate after N identical calls.

**Planning loops.** The agent re-plans without executing. The plan-execute-reflect-replan cycle spirals when the planner keeps discovering new subtasks. A crypto portfolio rebalancing agent generates a new plan every time market conditions shift by 0.1%, never placing orders.

Fix: count replans without execution. If replans exceed M without a single tool call, force execution of current plan or escalate.

**Semantic loops.** Different phrasing, same dead end. The agent calls \`search("crypto tax rules")\`, then \`search("what are crypto tax regulations")\`, then \`search("crypto taxation requirements")\`. No two outputs are identical, so standard max-steps guards miss it. Only semantic similarity detection catches this.

Fix: cosine similarity on query text (threshold ~0.92) or Locality-Sensitive Hashing (threshold ~0.85). Agent-loop-guard reports 94.7% accuracy for deterministic loops, 89.3% for semantic, under 2.1% false positive rate.

**Oscillation loops (A-B-C-A patterns).** The $47K incident. No individual call repeats, but the pair does. Hash pairs of consecutive calls and look for repeated pairs. Three repeated pairs in six steps is oscillation.

Fix: hash call signature plus previous call's signature. Look for repeated pairs in sliding window.

**Multi-agent delegation loops.** Agent A calls Agent B, which calls Agent C. If C's tool fails and B retries, and A retries B's workflow, exponential blowup occurs. Each retry resends full conversation context. Three agents with three retries = 27x token amplification. Traditional circuit breakers handle this worst because the retry decision happens at a different abstraction layer than the failure.

Fix: cascade detection (3+ failures to stop), deadline propagation (sub-agents inherit shrinking deadline), backpressure signaling between agents.

## Layered guardrails

No single mechanism catches everything. The best systems stack three layers.

### Layer 1: Hard limits

Jatin Bansal's Seven Budget Primitives:

1. **Step cap** — iteration count ceiling (Vercel default: 20, OpenAI: 10, LangGraph: 25)
2. **Wall-clock deadline** — per-run, shrinking monotonically
3. **Token ceiling** — cumulative input+output tokens (catches context bloat: 4K doubling to 128K at step 5)
4. **Dollar ceiling** — per-run + per-tenant daily + per-tenant monthly (the $47K incident stops at $50)
5. **Per-tool quota** — mutating tools: single digits; read-only: dozens
6. **No-progress detection** — O(K) scan over last K tool calls (single-call + pair-repetition)
7. **External abort signal** — operator kill switch checked at every iteration

The key insight from Bansal: "An agent budget is the harness-enforced set of preconditions checked before every step that, when any one fails, terminates the run with persisted partial state — not after, not during, before the next side effect." Budgets must be enforced inside the request path, not on dashboards.

### Layer 2: Convergence detection

- **Deterministic repeat detection.** Hash (tool_name, sorted_args) and look for repeats in a sliding window. Three identical calls in a row is decisive evidence the model is stuck.
- **Semantic similarity.** Cosine similarity or LSH catches near-duplicates that hashing misses.
- **Oscillation detection.** Hash pairs of consecutive calls. Single-call detection misses the Analyzer/Verifier mutual recursion.
- **Progress tracking.** Define what "progress" means per task type. For data ingestion: new records processed. For crypto analysis: new data points incorporated. Flat progress counter for M iterations triggers escalation.

### Layer 3: Circuit breakers

Three states: CLOSED (requests pass through), OPEN (errors returned immediately), HALF_OPEN (test requests through). Create separate circuit breakers per external service.

The numbers matter: uncontrolled retries consumed ~$2 in 30 seconds for a single conversation. Circuit-breaking reduced that to ~$0.01 — a 200x cost reduction.

**Budget warning injection** at 70-80% of budget enables self-correction before hard termination. The agent can wrap up its current step and produce a partial result rather than being cut off mid-reasoning.

## Token cost management

The $47K LangChain incident is the cautionary tale: each iteration costs $80 due to large context windows, and standard observability tools (Datadog, New Relic) see HTTP 200 OK — they're blind to semantic failures of LLMs.

Retry amplification compounds this. A ReAct-style agent retrying a failed tool three times spends 10,000 additional input tokens (full conversation re-billed three times). In one benchmark, 90.8% of retries in a 200-task benchmark were wasted on non-retryable errors.

**Layered defense across the stack:**

| Layer | Strategy | Purpose |
|-------|----------|---------|
| Tool-level | Rate limiter + per-attempt timeout (10s) + total timeout (30s) + retry with backoff/jitter (3 max) + circuit breaker (10% failure in 30s) | Prevent individual tool loops |
| Conversation-level | Max 5-10 tool calls per turn (normal: 1-3; >15 is spiral), per-session token budget, tool call deduplication | Prevent conversation-level loops |
| Orchestration-level | Cascade detection (3+ failures to stop), deadline propagation, backpressure signaling | Prevent multi-agent loops |
| Caching | Adaptive TTLs — current data: 5 min; historical: 1 hour | Reduce redundant API calls |

**Model routing** is the cost-performance lever. Route simple tasks to cheaper models (GPT-4o-mini, Claude Haiku) and complex tasks to capable models (GPT-4o, Claude Sonnet). In a loop, early exploration steps use a cheap model; only final synthesis uses the expensive one.

**Context compression** pairs with token budgets so the cap reflects useful work, not padding. Summarize conversation history and tool results between iterations. Long contexts are expensive; compressing state between loop turns reduces consumption without losing critical information.

**Graceful degradation** means partial results instead of crashes when limits hit. Users decide whether to continue with fresh context. The agent may have already done useful work worth saving.

## Human-in-the-loop: when and how

The question is not whether to involve humans, but when.

### The R.A.I.L. Placement Model

| Factor | High | Low |
|--------|------|-----|
| Reversibility | Move human earlier (approval) | Can tolerate post-hoc review |
| Ambiguity | Push toward escalation/review | Agent handles autonomously |
| Impact | Be deliberate about authority | Low-friction autonomy |
| Latency | Async review or exception-only | Synchronous approval acceptable |

| R.A.I.L. Pattern | Best Control Point |
|-------------------|-------------------|
| Low reversibility, high impact | Approval |
| High ambiguity, medium/high impact | Escalation |
| High confidence, reversible, quality-sensitive | Review |
| Low impact, low ambiguity, low blast radius | No checkpoint or sampled review |

### Four control point types

1. **Approval.** Hard gate before execution. "I know what I want to do. May I do it?" Example: crypto trade exceeding $10,000.
2. **Review.** Checkpoint on output quality. Agent drafts, human checks accuracy/tone/policy.
3. **Escalation.** "I should not be the one handling this anymore." Agent recognizes ambiguity, low confidence, or permission boundary.
4. **Interrupt.** Active pause during execution, system-triggered or human-triggered. Requires durable state for clean resume.

### The risk matrix

| | Low Impact | High Impact |
|---|---|---|
| Reversible | Full autonomy | Autonomy with audit |
| Irreversible | Autonomy with notification | Human approval required |

### Progressive autonomy (the enterprise pattern)

1. Phase 1: Agent suggests, human executes
2. Phase 2: Agent executes, human reviews after the fact
3. Phase 3: Agent executes autonomously for routine cases, human reviews edge cases
4. Phase 4: Full autonomy with periodic audits

Each phase earns the right to the next. Skipping to full automation without monitoring underneath is how agents run all night producing nothing useful.

### Failure modes of bad HITL

- **Approval theater.** The human approval step exists on paper but the interface doesn't support real judgment. Reviewer gets a button, not the substance.
- **Unbounded friction.** Humans approve everything — zero time savings, just a different interface for manual work.
- **Timeout blindness.** What happens when the human does not respond? Never let an agent workflow hang indefinitely. Options: safe default, escalate to different reviewer, queue for later.

AWS Well-Architected guidance: "Routing every agent action through human review produces rubber-stamp approvals. Routing none produces unbounded autonomy. Risk-tiered approval pauses agents only for the decisions where human judgment actually changes the outcome."

## Scalable architecture

Anthropic identifies five compositional patterns, ordered from simple to complex:

1. **Prompt Chaining** — sequential steps with programmatic gates. Best for predictable, linear workflows.
2. **Routing** — classify input and direct to specialized handlers. Best for diverse input types.
3. **Parallelization** — run independent subtasks simultaneously.
4. **Orchestrator-Workers** — central LLM dynamically delegates to worker LLMs. Best when subtasks are unpredictable.
5. **Evaluator-Optimizer** — generate then critique in a loop. Best when quality improves with iteration.

The key architectural principle: **use workflows (predetermined code paths) for predictable tasks, and agents (dynamic LLM-directed processes) only where flexibility is needed.** Anthropic: "Workflows offer predictability and consistency for well-defined tasks, whereas agents are the better option when flexibility and model-driven decision-making are needed at scale."

The "agent harness" framework separates base-model reasoning from: memory substrate, context constructor, skill-routing layer, orchestration loop, and verification-and-governance layer. Each layer can be independently optimized and scaled.

### State machine / durable execution patterns

1. **Checkpoint** — save workflow position before every action
2. **Idempotency** — tag operations with dedup keys; downstream returns original result on repeat
3. **Retry with discipline** — timeout, bounded attempts, exponential backoff with jitter
4. **Dead-letter queue** — after N failures, move aside for inspection instead of spinning
5. **Rollback** — for actions that cannot be re-run, undo them

"A loop that runs unattended will, given enough runs, crash in the middle of an action, retry something that already happened, and wedge on a bad input."

## Domain examples

### Data ingestion

Data ingestion pipelines are high-loop-risk: repeated external API calls, variable data quality, high volume.

A blockchain indexer API returning partial results due to rate limiting. Agent queries block range [1000, 2000], gets 1000-1500. Detects gap, retries [1501, 2000], gets 1501-1800. Detects gap, retries [1801, 2000], gets 429 (rate limited). Retries [1801, 2000], gets 429 again. Infinite loop burning tokens.

Fix: Layer 1 (hard limit): max 5 retries per range. Layer 2 (progress tracking): 3 consecutive 429s, pause 30s then resume. Layer 3 (circuit breaker): total retries > 10, escalate to human with partial data report.

Prevention strategies: per-source circuit breakers (skip Exchange A after 3 failures, proceed with B and C), idempotent processing (each data point gets unique ID, re-processing is a no-op), batch + checkpoint (process N records, checkpoint after each batch), timeout per source (move on if no response within X seconds).

### Crypto trading

Crypto trading agents are the highest-risk loop scenario because loops cost real money.

A portfolio rebalancing agent in choppy markets: BTC oscillating between $99,500 and $100,500. Sees BTC below 20-day MA, sells. BTC bounces to $100,200, buys. Oscillates, generating buy/sell signals every few minutes, burning tokens on analysis and executing costly trades.

Fix: deadband (only rebalance if signal exceeds 2% deviation, not 0.5%), cooldown (after executing a trade, don't re-analyze for N minutes), cap trades per day (max 5 rebalancing actions per 24 hours), escalate to human if agent wants to trade more than the cap.

Other crypto loop scenarios: wash trading (agent accidentally fills against its own orders), arbitrage detection (scanning without minimum profit threshold), price feed processing (duplicate timestamps cause reprocessing).

Real-world crypto agent systems: Forge Onchain Intelligence (Solana, event-driven hooks), SLAM AI SWARM (real-time on-chain data for early activity detection), Barzakh AI (full-stack onchain agent with 115+ blockchain tools).

Non-negotiable human-in-the-loop triggers: orders exceeding dollar threshold, portfolio allocation changes beyond predefined bands, positions during high-volatility events, any agent behavior deviating from predefined strategy.

## Open questions

- How do token costs scale with agent complexity in production? What's the typical cost ratio between simple routing agents and fully autonomous agents for the same task?
- How should loop guardrails interact with multi-agent systems? If one agent in a pipeline is stuck, should the entire pipeline halt or just that agent?
- What is the optimal human-in-the-loop frequency? Too much human involvement defeats automation; too little risks costly errors.
- How do you handle loops in multi-modal agentic systems (text + images + code execution)? The loop detection strategies above assume text-based reasoning.
- How does the Gartner prediction of 40%+ agentic project cancellations by 2027 relate to loop/cost issues specifically?

---

## References

1. Anthropic — "Building Effective AI Agents": https://www.anthropic.com/research/building-effective-agents
2. Andrew Ng — "Four AI Agent Strategies That Improve GPT-4 and GPT-3.5 Performance": https://www.deeplearning.ai/the-batch/how-agents-can-improve-llm-performance/
3. Andrew Ng — "Agentic Design Patterns Part 2: Reflection": https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-2-reflection/
4. Anthropic Engineering — "Claude SWE-Bench Performance": https://www.anthropic.com/engineering/swe-bench-sonnet
5. Lilian Weng — "LLM Powered Autonomous Agents": https://lilianweng.github.io/posts/2023-06-23-agent/
6. Xi et al. — "The Rise and Potential of Large Language Model Based Agents: A Survey": arXiv:2309.07864
7. Jatin Bansal — "Agent Budgets and Runaway Prevention": https://jatinbansal.com/ai-engineering/agent-budgets-and-runaway-prevention/
8. Google Cloud Architecture Center — "Choose a Design Pattern for Your Agentic AI System": https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system
9. AgentEngineering.org — "Human-in-the-Loop Control Design": https://agentengineering.org/articles/human-in-the-loop-control-design/
10. Sentinel — "Stop-condition patterns for ReAct agents": https://github.com/darshjme/sentinel
11. Tian Pan — "The Retry Storm Problem in Agentic Systems": https://tianpan.co/blog/2026-04-10-retry-storm-agentic-systems-cascading-failure
12. n1n.ai — "Preventing Runaway AI Agent Costs and Token Spirals": https://explore.n1n.ai/blog/prevent-runaway-ai-agent-costs-token-spirals-2026-05-25
13. Forge Onchain — "Agent System Overview": https://docs.forgeonchain.ai/how-forge-works/agent-system-overview
14. SLAM AI — "The SWARM": https://docs.slamai.xyz/agents/swarm
`;export{e as default};