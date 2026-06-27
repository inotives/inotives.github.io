---
title: "The Effectiveness of Loop Engineering: When Autonomy Burns More Than It Builds"
date: 2026-06-27
tags: [agent-loop, loop-engineering, token-cost, react, human-in-the-loop]
summary: "Agent loops look efficient until you see the token bill. The O(N²) cost curve, the ambiguity tax, and the gap between what loops promise and what they deliver in practice."
---

# The Effectiveness of Loop Engineering: When Autonomy Burns More Than It Builds

I've been running agent loops for about a month now. The pitch is compelling: give the agent a goal, let it plan, code, test, iterate, and ship. But after watching token bills climb and reviewing loop outputs that took 20 minutes to produce what I could have done in 2, I started questioning the premise.

Loop engineering — designing, budgeting, and constraining agent iteration cycles — turns out to be less about making loops smarter and more about knowing when to stop them.

## What Is the ReAct Loop?

The ReAct loop is one of the most fundamental patterns in loop engineering. Most coding agents run on it: ReAct (Reasoning + Acting). It was introduced by Yao et al. in 2023 and has become the dominant loop for LLM agents.

The cycle has three steps:

1. **Thought** — The model reasons about the current state. What has it done so far? What information is missing? What should it do next? This is free-form text with no external effect.
2. **Action** — A concrete step: call a tool (read a file, search the web, run a command), or produce a final answer.
3. **Observation** — The result of the action fed back into context. File contents, search results, command output, error messages.

Then it repeats. Thought → Action → Observation → Thought → ... until the agent decides it has enough information and produces a final Answer action.

Why does this work? It combines two things that failed alone:
- **Pure reasoning** (Chain-of-Thought): the model thinks but can't gather new information. Errors compound without correction.
- **Pure acting** (tool use without reasoning): the model calls tools but doesn't plan. It reacts locally without strategy.

ReAct interleaves both. Reasoning informs action choice. Observations inform subsequent reasoning. The explicit Thought step forces the model to articulate its plan before each action, which improves traceability and correctness.

In practice, most modern agents use a streaming variant — Thought and Action appear in real time as tokens, and Observations stream in as tool output arrives. You see the agent "think" and "act" simultaneously rather than in discrete blocks.

## The O(N²) Problem Nobody Warns You About

Here's the math that surprises most people: agent loop cost isn't linear with the number of turns. It's quadratic.

Every turn in a ReAct loop re-sends the entire conversation history to the API. Turn 1 sends the system prompt plus one exchange. Turn 10 sends the system prompt plus nine prior exchanges. By turn 20, you're paying for the accumulated weight of everything that came before.

The formula is roughly:

```
Total tokens = N × (prefix + N × average_exchange_size)
```

Where N is the number of turns. For a 20-turn agent, the context growth isn't 20x — it's closer to 200x in accumulated token exposure. One analysis found that a moderate-complexity agent with 3-5 tools typically costs 5-10x more than naive estimates suggest. Multi-agent systems hit 20-50x.

This is structural. The API is stateless. Every call needs the full context. There's no "remember what we discussed" shortcut — you pay to re-send it every time.

## The Ambiguity Tax

The biggest cost driver in full-loop autonomy isn't the loop itself. It's ambiguity.

When the problem definition is even slightly unclear, the agent will:
1. Generate multiple interpretations
2. Pick one (sometimes arbitrarily)
3. Build against it
4. Discover mismatches during testing
5. Iterate — possibly in the wrong direction

Three rounds of ambiguity correction can easily exceed the cost of a human spending two minutes writing a precise spec. The agent doesn't know it's wrong. It confidently produces code that solves the wrong problem, then confidently iterates to solve more of the wrong problem.

This is the pattern I see most often in failed full-loop runs: the agent spends 80% of its tokens correcting itself, and the final output is a patched version of what a human would have written correctly the first time.

## When Loops Actually Work

Loops aren't universally bad. They work when the goal is precise and verifiable within a few turns:

**Well-specified boilerplate.** Generate a CRUD endpoint, a migration script, a test scaffold. The agent knows the pattern. Success is unambiguous — tests pass or they don't.

**Bounded bug hunts.** "Find why test X fails." The bug is pinned by a failing test. The search space is constrained. The agent either finds it or hits a dead end.

**Known playbooks.** Tasks the model has seen hundreds of times. The template and error modes are well-understood. The loop is just pattern-matching with extra steps.

In all these cases, the key is that the agent isn't figuring out *what* to build. It's building what was specified. The loop is execution, not exploration.

## The Turn-Control Sweet Spot

Recent research on SWE-bench found a practical answer to "how many turns should a loop run":

- **Fixed-turn limits** at the 75th percentile of baseline usage reduce costs by 24-68% with minimal impact on solve rates
- **Dynamic allocation** (granting extensions on-demand) beats fixed limits by an additional 12-24% while maintaining comparable solve rates

The insight is simple: most tasks don't need as many turns as the agent wants to take. A hard budget forces the agent to be efficient. Without one, it chases perfection that nobody asked for.

The practical implementation: cap iterations, cap tokens, cap runtime. Set a budget and stick to it. A loop that can't stop is the expensive bug.

## The Harness Matters More Than the Loop

The ReAct loop itself is small — thought, action, observation, repeat. What makes or breaks it is the harness around it:

**Context management.** Compaction (summarizing old turns to save space) triggers at 80-95% of the context window. Tool result clearing — replacing old outputs with summaries — is the safest, lightest touch. Sub-agents spin up with fresh context and return condensed summaries of 1,000-2,000 tokens from 10,000+ tokens of internal work.

**Tool definitions.** Every available tool gets serialized into context for every call, whether the model uses it or not. One team reduced tool-definition overhead from 134K to 8,700 tokens — an 85% reduction — by switching from always-on to dynamic loading. Another analysis found Playwright MCP dumps 21 tool definitions at ~13.7K tokens before you even start working.

**Retry logic.** Failed tool calls don't disappear from context. A 10% failure rate per step, compounded across 10 steps, silently multiplies costs. Adding clear terminal states (SUCCESS/FAILED) to tool responses reduced per-task tool calls from 14 to 2 in one case.

**Observation filtering.** Full HTML snapshots of web pages burn tens of thousands of tokens. Parsing the accessibility tree instead gives the model roughly the same information at a fraction of the cost.

## Human-in-the-Loop Still Wins for Most Work

The uncomfortable conclusion from months of running both approaches: human-in-the-loop is more cost-effective for most everyday engineering work.

The human-in-the-loop workflow has three advantages:
1. **Bounded scope.** Each agent call has a single, clear objective.
2. **Early rejection.** Wrong approaches get caught at plan or diff review, not after the agent has already written and tested them.
3. **Stopping precision.** The human can accept a 70% solution that ships versus the 95% solution that costs 3x more tokens.

The human absorbs the ambiguity tax. They decompose vague goals into precise sub-tasks, reject wrong turns early, and approve "good enough" instead of letting the agent chase perfection.

## The 100x Parallel Agent Myth

Some tools advertise spinning up dozens or hundreds of agents in parallel. The technical feasibility is real — fork N processes, each with its own context window. The practical ROI is not.

Most engineering tasks are sequential by nature: understand, design, implement, test, fix. Spinning 100 agents to implement the same feature doesn't make the implementation 100x better. It makes it 100x more expensive. And then you need to reconcile N divergent outputs — a problem nobody has solved well.

The right number of parallel agents is a low single digit. Scale the fleet to your review rate, not the tool's lane count.

## What I Do Now

My current approach: human-in-the-loop for most work, with tight loops for well-specified tasks.

1. Scope the task precisely before invoking the agent
2. Set a hard turn budget (usually 5-10 turns)
3. Review at each step, not just at the end
4. Accept "good enough" and move on
5. Save full autonomy for boilerplate and bounded bug hunts

The loop is a tool. Like any tool, its effectiveness depends on knowing when to use it and when to put it down.

## References

- Yao et al. 2023 — "ReAct: Synergizing Reasoning and Acting in Language Models" (https://react-lm.github.io/)
- Gao & Peng 2025 — "More with Less: An Empirical Study of Turn-Control Strategies for Efficient Coding Agents" (https://arxiv.org/abs/2510.16786)
- Pan 2026 — "The Token Economy of Multi-Turn Tool Use" (https://tianpan.co/blog/2026-04-20-token-economy-multi-turn-tool-use-agent-cost)
- Anthropic 2025 — "Effective Context Engineering for AI Agents" (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Kinney 2026 — "The Anatomy of an Agent Loop" (https://stevekinney.com/writing/agent-loops)
- Delaney 2026 — "Inside the ReAct loop: how agents actually iterate" (https://mickdelaney.com/posts/inside-the-react-loop/)
- LOOP SKILL ENGINE 2026 — "Good to Go: 99% Success and 99% Token Reduction via One-Shot Recording" (https://arxiv.org/abs/2605.14237)
- awesome-loop-engineering — Token economics documentation (https://github.com/invincible04/awesome-loop-engineering)
