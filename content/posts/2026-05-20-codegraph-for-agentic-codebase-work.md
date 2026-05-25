---
title: "CodeGraph for Agentic Codebase Work"
date: 2026-05-20
tags: [codegraph, ai-agents, mcp, workflow, developer-tools]
summary: "How CodeGraph fits into an AI-assisted development workflow: fast structural code context, MCP-native querying, and where it complements rather than replaces mixed-content knowledge graphs."
---

## CodeGraph for Agentic Codebase Work

CodeGraph has become one of the default tools in my AI-assisted development workflow. The main reason is simple: when an agent needs to understand a codebase, most of the hard questions are structural, not textual.

Instead of asking "which files contain this word?", the agent usually needs answers like:

- Where is this page component defined?
- Which route renders this screen?
- What helper loads this content?
- What code will be affected if this renderer changes?
- Which symbols are connected to this feature?

CodeGraph answers those questions by building a deterministic symbol graph from the codebase. It uses tree-sitter parsing, stores the graph locally, and exposes MCP tools that AI agents can call directly during coding sessions.

For this site, that means the agent can ask CodeGraph for the shape of the React app before editing files. It can find routes, page components, markdown rendering paths, content utilities, and related symbols without doing a broad grep-and-read loop first.

## What CodeGraph Is

CodeGraph is a code-intelligence MCP server. It indexes source code into a local graph of files, symbols, and relationships.

At a high level, the pipeline looks like this:

```text
source files
  -> tree-sitter parsing
  -> symbol extraction
  -> local SQLite graph
  -> MCP tools for search, context, callers, callees, impact, and source exploration
```

The important part is that this is deterministic. CodeGraph does not ask an LLM to guess what the code means. It parses code into an AST, extracts symbols and edges, then lets the agent query that graph.

The tools we use most often are:

| Tool | Use |
|---|---|
| `codegraph_context` | Get focused context for a task or feature area |
| `codegraph_search` | Find a symbol by name |
| `codegraph_node` | Inspect one symbol's location, signature, or source |
| `codegraph_explore` | Read related symbols in one compact call |
| `codegraph_callers` | Find what calls a symbol |
| `codegraph_callees` | Find what a symbol calls |
| `codegraph_impact` | Estimate what could be affected by changing a symbol |
| `codegraph_files` | Inspect indexed project structure |
| `codegraph_status` | Check whether the index is healthy |

## How We Used It on This Site

During the recent inoTives site updates, CodeGraph was useful because the work touched several connected areas:

- Notes routing and article rendering
- Markdown rendering
- Projects page structure
- Research report routes
- Generated content index utilities
- Resume and portfolio pages
- Shared CSS classes for records, article pages, and prose

For example, when adding an "On This Page" section to note detail pages, the first question was not "where is the string Notes?". The useful question was:

```text
Understand notes detail page routing, markdown rendering, and where to add
an On This Page table of contents section for note articles.
```

`codegraph_context` surfaced the right entry points:

- `src/pages/Note.jsx`
- `src/components/MarkdownRenderer.jsx`
- `src/hooks/useMarkdown.js`
- `src/utils/content.js`

That immediately showed the path:

```text
/notes/:slug route
  -> Note page
  -> usePost(slug)
  -> getPostBySlug(slug)
  -> MarkdownRenderer
```

After that, the implementation was straightforward: parse headings from the markdown content, render matching heading IDs, and add a responsive table of contents beside the article.

The same pattern happened again for the Projects page. Before adding the research report section, CodeGraph located the route and page component quickly:

```text
App routes
  -> /projects
  -> Projects.jsx
```

Then normal shell tools handled literal file details, such as listing report files under:

```text
docs/reports/stocks/researches
```

This is the practical split:

- Use CodeGraph for structure, symbols, routes, and dependencies
- Use shell search or file reads for literal text, markdown, generated files, and static assets

## Why This Is Better Than Grep First

Grep is excellent for exact strings. It is not ideal as the first tool when the question is about code structure.

If the agent starts with grep, it often has to:

1. Search for a word
2. Open several files
3. Guess which result matters
4. Search again for imports
5. Read related components
6. Build a mental graph manually

CodeGraph starts with the graph that already exists. For feature work, it cuts straight to the likely entry points and relationships.

That makes the workflow faster and less noisy. It also reduces the chance of editing the wrong file just because it had a matching string.

## CodeGraph Does Not Replace Graphify

One important conclusion from my earlier evaluation: CodeGraph is not a replacement for graphify.

They solve different problems.

| Question | Better Tool |
|---|---|
| How does this React route connect to this component? | CodeGraph |
| What calls this function? | CodeGraph |
| What symbols are affected if this renderer changes? | CodeGraph |
| How are concepts connected across markdown notes, reports, and research files? | graphify |
| What communities exist across a mixed knowledge base? | graphify |
| How do docs, papers, images, and code cluster semantically? | graphify |

CodeGraph is best for code. Graphify is best for mixed-content knowledge discovery.

That distinction matters for my agent-memory workspace. Most of that workspace is markdown: rules, templates, drafts, reports, skills, and session notes. CodeGraph would index very little of that semantic content. Graphify is still the better fit there because it can produce a knowledge graph across prose and code.

For this website repo, CodeGraph is the better daily tool because the questions are usually about app structure and edit impact.

## The Workflow I Want Agents To Follow

The best pattern is not "use CodeGraph for everything." The better pattern is:

1. Use CodeGraph first for structural code questions.
2. Use `codegraph_context` when starting a feature or bug fix.
3. Use `codegraph_explore` when several related symbols need source context.
4. Use shell search for literal strings, markdown content, static files, and generated artifacts.
5. Make small edits that respect the discovered structure.
6. Run the build or relevant tests.
7. Regenerate static output when the site requires it.

For this repo, a typical loop looks like:

```text
codegraph_context
  -> inspect one or two concrete files
  -> apply scoped edits
  -> npm run build
  -> verify generated docs output
```

This keeps the agent from wandering. The graph gives structure; the build gives the final signal.

## Where It Helped Most

CodeGraph was most useful when the work crossed component boundaries:

- Finding how note detail pages render markdown
- Locating the right route to add the stock research project page
- Understanding where generated content metadata enters the React app
- Seeing whether a change belonged in a page component, shared renderer, or utility module
- Avoiding broad file-reading when only a few symbols mattered

It was less useful for:

- Reading markdown note content
- Listing HTML reports in static folders
- Inspecting generated build artifacts
- Editing CSS after the relevant class names were already known

That is not a weakness. It is just the boundary of the tool.

## Practical Verdict

CodeGraph is now part of my default coding workflow for agentic development. It gives AI agents a code-aware starting point instead of forcing them to reconstruct the app from text search.

The strongest use case is not replacing the developer. It is reducing the cost of orientation. The agent can move from "what is this codebase?" to "these are the relevant symbols and files" much faster.

For code-heavy repositories, that is a major advantage.

For mixed knowledge bases, I still want graphify.

The right setup is hybrid:

- CodeGraph for live coding sessions and source-level navigation
- graphify for periodic knowledge graph generation across notes, research, docs, and code
- Markdown as the common layer that both humans and agents can read

That combination fits the way I use AI agents: fast structural context when editing code, deeper semantic mapping when organizing knowledge.

## Sources and Prior Notes

- CodeGraph repository: https://github.com/colbymchenry/codegraph
- inoTives site workflow: current repo usage during Notes, Projects, Resume, and research-report page updates
