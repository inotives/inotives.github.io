var e=`---
title: "AI Terminology Catch-Up Sheet: What Changed From Late 2025 to Mid-2026"
date: 2026-05-06
tags: [ai-terminology, agentic-engineering, context-engineering, mcp, skills, plan-mode, ai-agents, llm-economics]
summary: "A practitioner-friendly catch-up sheet for the AI terms that started to matter between November 2025 and May 2026: agentic engineering, context engineering, Code Mode, Plan Mode, skills, MCP security, reasoning budgets, and the new cost discipline around tokens."
---

## The Vocabulary Shift Is the Signal

If you stepped away from AI tooling for six months, the models are not the only thing that changed. The vocabulary changed too.

That matters because terminology is where the working model leaks out. When practitioners stop saying "prompt engineering" and start saying **context engineering**, they are not just swapping labels. They are admitting that the hard part is no longer writing a clever instruction. The hard part is assembling the right memory, tools, examples, files, state, constraints, and verifiers so the model can actually solve the task.

The same thing happened with **vibe coding**. It had a short, loud life as the phrase for natural-language software creation. By mid-2026, the serious version has a different name: **agentic engineering**. The professional version is not "ask the model and ship whatever comes back." It is designing tasks, supervising agents, reviewing diffs, measuring cost, hardening tool access, and staying responsible for correctness.

Here is the catch-up sheet I would give a senior engineer who has been busy shipping normal software and now needs to re-enter the AI conversation without sounding six months behind.

## Agentic Engineering Replaced Vibe Coding

The biggest terminology change is the retirement of vibe coding as a serious production frame.

**Vibe coding** still describes something real: describe what you want, let the model generate code, keep prompting until the thing appears to work. That is fine for prototypes, personal scripts, and low-stakes experiments.

But the professional discipline is now better described as **agentic engineering**. The distinction is accountability.

An agentic engineer does not outsource understanding. They use agents to increase throughput while keeping the human responsibilities: architecture, specification, tests, security, code review, deployment discipline, and taste. The unit of work moves from "write this function" to "implement this slice," but the ownership does not disappear.

The practical marker is simple: if another person or team depends on the thing, you are not vibe coding anymore. You are operating a fallible automation system.

## Context Engineering Is the New Prompt Engineering

**Prompt engineering** made sense when the interface was mostly a single chat box.

Agentic systems are different. They do not run on prompts alone. They run on context: repo instructions, tool schemas, files, examples, logs, memory, plans, diffs, evals, previous decisions, and compressed summaries.

That is why **context engineering** has become the more useful term. It means filling the context window with the information required for the next step to be plausibly solvable, while excluding everything that wastes attention or tokens.

The shift is subtle but important:

| Old frame | New frame |
|---|---|
| Write a better prompt | Assemble a better working set |
| Optimize wording | Optimize context allocation |
| One-shot instruction | Multi-step state management |
| Clever phrasing | Files, tools, memory, examples, tests |
| Prompt library | Skill library and workflow system |

Once you think this way, context becomes a budget. Every tool definition, file dump, chat message, and log line spends tokens. The question is not "can the model fit this?" The question is "is this the highest-value thing to keep in working memory right now?"

## The Context Window Is the Program

Karpathy's **Software 3.0** framing is useful because it makes the context window feel less magical.

Software 1.0: humans write code.

Software 2.0: humans train weights.

Software 3.0: humans assemble context, and the model interprets it.

You can argue with the boundaries, but the mental model is productive. In agentic software, the "program" is not only the source code. It is also the prompt, the tool surface, the files loaded into context, the permissions, the examples, the scratchpad, and the verifier.

This is why messy agent sessions degrade. You would not expect a program with stale state, duplicated dependencies, unclear globals, and half-overwritten configuration to behave cleanly. A context window with those same properties has the same failure mode.

## Code Mode Is the Post-MCP Correction

MCP went from new protocol to default integration layer very quickly. It solved a real problem: tools needed a standard way to expose capabilities to agents.

Then people ran into the tax.

Naive MCP exposes every tool name, description, and schema up front. That means the model pays the token cost before it has done any useful work. A big MCP server can burn tens of thousands of tokens just telling the agent what tools exist.

The correction is **Code Mode** or **code execution with MCP**. Instead of exposing hundreds of tool definitions directly, the agent gets a tiny surface such as \`search()\` and \`execute()\`, plus file-backed documentation or generated code bindings it can inspect on demand.

The direction is clear: agents should not carry the whole API catalog in short-term memory. They should discover what they need when they need it.

This is one of the most practical architecture lessons from the last six months:

**Naive MCP is convenient. Lazy-loaded tool access is scalable.**

## Skills Became the Unit of Reusable Agent Work

The term **skills** now means something specific in agent tooling: a directory with a \`SKILL.md\`, frontmatter, instructions, and optional supporting files.

The important design pattern is **progressive disclosure**:

1. The agent sees only the skill name and description by default.
2. The full skill instructions load only when the skill is relevant.
3. Supporting files load only when needed.

That pattern is the same cost discipline as Code Mode, applied to behavior instead of tools.

A good skill is not a long prompt pasted into every session. It is a small capability package with instructions, examples, scripts, templates, and constraints that can be loaded just in time.

This is why "skill author" is becoming a real role. Someone has to turn scattered workflow knowledge into durable, reusable agent behavior.

## Plan Mode Is a Safety Pattern, Not a UX Feature

**Plan Mode** sounds like a product feature. It is more important than that.

The core idea is read-only exploration before execution. The agent inspects the codebase, writes a plan, and waits for approval before editing files or running commands.

That pattern matters because agentic systems fail fastest when discovery and mutation are mixed too early. A model that has not understood the project yet should not be rewriting it.

For serious coding work, the rough workflow is:

1. Explore without changing state.
2. Produce a concrete plan.
3. Approve or revise the plan.
4. Execute in small phases.
5. Verify each phase.

This is not bureaucracy. It is how you keep a fast, fallible agent from turning uncertainty into filesystem churn.

## The New Security Phrase Is Lethal Trifecta

If you remember one AI security term, make it **lethal trifecta**.

An agent becomes structurally exploitable when three conditions are present together:

1. It can access private data.
2. It can read untrusted content.
3. It can communicate externally.

That combination shows up constantly. A coding agent can read secrets, inspect GitHub issues, and call network tools. A workplace agent can read email, summarize shared documents, and send messages. A research agent can read private notes, browse the web, and write reports to external services.

The phrase is useful because it turns a vague prompt-injection fear into an architecture review checklist. If all three legs are present, you need containment: permission gates, data scoping, egress controls, tool pinning, audit logs, and human review for sensitive actions.

MCP adds its own security vocabulary too:

**Rug-pull attacks**: a tool changes behavior or description after approval.

**Tool poisoning**: one tool's description manipulates the agent's behavior around another tool.

**Tool shadowing**: a malicious tool interferes with trusted tools in the same environment.

The practical takeaway: tool descriptions are untrusted input. Treat them that way.

## Reasoning Models Need Budget Discipline

Reasoning models changed the cost and latency profile of AI calls.

The old question was "which model should I call?" The new question is often "how much thinking should this model be allowed to spend?"

That is where terms like **thinking budget**, **reasoning effort**, and **reasoning tokens** come in. They describe explicit or implicit controls over how much internal reasoning a model performs before returning an answer.

This is not just a vendor API detail. It changes application design.

You do not want high-effort reasoning on every call. Classification, formatting, extraction, routing, boilerplate generation, and simple code edits usually do not need frontier-level deliberation. Complex planning, bug diagnosis, architecture review, and security-sensitive work often do.

The operating pattern becomes:

**cheap and fast by default, expensive and thoughtful by exception.**

## Verifiability Explains Where Agents Improve Fastest

The **verifiability principle** is one of the cleaner ways to predict where AI systems will become useful.

Traditional software automates what you can specify. LLMs automate what you can verify.

That is why code, tests, math, browser tasks, structured extraction, and formal checks improve quickly. There is a feedback signal. The system can try, run, inspect, and correct.

It also explains why taste, strategy, interpersonal judgment, and ambiguous product calls remain difficult. The model can generate plausible answers, but the verifier is weak or human-only.

For engineering teams, this should shape where you apply agents first. Start with workflows that have cheap verification:

- tests
- linters
- type checks
- SQL result checks
- screenshots
- schema validation
- diff review
- benchmark comparisons

If you cannot verify the output, the agent may still help, but you should treat it as assistance, not automation.

## Multi-Agent Systems Now Have a Failure Taxonomy

Multi-agent work used to be described with hand-wavy diagrams: planner, researcher, coder, reviewer, critic.

The more useful term to know now is **MAST**, the Multi-Agent Failure Taxonomy. The important part is not the acronym itself. The important part is that multi-agent systems fail in recognizable categories:

- bad system design
- inter-agent misalignment
- weak task verification

That sounds obvious until you debug one. Many multi-agent systems do not fail because the model is dumb. They fail because agents have overlapping responsibilities, incompatible assumptions, missing shared state, unclear handoff contracts, or no reliable verifier.

If you are adding sub-agents, ask:

- What is each agent uniquely responsible for?
- What state crosses the boundary?
- What is the handoff artifact?
- Who verifies the output?
- What happens when agents disagree?

Without those answers, "multi-agent" often means "more places for ambiguity to hide."

## The Economics Vocabulary Matters Now

By mid-2026, AI engineering is cost engineering.

The terms to know:

**Token tax**: fixed context consumed by tool definitions, instructions, history, and scaffolding before useful work begins.

**Prompt caching**: provider-side discounting for repeated context prefixes.

**Allocation engineering**: treating context tokens like memory allocation.

**Frontier-plans, cheap-executes**: use the strongest model for planning and review, then route routine execution to cheaper models or local inference.

**Tier 1-2 sweet spot**: the practical observation that most teams need a frontier tier and a cheap tier, not a dozen finely sliced model tiers.

The cost lesson is the same as the architecture lesson: do not route everything through the most expensive path. Use frontier models where judgment matters. Use smaller models, local models, batch APIs, cached prefixes, and deterministic code everywhere else.

## Terms That Are Fading

Some terms are not gone, but they are losing precision.

**Prompt engineer**: still a skill, less often a standalone role. The work got absorbed into AI engineering, context engineering, and skill authoring.

**Operator**: increasingly deprecated as a product label. The current language is more often ChatGPT agent, Codex, browser agent, or agent mode.

**Open source model**: often used sloppily when people mean **open-weight model**. If the weights are downloadable but the training data and pipeline are not reproducible, call it open-weight.

**Vibe coding**: still useful for casual prototypes, weak for professional practice.

When a term fades, it usually means the field learned to distinguish cases that used to be blurry.

## The Short List

If you only update ten terms, update these:

| Term | Why it matters |
|---|---|
| Agentic engineering | Professional successor to vibe coding |
| Context engineering | Successor frame to prompt engineering |
| Code Mode | Scalable alternative to naive MCP tool exposure |
| Skills | Reusable unit of agent behavior |
| Progressive disclosure | Load capability only when needed |
| Plan Mode | Read-only exploration before execution |
| Lethal trifecta | Core agent security checklist |
| Reasoning effort | Cost and quality knob for thinking models |
| Verifiability | Predicts where agents work reliably |
| Token tax | Hidden cost of agent architecture |

## The Bottom Line

The AI vocabulary of mid-2026 is more operational than the vocabulary of 2025.

The hot terms are no longer just about model capability. They are about supervision, context, tool loading, verification, safety, cost, and production ownership.

That is the real story. The field is growing out of the "look what the model can do" phase and into the "how do we operate this without losing correctness, money, or control" phase.

Learn the new terms, but do not stop at sounding current. Each one points to a concrete engineering behavior: budget context, lazy-load tools, plan before editing, verify outputs, constrain egress, route by cost, and keep the human responsible for the system.
`;export{e as default};