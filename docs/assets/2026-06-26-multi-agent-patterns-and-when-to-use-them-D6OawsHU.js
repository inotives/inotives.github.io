var e=`---
title: "Multi-Agent Patterns and When to Actually Use Them"
date: 2026-06-26
tags: [multi-agent, architecture, agent-design, orchestration]
series: building-ai-systems
summary: "Four patterns dominate multi-agent orchestration: Trinity, Swarm, Coder-Reviewer, and Supervisor-Worker. But most tasks don't need any of them — the real question is whether the task is complex enough to justify the token overhead."
---

# Multi-Agent Patterns and When to Actually Use Them

I've been going back and forth on multi-agent systems. The patterns are seductive — planner decomposes, workers execute, verifier checks. But then I look at the token bill and wonder if I just needed a single good prompt.

Here's what I've settled on: multi-agent orchestration is a tool, not a default. The patterns exist for when complexity demands it, not because they sound impressive.

## When Single Agent Is Enough

Let me start here because it's the part most people skip.

If you can describe the task in one paragraph and the output fits in one response, you don't need multiple agents. A single LLM call with a good system prompt beats multi-agent on latency, cost, and reliability.

Examples of tasks that don't need orchestration:
- Creating a simple form with a few fields
- Running a sum or average over known data
- Writing a one-off script under 100 lines
- Answering a factual question

The best approach for these might not even be an agent. Just a deterministic function.

## The Token Cost Problem

Every agent handoff burns tokens. You pay for context re-hydration (system prompts, conversation history, artifacts), output generation from the handing-off agent, and input processing by the receiving agent.

In a three-agent pipeline (planner → worker → verifier), you're paying at minimum 3x the base task's context cost plus serialization overhead. A single agent pays that cost zero times.

This is why the "just use multi-agent for everything" advice is wrong. The overhead is real, and it compounds with each additional agent.

## The Four Patterns

When you do need multi-agent orchestration, four patterns dominate.

### Trinity (Planner → Worker → Verifier)

The most structured approach. A planner decomposes the task, workers execute, a verifier reviews.

**When it works:** Large-scale tasks where reliability matters more than speed — auditing a library, refactoring a codebase, generating a multi-file project from a spec. The planner breaks it into atomic pieces, workers run in parallel, and the verifier catches errors before they reach you.

**When it doesn't:** Simple tasks where decomposition is overkill. If a planner is just splitting "write a function" into "write the function," you're paying 3x for nothing.

**The tradeoff:** Highest token overhead, highest reliability. Latency is the sum of all phases.

### Agent Swarm (Peers, No Hierarchy)

Agents with different capabilities collaborate as peers. No fixed structure — they self-organize around the task.

**When it works:** Open-ended exploration, research workflows where agents specialize by domain (web searcher, data analyst, writer). The flexibility is the point.

**When it doesn't:** Tasks that need guaranteed completion or predictable output. Emergent behavior is hard to debug, and there's no built-in quality gate.

**The tradeoff:** Flexible and natural, but unpredictable. Context balloons as all agents share the same thread.

### Coder-Reviewer (Write → Review → Iterate)

One agent writes code, another reviews it. If the review fails, the coder iterates.

**When it works:** PR workflows, pair-programming setups, tasks where blind spots are predictable. You can use a cheaper model for review if the coder is strong.

**When it doesn't:** Tasks that need architectural planning before coding. The coder holds the full task in context with no decomposition step.

**The tradeoff:** Simple two-phase handoff, but no planner means the coder might build the wrong thing efficiently.

### Supervisor-Worker (Hub and Spoke)

A supervisor routes tasks to specialized workers — frontend specialist, testing agent, security auditor. Workers are narrow and cheap. The supervisor merges results.

**When it works:** Systems with heterogeneous tool access, tasks that genuinely need different specializations. Easy to add or swap workers without changing the orchestration.

**When it doesn't:** When the supervisor becomes a bottleneck or when workers need to adapt to unexpected sub-tasks autonomously.

**The tradeoff:** Simple workers, unified output, but the supervisor is a single point of failure and must understand every worker's capabilities.

## The Decision Heuristic

I keep coming back to this: if the task requires examining multiple files, running multi-step reasoning with intermediate state, or coordinating parallel work, use multi-agent. If it fits in one prompt, don't.

The patterns are tools. Trinity for reliability-critical large tasks. Swarm for exploration. Coder-Reviewer for quality gates. Supervisor-Worker for specialized delegation. Pick the one that matches your actual constraints — not the one that looks best in a blog post.

## Open Questions

I'm still working through a few things:
- What's the empirical token-cost ratio where multi-agent becomes worth it per unit of output quality?
- Can patterns nest — a supervisor where a worker uses trinity internally?
- Do different models have natural advantages for different roles?
- Where does human-in-the-loop fit — as verifier, supervisor, or override?

The boundary between "this needs orchestration" and "this needs a good prompt" keeps moving as models get better. Today's multi-agent task might be a single-call task next year.

## References

- [OpenAI Swarm framework](https://github.com/openai/swarm)
- [LangGraph multi-agent patterns](https://langchain-ai.github.io/langgraph/)
- [Anthropic agent design patterns](https://docs.anthropic.com/en/docs/build-with-claude/agentic-patterns)
`;export{e as default};