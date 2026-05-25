---
title: "Graphify for Agentic Knowledge Work"
date: 2026-05-20
tags: [graphify, ai-agents, knowledge-graph, mcp, workflow, developer-tools]
summary: "Evaluating Graphify as a tool for AI-assisted development: how its mixed-content knowledge graph compares with structural code tools, what it excels at, its rough edges, and where it fits in an agentic workflow."
---

## Graphify for Agentic Knowledge Work

Graphify has been getting attention in the AI-assisted development space, and for good reason. It turns any folder of files into a knowledge graph that AI agents can query instead of grepping or reading files linearly.

The pitch is straightforward: type `/graphify .` in your AI assistant and get three outputs — an interactive HTML graph, a `GRAPH_REPORT.md` with key findings, and a `graph.json` for programmatic access. Underneath, it uses tree-sitter for code extraction (local, no API calls) and an LLM backend for semantic extraction from docs, PDFs, images, and videos.

I spent some time evaluating it for my own workflow. Here is the honest take.

## What Graphify Is

Graphify is a knowledge graph generator and query tool. It indexes mixed-content corpora — code, documentation, research papers, images, videos — into a single graph with community detection, confidence-tagged relationships, and MCP-native querying.

```text
source files
  -> tree-sitter AST extraction (code)
  -> LLM semantic extraction (docs, images, PDFs, video)
  -> entity resolution + dedup
  -> Leiden community detection
  -> graph.json + graph.html + GRAPH_REPORT.md
  -> MCP server for agent access
```

The critical design choice is the **mixed-content** approach. CodeGraph (which I reviewed separately) indexes only code via AST parsing. Graphify indexes everything — code, prose, images, video transcripts — into one unified graph. That makes it a fundamentally different tool for a different class of problem.

## The Outputs

Graphify produces three files in `graphify-out/`:

| Output | What it is |
|---|---|
| `graph.html` | Interactive browser visualization — click nodes, filter, search |
| `GRAPH_REPORT.md` | Plain-language summary: god nodes, surprising connections, suggested questions |
| `graph.json` | Full graph data — queryable by agents without re-reading source files |

The `GRAPH_REPORT.md` is the most immediately useful. It lists the most-connected concepts ("god nodes"), unexpected cross-module links, and suggests questions the graph is uniquely positioned to answer. Every relationship comes with a confidence tag: `EXTRACTED` (found directly in source), `INFERRED` (deduced by the LLM), or `AMBIGUOUS` (uncertain linkage). That audit trail matters when you are deciding whether to trust a connection.

## What It Handles

Graphify covers 31 programming languages (tree-sitter AST, local), markdown, PDFs, images, video/audio (via faster-whisper), Office documents, YouTube URLs, and even Google Workspace files. The breadth is genuinely impressive.

Code extraction is entirely local — nothing leaves your machine. Docs, images, and PDFs go through whatever LLM your IDE session uses, or a configured backend for headless extraction (Claude, Gemini, OpenAI, Ollama, Bedrock, etc.).

## The Good

**Mixed-content graphs are genuinely useful.** When you have a project with code, design docs, research notes, and meeting transcripts, Graphify connects them in ways a code-only tool cannot. It surfaces links like "this function implements the algorithm described in this paper" or "this design doc constraint maps to this validation check." Those are not things tree-sitter can see.

**Community detection surfaces blind spots.** The Leiden clustering groups related concepts across file boundaries. In my testing, it caught connections between a utility function in one module and a configuration default in another that I had not explicitly connected. These "surprising connections" are the most valuable output for a developer who has been in the codebase too long to see its implicit structure.

**Confidence tags are honest.** The `EXTRACTED` / `INFERRED` / `AMBIGUOUS` labels on every edge mean you know what was found in the source versus guessed by the model. That matters when you are debugging a broken inference.

**The MCP server is well-designed.** `graphify query`, `graphify path`, and `graphify explain` are clean primitives for agent access. The MCP mode (`graphify.serve`) exposes structured tools — `query_graph`, `get_node`, `get_neighbors`, `shortest_path` — so agents can query the graph in a loop without reparsing text output.

**Platform coverage is serious.** Claude Code, Codex, OpenCode, Cursor, Gemini CLI, Copilot CLI, VS Code Copilot Chat, Aider, Cline, Trae, and more. The install commands are documented per-platform with project-scoped and user-scoped variants.

**Team workflow is considered.** The `graphify-out/` directory is meant to be committed to git. The `graphify hook install` command sets up a post-commit hook that auto-rebuilds the AST portion (free, no API cost) and a git merge driver for conflict-free `graph.json` merges.

## The Not-So-Good

**Semantic extraction is noisy relative to AST extraction.** When Graphify uses an LLM to extract relationships from docs or images, the output quality depends on the model and prompt. I have seen it invent relationships that were plausible but incorrect. The `INFERRED` tag helps, but in practice you still need to verify before acting on those edges.

**The HTML visualization is hard to navigate past ~500 nodes.** The interactive graph works well for small projects but becomes a dense hairball for anything above a few hundred files. The README acknowledges this (>5000 nodes is too large for a browser), but even 500–1000 nodes in a single view is hard to read. You end up relying on the text report and JSON queries instead — which is fine, but it makes the HTML output less useful than it looks in the demo.

**Installation friction with PATH.** If you use plain `pip install graphifyy`, the `graphify` CLI often lands in a directory not on your PATH (`~/Library/Python/3.x/bin` on macOS, `~/.local/bin` on Linux). The README documents this, but it is still a common complaint. Using `uv tool install graphifyy` or `pipx` solves it cleanly — just not everyone reads that far.

**Extraction latency on first run.** Building the full graph (AST + semantic) on a medium-sized project takes time. Code extraction is fast (tree-sitter is quick), but the LLM pass for docs, images, and PDFs adds minutes depending on corpus size and backend latency. Incremental `--update` helps after the first build, but the initial run is slow.

**The "graphify query" LLM call for every question means per-query cost.** Each natural-language `graphify query` call goes through an LLM (via your IDE session or configured backend). If you ask many small questions in a loop, the cost adds up. The MCP server avoids this for structured queries (like shortest-path or neighbor lookup), but the most useful query type — "explain how X connects to Y" — still requires an LLM call.

## Graphify Versus CodeGraph

These tools are frequently compared, so the distinction is worth making concrete.

| Question | Better Tool |
|---|---|
| Where is this React component defined? | CodeGraph |
| What calls this function? | CodeGraph |
| What symbols are affected if this renderer changes? | CodeGraph |
| How does this code relate to this design doc? | Graphify |
| What concepts are central across notes, code, and research? | Graphify |
| Trace the path from auth module to database in code only? | CodeGraph |
| Trace the path from a business requirement to its implementation? | Graphify |

CodeGraph is deterministic and cheap per query. It answers structural code questions with no LLM cost and no ambiguity. Graphify is richer but noisier and more expensive. It answers cross-domain questions that CodeGraph cannot, but the answers require verification.

The practical split in my workflow:

- **CodeGraph** for live coding sessions — route resolution, symbol navigation, impact analysis
- **Graphify** for project onboarding, knowledge auditing, cross-domain traces, and periodic graph builds
- **Both** when I need structural code context AND semantic context from docs

## When Graphify Helped Most

The strongest use cases from my testing:

- **Onboarding a new codebase.** Running `/graphify .` on an unfamiliar project gives you a map of the central concepts in a few minutes. The god node ranking tells you which modules matter most.
- **Connecting docs to code.** When a project has architecture decision records or design documents alongside source code, Graphify surfaces which code implements which design decisions. That is hard to do manually.
- **Finding the "forgotten" dependencies.** The community detection flagged a test utility that was implicitly relied upon by five modules but only explicitly imported by two. That kind of implicit coupling is easy to miss with grep.
- **Mixed-memory workspaces.** For my agent-memory directory — which is mostly markdown rules, templates, drafts, and session notes — Graphify is the better fit because CodeGraph indexes almost nothing useful from prose.

## When It Struggled

- **Large monorepos with 1000+ files.** The graph becomes dense and the HTML view is unusable. You rely on `graphify query` and `graphify path` for every exploration, which works but loses the serendipity of browsing.
- **Ambiguous entity resolution.** When two different concepts share a name (e.g., a `Config` class and a `config` module), the graph sometimes merges them incorrectly. The `--dedup-llm` flag helps but adds another LLM call.
- **Trivial code-only questions.** If you just need to find what calls a function, Graphify works but is slower and more expensive than a deterministic code graph like CodeGraph.

## The Workflow I Recommend

Based on my experience, the best pattern is hybrid:

1. Use **CodeGraph** first for structural code questions during live editing.
2. Use **Graphify** for project-wide knowledge queries, onboarding, and cross-domain traces.
3. Commit `graphify-out/` to the repository so every team member starts with a map.
4. Run `graphify hook install` for automatic AST-only rebuilds on commit.
5. Run a periodic full rebuild (including semantic extraction) when docs or major features change.

For this site specifically:

- CodeGraph handles the React app structure — routes, page components, markdown rendering paths, content utilities.
- Graphify would handle the less-structured parts: research notes, design docs, session logs, and cross-references between the site content and the code that renders it.

## Practical Verdict

Graphify is a genuinely useful tool for agentic development, but it solves a different problem than I initially assumed. It is not a faster grep or a code graph — it is a mixed-content knowledge discovery tool.

The strongest argument for it is the **god node ranking** and the **surprising connections** report. Those outputs surface things you did not ask about but should know. That is rare and valuable.

The weakest part is the per-query LLM dependency for semantic questions. If you ask Graphify ten questions about a graph, that is ten LLM calls. For code-only questions, CodeGraph is faster and cheaper.

The tools are complementary, not competing. A well-configured agentic setup has both.

## Sources

- Graphify repository: https://github.com/safishamsi/graphify
- CodeGraph evaluation: /posts/2026-05-25-codegraph-for-agentic-codebase-work
- Graphify Labs: https://graphifylabs.ai
