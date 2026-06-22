var e=`---
title: "The Engineer's Job Isn't Writing Code Anymore — It's Maintaining Intent"
date: 2026-06-12
tags: [ai-engineering, intent-debt, cognitive-surrender, comprehension-debt, agentic-workflows, human-in-the-loop, goal-directed]
summary: "Andrej Karpathy killed vibe coding in May 2026. The replacement — agentic engineering — moves the leverage point from writing code to maintaining intent. Here's the workflow discipline that keeps you on the right side of cognitive offloading, how I apply it in my own agentic pipelines, and why intent debt is the one debt agents cannot pay down."
---

## The Engineer's Job Isn't Writing Code Anymore — It's Maintaining Intent

I spend most of my coding time these days directing agents, not writing code myself. Claude Code handles implementation. Codex reviews diffs. Skills chain into pipelines that run autonomously against market data. Sub-agents explore codebases while I plan the next move.

It works. The output is faster and often better than what I'd produce solo. But there's a catch that took me months to articulate: **the leverage moved, and it moved away from the thing I was good at.**

Andrej Karpathy made it official at Sequoia AI Ascent 2026 — vibe coding is over. The replacement is agentic engineering. But the real shift isn't about tools or models. It's about what the human does in the loop. And the answer, uncomfortable as it is: you maintain intent. Everything else you can delegate.

---

## The Death of Vibe Coding, by the Numbers

The data on vibe coding failure is damning:

- **66%** of developers who vibe-coded seriously reported spending more time fixing AI-generated code than writing it themselves
- Security vulnerabilities in vibe-coded codebases run **2.74x higher** than structured workflows
- On SWE-bench Pro, even the best models score under 60% with only a vague prompt
- An Anthropic RCT (52 engineers, 2026) found AI-assisted participants scored **17% lower** on comprehension quizzes than the control group — but only when using AI for *generation*. Those using AI for *conceptual inquiry* held their ground

The failure wasn't model quality. It was ambiguity. Ambiguity compounds with every iteration. What starts as a small gap in intent becomes an unrecoverable divergence in behavior. You think you're building toward something; the agent is building toward something adjacent. By the time you notice, you're 300 lines deep into the wrong architecture.

I've felt this. Early on, I'd paste a vague description into Claude Code and let it run. The code looked clean. Tests passed. Then I'd realize it solved the wrong problem — beautifully, confidently, and completely.

---

## Intent Debt: The Debt Agents Cannot Pay Down

Addy Osmani's "Intent Debt" framework (June 2026) named the thing I'd been feeling. Margaret-Anne Storey's Triple Debt Model defines three independent debt types:

| Debt type | Lives in | Can agents help? |
|---|---|---|
| **Technical debt** | The code | Yes — refactoring, test generation |
| **Cognitive debt** | People's heads | Partially — explanation, summarization |
| **Intent debt** | Written artifacts | **No — intent must originate with a human** |

Intent debt is the absence or erosion of externalized rationale, goals, and constraints that explain *why* the system is the way it is. The key word is **externalized** — the rationale must be written where a teammate, future you, or an agent can read it.

Why agents can't pay it down: an agent can infer a plausible rationale from the code, but a guess about intent **is not** the intent. The model doesn't know whether that 300ms debounce was a deliberate UX decision, a benchmark result, or a number someone typed once and never revisited. It will invent a confident-sounding reason, which is worse than admitting ignorance.

The economic shift is what makes this urgent. Before agents, un-externalized intent cost you at onboarding or after someone left. Now you pay it **every session, multiplied by every agent**. Each agent starts every session cold. Twenty parallel agents are twenty teammates who have never met you, cannot read your mind, and will fill every gap in your intent with a plausible guess.

---

## Cognitive Surrender: The Comfortable Failure

The Wharton School paper by Shaw and Nave (2026) draws the critical line:

- **Cognitive offloading:** You hand off the *how* and keep the *what*. You still judge whether the result is sensible and intervene when it's not. (The calculator. The search engine.)
- **Cognitive surrender:** You stop constructing the answer at all. The AI's output becomes your output. You never formed an independent view to compare it against.

The data: across 1,372 participants, **73% accepted the wrong answer** when AI was available. Confidence *increased* even though half the answers were deliberately incorrect. People borrowed the model's confidence and treated it as their own.

For me, surrender doesn't happen on the obvious stuff. I don't blindly accept fabricated APIs or invented imports. It happens further down the stack — the 600-line PR I scan and approve, the error I paste and accept the fix for without understanding the root cause, the design decision I adopt from a confident-sounding paragraph of justification.

Addy Osmani nails the mechanism: *"Cognitive surrender is how you take on cognitive debt. Comprehension debt is the bill, denominated in lost mental model."*

I wrote about this before in [Context Degradation in AI Coding Sessions](/posts/2026-05-23-context-degradation-in-coding-sessions) — the U-shaped curve where models lose mid-context information and start making stranger choices. The practical mitigation there (session segmentation, checkpoints, context budgeting) addresses the technical symptom. Intent debt is the deeper disease. Even a perfectly fresh session produces wrong output if the agent doesn't know *why* the system exists.

---

## Comprehension Debt: The Invisible Metric

Comprehension debt is the growing gap between how much code exists in a system and how much of it any human genuinely understands. Unlike technical debt, it doesn't announce itself through mounting friction. The codebase looks clean. The tests are green. The reckoning arrives quietly.

The dynamic that scares me: AI generates code far faster than humans can evaluate it. When code was expensive to produce, senior engineers could review faster than juniors could write. AI flips this: a junior generates code faster than a senior can critically audit it.

Surface correctness is not systemic correctness. AI output compiles, passes linters, runs, and looks plausible — the exact signals that historically triggered merge confidence. But the gap between "looks right" and "is right" is exactly where surrender hides.

Anthropic's skill-formation study confirms the mechanism: engineers who used AI for **code generation delegation** scored below 40% on comprehension tests; those who used AI for **conceptual inquiry** scored above 65%. The tool doesn't destroy understanding. How you use it does.

This is why I insist on writing [skill chains](/posts/2026-06-04-skill-chaining-stock-trading-pipeline) with explicit interface contracts and prerequisite enforcement. Not because the agent can't figure it out — it can — but because *I* need to understand the chain well enough to intervene when it breaks. The skill authoring process forces comprehension that passive consumption would erode.

---

## The Workflow: From Goal to Merge

The synthesis of these frameworks produces a repeatable workflow. I've been running variations of this across my projects — the stock prediction pipeline, the git-conveyor multi-agent system, the crypto data cleanup workflows. Here's the distilled version:

\`\`\`
1. Human sets goal              →  Why this work exists, what "done" looks like
2. Human + AI decompose task    →  Collaborative planning, verifiable steps
3. AI-agent implements          →  Maker (e.g. Claude) executes against the plan
4. Different AI-agent reviews   →  Checker (e.g. Codex) verifies against criteria
5. Agents align on success      →  Auto-pass or auto-reject
6. Human final review → Merge   →  System-level judgment
\`\`\`

### Phase 1: Understand the Ultimate Goal (Human)

Before any code is written, I externalize the intent. Not a detailed spec — a statement of **why** this work exists, what success looks like, and what constraints are non-negotiable.

The questions I answer:
- What user problem are we solving?
- What does "done" look like — and how will we verify it?
- What constraints apply (performance, security, maintainability)?
- What is explicitly out of scope?

This is the part no agent can do. Intent originates with the human. Every time I've skipped this step and jumped straight to "implement X," the agent built the wrong X.

### Phase 2: Diagnosis Before Solution (Human + AI)

Before proposing solutions, diagnose the actual problem. The agent will happily generate a solution for the wrong problem if given a vague prompt.

In my stock trading pipeline, this meant asking: is the problem that predictions are inaccurate, or that the data pipeline feeding them is inconsistent? The agent was ready to build a more complex prediction model. The actual issue was [dirty asset data from multiple providers](/posts/2026-06-08-crypto-asset-data-cleanup-agentic-spaces) — the fix was a canonical asset glossary with a bridge table, not a smarter LLM.

The engineer decides which problems are worth solving. The agent accelerates diagnosis by surfacing relevant code paths and past commits.

### Phase 3: Collaborative Decomposition (Human + AI)

Decompose the goal into steps that can be independently verified. This is where the engineer and agent work as partners, not commander-and-executor.

The engineer brings system context: architectural boundaries, load-bearing decisions, past failures. The agent brings speed: proposes decomposition in seconds, identifies missing steps, surfaces dependencies.

Osmani's principle: *"The unit of review is the unit of comprehension. Make the unit small enough to actually comprehend."*

In [skill chaining](/posts/2026-06-04-skill-chaining-stock-trading-pipeline), each skill in the chain is a decomposed step with a typed interface contract. The close summary skill produces a deterministic output path. The prediction skill reads from that path and adds delta-only output. The decomposition is embedded in the architecture — not a planning artifact that drifts from implementation.

### Phase 4: Set Evaluation Criteria (Human)

Before agents begin work, define what counts as "done" for each step. This is the sprint contract pattern — the generator and evaluator negotiate what "done" means before code gets written.

Evaluation criteria must be:
- **Verifiable by evidence** — a test that runs, a screenshot, a log. Not "it looks done."
- **Resistant to rationalization** — anti-rationalization tables pair each excuse with a rebuttal
- **Separate from the implementer** — the agent that wrote the code shouldn't grade it

### Phase 5: Maker-Checker Split (Agent + Agent)

Two agents with distinct roles. The human is removed from intermediate review and re-enters only at the final merge gate.

**Maker** (e.g. Claude Code): Implements each step against the decomposition plan. Runs verification. Produces a diff.

**Checker** (e.g. Codex): A different agent family with different instructions. Reviews the maker's output against evaluation criteria. Catches the things the maker talked itself into.

The key design choice: the checker is a **different model family**. Claude implements, Codex reviews (or vice versa). This prevents shared blind spots. In [git-conveyor](https://github.com/inotives/git-conveyor), this maps directly to the Coder and Reviewer agents — the Coder picks up tasks from "To Do" and implements, the Reviewer runs hooks (test, lint, security-checks) and either advances to "Done" or rolls back with a failure log.

Osmani: *"The model that wrote the code is far too generous grading its own homework."*

### Phase 6: Human Final Review (Human)

The completed, multi-agent-reviewed work reaches the engineer for the final, non-delegable gate. The engineer isn't reviewing line by line — the agents already did that. The engineer answers higher-level questions:

- Does the overall solution satisfy the original goal?
- Are there architectural concerns the agents couldn't evaluate?
- Does the codebase still make sense to me as a coherent system?

This is where cognitive surrender is most dangerous, because everything looks clean and the agents agree. The engineer must still form an independent judgment: **is this right?**

---

## Practices That Resist Cognitive Surrender

Concrete habits I've adopted:

**Write down expectations before the agent acts.** Before a non-trivial task, form an independent view of what the answer should look like. When the agent's output matches, I'm calibrated. When it doesn't, I have a real choice: am I wrong, or is it?

**Read the diff with full attention.** The first PR of the day gets a real review; the fifth gets a glance. Know your fatigue curve and stop generating when you're too tired to evaluate.

**Use friction intentionally.** A required design doc before generation, a confirmation step before merge. Friction has a bad reputation in productivity discourse; it is also exactly what stands between offloading and surrender.

**Ask the model to argue against itself.** Most models produce a confident answer and then, when prompted, an equally confident counter-argument. If you can't reason about which is right, you've found a place where you were about to surrender.

**Maintain solo coding time.** Write some code without the agent every week — not as a moral exercise but as calibration. The day you cannot build something simple without AI assistance is the day offloading became surrender and you didn't notice.

**Use conceptual inquiry over generation when learning.** Ask the agent to explain before asking it to generate. The same tool, used to interrogate rather than produce, builds rather than erodes your mental model.

---

## The Intent Artifacts Every Repository Needs

To make goal-directed workflows work, you must externalize intent into artifacts the agent can read:

- **AGENTS.md as intent ledger:** Not an auto-generated config file. Conventions, constraints, "we do not do it this way because of that one incident." Every line traces to a specific past failure.
- **Decision logs (ADRs):** Recording *why* at the moment you decide costs almost nothing. Reconstructing it eight months later costs a fortune.
- **Learnings files:** Self-improving agents that update a learnings file at the end of a session turn every mistake into an artifact that prevents the same mistake next run.
- **Specs that capture intent, not implementation:** Goals, constraints, non-negotiables, and an explicit definition of done.

The economic argument: keeping intent in your head cost you a little, occasionally. Now it costs you every session times every agent. Externalizing intent is no longer a documentation nicety. It is a throughput multiplier.

---

## The Bottom Line

The AI engineer's job has not been eliminated — it has relocated. The leverage point has moved from writing code to maintaining intent. The engineer who understands the ultimate goals, can decompose them into verifiable steps, set evaluation criteria, and serves as the merge gate becomes more valuable, not less.

Boris Cherny (creator of Claude Code) at Sequoia AI Ascent 2026: *"Build for the user, then build for the model. The model can write the code. What it cannot do is know what you actually want to build, and why, and what tradeoffs matter."*

The risk is real. Cognitive surrender is comfortable. Comprehension debt is invisible. Intent debt compounds silently. But the practices that resist them are simple: write down your intent before the agent acts, decompose into reviewable units, split maker and checker across different model families, and always — always — form your own judgment before clicking merge.

The loop runs itself now. Your job is to make sure it's running toward something you actually want.

---

### References

1. Addy Osmani — "The Intent Debt" (June 5, 2026): https://addyosmani.com/blog/intent-debt/
2. Addy Osmani — "Cognitive Surrender" (May 5, 2026): https://addyosmani.com/blog/cognitive-surrender/
3. Addy Osmani — "Comprehension Debt" (March 14, 2026): https://addyosmani.com/blog/comprehension-debt/
4. Shaw & Nave — "Thinking Fast, Slow, and Artificial" (Wharton, 2026)
5. Karpathy — Sequoia AI Ascent 2026: https://pureai.com/articles/2026/05/15/the-human-in-the-loop-clear-path-to-vibe-coding.aspx
6. Anthropic — "How AI Impacts Skill Formation" (2026)
7. Storey — "Triple Debt Model" (2026)

**Related posts on this site:**

- [Context Degradation in AI Coding Sessions](/posts/2026-05-23-context-degradation-in-coding-sessions) — the technical symptoms of comprehension debt in practice
- [Skill Chaining: Building Connected AI Workflows](/posts/2026-06-04-skill-chaining-stock-trading-pipeline) — decomposed pipeline with interface contracts and prerequisite enforcement
- [Loop Engineering: Stop Prompting Agents, Start Building Systems](/posts/2026-06-13-loop-engineering-patterns) — the system design layer above this workflow
- [Crypto Asset Data: Why Clean Data Matters for Agentic Workflows](/posts/2026-06-08-crypto-asset-data-cleanup-agentic-spaces) — diagnosis-before-solution in practice`;export{e as default};