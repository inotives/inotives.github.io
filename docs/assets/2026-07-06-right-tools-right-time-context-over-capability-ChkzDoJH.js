var e=`---
title: "The Right Tools at the Right Time: Why Context Matters More Than Capability"
date: 2026-07-06
tags: [agentic-stack, ai-agents, context-mode, codegraph, agent-reach, strata-memory, tool-selection, agent-performance]
summary: "Four tools I use daily — context-mode, codegraph, agent-reach, and strata-memory — aren't agent memory. They're infrastructure that controls what information reaches the agent and how efficiently it accesses knowledge. The best agents aren't the ones with the most tools. They're the ones that use the right tool at the right time."
series: building-ai-systems
---

# The Right Tools at the Right Time: Why Context Matters More Than Capability

I use four tools every day in my development workflow: context-mode, codegraph, agent-reach, and strata-memory. People sometimes call them "agent memory." They're not. They're something more important — infrastructure that determines what information reaches the agent and how efficiently it can use that information.

Here's the distinction that matters: memory stores and retrieves facts. These tools control what enters the context window, how fast code can be queried, how internet data gets fetched, and what persists across sessions. They extend the agent's effective memory without being memory stores themselves.

## The Four Tools and What They Actually Do

**Context-mode** is the gatekeeper. Every tool call — a web fetch, a database query, a file read — dumps raw output into the context window. A Playwright snapshot costs 56 KB. Twenty GitHub issues cost 59 KB. After 30 minutes, you've burned 40% of your context on data that didn't need to be there. Context-mode sandboxes tool output and only lets results enter context. A 315 KB web fetch becomes 5.4 KB. That's not a nice-to-have. It's the difference between a 30-minute session and a 3-hour one.

**Codegraph** is the code intelligence layer. Without it, agents spawn explore subagents that scan files with grep and glob — burning tokens on every call. Codegraph gives them a pre-indexed knowledge graph. Ask a question, get the answer in one call: symbol definitions, call paths, relationships. The stats back it up: roughly 47% fewer tokens, 22% faster, 58% fewer tool calls compared to running blind.

**Agent-reach** handles internet access. When the agent needs to research something, browser automation is the wrong tool — it's slow, brittle, and wastes tokens on raw HTML. Agent-reach routes to platform-specific CLIs that already handle auth, parsing, and rate limiting. One command for 13+ platforms: Twitter, Reddit, YouTube, Bilibili, GitHub, LinkedIn, RSS feeds. Multi-backend routing with automatic failover.

**Strata-memory** is the persistent knowledge vault. I built it by combining Andrej Karpathy's wikia structure — cross-linked markdown concept files that agents load verbatim — with Google's Open Knowledge Format (OKF), which formalizes the same pattern as an open standard. Three tiers — draft, knowledge, intelligence. Markdown files are canonical. SQLite is a rebuildable index. When the agent writes something worth keeping, it goes into the vault. Next session, it's there. No re-discovery needed.

## How They Complement Each Other

These four tools don't overlap. They chain.

When I ask the agent to research a problem, agent-reach fetches data from the internet. Context-mode sandboxes the output so only the relevant parts enter the context window — 98% of the noise stays out. Codegraph tells the agent how the problem connects to existing code without reading entire files. Strata-memory stores what was learned for future sessions.

The flow is:

\`\`\`
Task arrives
  → agent-reach fetches external data
  → context-mode filters what enters context
  → codegraph provides code structure on demand
  → strata-memory persists what matters
\`\`\`

Each tool handles one layer of the problem. Together, they make the agent faster, cheaper, and more accurate — not by adding more context, but by adding the right context.

## The Lesson Most People Miss

Here's what I've learned after months of daily use: **the best performing agents aren't the ones with the most tools and skills.** They're the ones that use the right tools and skills at the right time.

This sounds obvious. It isn't.

The temptation is to load up. More MCP servers, more skills, more context providers. "If one tool is good, ten must be better." But every tool adds to the system prompt, eats into the context window, and increases the probability the agent picks the wrong tool for the job.

I've seen agents with 15+ MCP servers and 30 skills installed. They perform worse than an agent with 4 tools that knows when to use each one. The overhead of deciding between 15 similar tools costs more than the value any single one provides.

The principle is simple: **more context does not mean better context.** The correct context is the context that matters for the specific task at hand.

Codegraph is useless when you're debugging a network issue. Agent-reach is useless when you're refactoring local code. Context-mode is the only one that's always relevant — because every other tool's output flows through it.

The skill isn't installing everything. The skill is knowing what to reach for and when.

## What This Looks Like in Practice

A typical session goes like this:

The agent gets a task. First question: what does this task need? If it's a code question, codegraph answers in one call. No grep, no file scanning, no wasted tokens. If it needs external research, agent-reach pulls data from the right platform. Context-mode ensures only relevant data enters the window. If the session produces something worth keeping, strata-memory stores it.

The agent doesn't use all four tools every time. That would be wasteful. It uses the one that fits.

A codebase exploration: codegraph, maybe context-mode for large outputs. A web research task: agent-reach, context-mode. A session handoff: strata-memory. A debugging session: codegraph for structure, context-mode for tool output management.

The point isn't the tools. The point is the selection process. Every unnecessary tool call is a token spent on noise. Every token spent on noise is a token not available for thinking.

## The Infrastructure vs. Memory Distinction

I keep coming back to this because it shapes how you design the stack.

Memory stores and retrieves information. It needs scoring, decay, consolidation. Memory infrastructure controls what information reaches the agent or how it accesses knowledge. It needs filtering, indexing, access control.

Context-mode doesn't store anything. It's a context window manager — like a bouncer deciding who gets into the club. Codegraph doesn't learn from agent interactions. It's a reference book you consult, not knowledge you "remember." Agent-reach doesn't cache permanently. It fetches, parses, returns.

When you design around this distinction, you make better decisions about what tools to build, what tools to use, and how to combine them. The failure modes are different too: memory failures produce stale facts. Memory infrastructure failures produce wrong information admitted or good information blocked.

## The Bottom Line

Four tools. Each handles one layer. They chain together to form a workflow where the agent gets exactly what it needs, exactly when it needs it.

The best agent setup isn't the biggest one. It's the one where every tool earns its place — and the agent knows which one to pick.

## References

- [context-mode](https://github.com/mksglu/context-mode) — MCP server for context window optimization (98% reduction)
- [codegraph](https://github.com/colbymchenry/codegraph) — Pre-indexed code knowledge graph for AI agents
- [Agent-Reach](https://github.com/Panniantong/Agent-Reach) — AI agent capability layer for multi-platform internet access
- [strata-memory](https://github.com/inotives/strata-memory) — Local-first 3-tier persistent memory for agentic work
- [OKF: Open Knowledge Format](https://inotives.github.io/posts/2026-06-23-okf-open-knowledge-format) — Google's markdown-based standard for agent-readable knowledge
- [Karpathy's LLM-wiki pattern](https://x.com/karpathy/status/1913611129773903173) — The wikia structure that inspired strata-memory
- [My Agentic Development Stack](https://inotives.github.io/posts/2026-06-19-my-agentic-development-stack) — Overview of the full seven-tool stack
- [Context Degradation in AI Coding Sessions](https://inotives.github.io/posts/2026-05-23-context-degradation-in-coding-sessions) — Background on context management challenges
`;export{e as default};