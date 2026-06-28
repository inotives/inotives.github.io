---
title: "Context Bloat: How Skills, Tools, and MCP Servers Eat Your Agent's Working Memory"
date: 2026-06-27
tags: [context-bloat, mcp, skills, agent-efficiency, token-optimization, ai-engineering]
summary: "Every installed skill, MCP server, and tool definition adds tokens to your system prompt at session start. After months of agent usage, this overhead consumes 10-30% of context before any real work begins. Real-world measurements show three MCP servers burning 72% of a 200K context window. Solutions exist but require architectural changes."
---

# Context Bloat: How Skills, Tools, and MCP Servers Eat Your Agent's Working Memory

The problem is invisible until it is not. You install a few MCP servers, add some skills, connect a tool or two. Each one seems small. A hundred tokens here, two hundred there. Then one day you notice your agent is sluggish, forgetting context earlier than usual, or hitting token limits mid-conversation. You check the system prompt and discover that 30% of your context window is gone before you type a single word.

This is context bloat. It compounds because every tool's description, parameter schema, and example gets loaded unconditionally at session start, regardless of whether you will use it.

## The Numbers Are Worse Than You Think

Stephanie Goodman at AgentPMT measured this in February 2026. A three-server MCP setup (GitHub, Playwright, IDE integration) consumed 143,000 of 200,000 tokens on tool schema alone. That is 72% of the context window gone before the agent reads the first user message.

The breakdown:
- GitHub MCP (35 tools): ~26,000 tokens (13% of 200K)
- Slack MCP (11 tools): ~21,000 tokens (10.5% of 200K)
- GitHub + Playwright + IDE combined: ~143,000 tokens (72% of 200K)

A separate measurement from a five-server moderate config: 55,000 tokens consumed (27.5%). A ten-server power user setup: 75,000 tokens (37.5%). Cloudflare's full native MCP setup without code mode: 1.17 million tokens, exceeding any standard context window.

On OpenCode, a user reported that seven MCP servers consumed 67,000+ tokens before any user interaction. A single Docker MCP server with 135 tools consumed 125,000 tokens. A typical four-server setup burned 51,000 tokens, which was 46.9% of the context window.

Claude Code version 2.1.111 introduced a regression that pushed session startup context from 8% to 22%. The hard floor from Anthropic-controlled code (system prompt plus system tools) was 14,000 tokens or 7%. User-side mitigation like removing MCPs, plugins, or trimming CLAUDE.md could not get below that floor.

## Where the Tokens Go

Every session, these get loaded into the system prompt:

| Source | Typical token cost | Why it adds up |
|---|---|---|
| Skill instructions | 200-800 per skill | Full instructions and examples loaded for every skill, even unrelated ones |
| Skill descriptions | 50-150 per skill | Each skill's description field read by the model to decide relevance |
| MCP server definitions | 100-500 per server | Tool names, descriptions, parameter schemas, required credentials |
| Tool schemas | 50-300 per tool | Parameter types, descriptions, examples, return types |
| System prompt base | 500-2000 | Core instructions, safety rules, response format |

After 10 skills, 5 MCP servers with 3-5 tools each, and a base system prompt: 5,000-15,000 tokens before the user types anything. On a 100K context model, that is 5-15%. On a 32K or 16K model, it is 15-30% or more.

## Real-World Pain Points

**The subagent problem.** OpenCode users spawning parallel subagents reported that each subagent loads all MCP tool schemas on every run, even when the subagent only needs two or three tools. A user with nine connected MCP servers saved 21,000 tokens per prompt by switching to lazy loading. For workflows spawning five parallel subagents, that is 105,000 tokens saved per round.

**The per-turn tax.** MCP tool definitions are included in the system prompt on every API call, not just at startup. A session making 30 tool calls spends 4,500-15,000 tokens purely on overhead. At Opus 4.6 rates, 15,000 tokens of overhead costs roughly $0.23 per session in waste. A Claude Code user measured a single trivial exchange ("5 x 3?" to "15") adding 13,600 tokens of context because the system context was re-injected each turn.

**The tool selection cliff.** Output quality degrades past 50 loaded tools. Cursor caps at 40 by design. The OpenAI Tools API maxes at 128. Past 120 tools, quality collapses. Every major platform vendor has independently arrived at the same range. This is not a configuration mistake. It is an architectural signal.

**The local model impact.** Users running local or smaller models via Ollama benefit most from reducing initial context. A 7K-token search index replacing 51K of tool definitions makes the difference between a local model being usable or not.

## What Actually Works

**Lazy loading.** Instead of loading all tools at session start, load them on demand. Anthropic's Tool Search subagent (GA February 2026) preserves 85% of context versus conventional loading. OpenCode's `mcp_lazy` experimental flag replaces all MCP tool schemas with a single search tool (~620 tokens), then dynamically fetches tool definitions only when needed.

Measured results from the OpenCode implementation:
- MCP tool token consumption: 39.8K to ~5K (85% reduction)
- Available context: 92K to 195K (112% increase)
- Tool selection accuracy on Opus 4: 49% to 74% (51% increase)

**Allow-listing.** In your MCP configuration, specify only the tools you actually need. A GitHub MCP server exposes 35 tools. If you only need `create_issue` and `list_pull_requests`, filter to those two. Cuts schema cost roughly 80% for known-narrow workloads.

**Profile-based loading.** Define session profiles that load only relevant tools:
- Coding session: code tools, git MCP, linter. Skip web research, social media, design.
- Research session: web search, browser MCP, summarizer. Skip deployment, CI/CD.
- Review session: diff viewer, linter, test runner. Skip code generation tools.

**Built-in over MCP.** Prefer built-in tools when possible. Read (150 tokens) over Bash cat (245 tokens). Glob (120 tokens) over Bash find (245 tokens). Combine grep patterns into one call. Each substitution saves 50-100 tokens per use, which compounds over a session.

**Pruning.** The most effective single action. Review every skill, MCP server, and tool definition. Have you used it in the last 30 days? Archive it. Is it a duplicate? Remove it. Does it serve a niche case you might need later? Move to an opt-in profile.

## The Architecture Problem

The fundamental issue is that tool loading is global and eager. Every tool gets loaded for every session, regardless of what the session is about. This made sense when agents had five tools. It does not scale to fifty or a hundred.

Cloudflare's Code Mode compressed 1.17 million tokens of native MCP definitions down to roughly 1,000 by exposing tools through a code-execution surface instead of a schema list. That is an order-of-magnitude reduction. The direction is clear: tool loading needs to become demand-driven, not session-global.

The MCP protocol itself could help. If MCP servers exposed lightweight schemas (names only) on request, then full schemas on first use, the startup cost drops dramatically. Some proxies already do this. The smart-mcp-proxy project sits between client and MCP servers, does BM25 search over tool descriptions per query, and only returns relevant tools. One user reported 97% reduction in tool schema tokens.

## Practical Checklist

1. Measure your current bloat. Start a session with a trivial prompt, note token usage from the API response. That is your floor.
2. Audit your inventory. List every skill, MCP server, and tool. Estimate token cost. Find the heaviest contributors.
3. Prune aggressively. Archive unused tools. Remove duplicates. Move niche tools to opt-in profiles.
4. Enable lazy loading if your tool supports it. Claude Code, OpenCode, and several MCP proxies offer this.
5. Prefer built-in tools over MCP equivalents when possible.
6. Set a token budget. If system overhead exceeds 5K tokens, require justification for new additions.
7. Re-measure after changes. Track initial prompt token count over time. Treat it like a performance budget.

---

## References

1. OpenCode Issue #9350 -- "MCP Tool Search - Lazy Loading for 85% Token Reduction" (Jan 2026): https://github.com/anomalyco/opencode/issues/9350
2. Claude Code Issue #49593 -- "2.1.111 introduced ~14% context window bloat at session startup" (Apr 2026): https://github.com/anthropics/claude-code/issues/49593
3. Claude Code Guides -- "Claude Code tool call overhead" (Apr 2026): https://claudecodeguides.com/claude-code-tool-call-overhead-tokens-per-mcp-call/
4. GetUnblocked -- "MCP Tool Overload: A Measured Guide to Context-Window Bloat" (May 2026): https://getunblocked.com/blog/mcp-tool-overload/
5. OpenCode Issue #8625 -- "Add mcp search tool, reduce mcp tool occupying a lot of context" (Jan 2026): https://github.com/anomalyco/opencode/issues/8625
