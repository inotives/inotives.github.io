var e=`---
title: "Stop Chasing Models, Start Building Harnesses"
date: 2026-06-19
tags: [ai-engineering, agentic-ai, harness-engineering, llm-models, agent-agnostic, developer-tools, ai-workflow, loop-engineering]
summary: "New LLMs drop every month — faster, stronger, more capable. But the 2-3% benchmark gains don't matter for professional AI engineers. What matters is the 20% that comes from your harness: your stack, your skills, your workflows. That's agent-agnostic, it's yours, and it compounds."
---

# Stop Chasing Models, Start Building Harnesses

The model race is accelerating. Every month, a new release claims state-of-the-art on benchmarks. Claude, GPT, Gemini, Llama, Qwen — the leaderboard shifts, the token limits expand, the context windows grow.

And none of it matters for your day-to-day work.

Here's why: once models hit a certain capability threshold, a 2-3% improvement on MMLU or HumanEval doesn't change what you can build. The difference between "can write code" and "can write slightly better code" is noise compared to the difference between "has no memory" and "has persistent memory across sessions."

The model is the foundation. But the foundation isn't the building.

---

## The Dimension You Can't Control

Model improvement happens along dimensions you can't control:

- **Pre-training data** — You don't choose what the model learned.
- **Benchmark performance** — You don't design the evaluations.
- **Architecture decisions** — You don't decide the transformer tweaks.
- **Release timing** — You don't ship the model.

As a professional AI engineer, optimizing your workflow around "which model is best this week" is a losing game. You're optimizing for a moving target that someone else controls.

What you *can* control is everything else.

---

## The 80/20 Split

LLMs handle 80% of the work using pre-trained knowledge. They can:

- Write boilerplate code
- Explain concepts
- Generate standard patterns
- Handle well-documented problems
- Follow explicit instructions

The remaining 20% is where your work actually lives. That's:

- **Your harnessing** — How you structure the agent's environment
- **Your skills** — What workflows the agent follows
- **Your memory** — What context persists across sessions
- **Your orchestration** — How agents coordinate and hand off
- **Your domain knowledge** — What your specific project needs

That 20% is the difference between an agent that writes code and an agent that writes *your* code, in *your* style, following *your* conventions, with *your* tests.

---

## The Harness Is the Product

The distinguishing factor for AI engineers isn't which model they use. It's what they build around it.

Consider two engineers using the same model:

**Engineer A**:
- Raw model with no context management
- No memory between sessions
- No structured workflow
- No domain-specific skills
- Every interaction starts from scratch

**Engineer B**:
- Context-mode for 98% token reduction
- strata-memory for persistent cross-session knowledge
- mattpocock/skills for engineering discipline
- codegraph for instant code understanding
- Custom skills for their specific domain

Same model. Completely different outcomes.

Engineer B's agent knows the codebase. It follows TDD. It remembers what worked last time. It doesn't waste tokens re-explaining the project. It has a workflow for debugging, a workflow for planning, a workflow for code review.

The harness *is* the product.

---

## Agent-Agnostic by Design

Harnessing is model-agnostic.

Your custom skills, your memory system, your orchestration pipeline — none of it depends on which model you use. When the next model drops, you don't rebuild your stack. You point it at the same harness.

This is why chasing models is a trap. You're optimizing for the thing that changes fastest while ignoring the thing that compounds.

**Your harness is your moat.** The model is a commodity. Anyone can use Claude or GPT. Not everyone has:

- A skill library that encodes their engineering practices
- A memory system that accumulates project knowledge
- An orchestration pipeline that coordinates multiple agents
- Domain-specific workflows tuned to their stack

That's your competitive advantage. And it's portable across models.

---

## What to Build Instead

Stop watching benchmark leaderboards. Start building:

**1. Skills that encode your practices**
Not generic "write good code" skills. Specific workflows for your domain: how you debug, how you plan, how you review, how you hand off between sessions.

**2. Memory that compounds**
Not chat history. Structured knowledge that grows with every session: what worked, what failed, what the project needs, what the codebase looks like.

**3. Orchestration that coordinates**
Not single-agent loops. Multi-agent pipelines where tasks flow from planning to implementation to review with proper handoffs.

**4. Context management that scales**
Not raw tool output flooding your context window. Sandboxed execution where only results enter the conversation.

These are the dimensions you control. These compound over time. And they work regardless of which model is "best" this month.

---

## The Shift

The industry is moving from "which model" to "which harness." Early AI engineering was about prompt engineering — getting the model to do what you want. Mature AI engineering is about harness engineering — building systems that make the model work for you.

The 2-3% benchmark gains will keep coming. Let someone else chase them. Your edge is in the stack you build, the skills you encode, and the workflows you design.

The model is the foundation. The harness is the building. Build the building.

---

## References

- [mattpocock/skills](https://github.com/mattpocock/skills) — Engineering discipline and workflows for coding agents
- [context-mode](https://github.com/mksglu/context-mode) — MCP server for context window optimization
- [codegraph](https://github.com/colbymchenry/codegraph) — Pre-indexed code knowledge graph
- [Agent-Reach](https://github.com/Panniantong/Agent-Reach) — Multi-platform internet access for AI agents
- [strata-memory](https://github.com/inotives/strata-memory) — Local-first persistent memory for agentic work
- [git-conveyor](https://github.com/inotives/git-conveyor) — Multi-agent task orchestration
- [Loop Engineering: Stop Prompting Agents, Start Building Systems That Prompt Them](https://inotives.github.io/posts/2026-06-12-loop-engineering-patterns) — The loop engineering pattern
- [My Agentic Development Stack](https://inotives.github.io/posts/2026-06-19-my-agentic-development-stack) — The seven-tool stack that implements this philosophy
`;export{e as default};