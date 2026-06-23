var e=`---
title: "Google's OKF: The Knowledge Format We've Been Building Toward"
date: 2026-06-23
tags: [okf, google, knowledge-management, ai-agents, llm-wiki, strata-memory, markdown, rag, agent-memory]
summary: "Google released OKF v0.1 — a markdown-based standard for agent-readable knowledge. It formalizes the LLM-wiki pattern Karpathy described. We've been building the same idea with strata-memory, but with SQLite indexing for when markdown files grow past 1000."
---

# Google's OKF: The Knowledge Format We've Been Building Toward

Google released OKF v0.1 on June 13. It's an open specification for agent-readable knowledge — a directory of markdown files with YAML frontmatter, organized as cross-linked concept documents.

It's also the same pattern we've been building with strata-memory.

## What OKF Is

OKF formalizes what Andrej Karpathy called the "LLM-wiki" pattern back in April. Instead of RAG — where you chunk documents and retrieve fragments at query time — OKF pre-compiles knowledge into curated concept files that agents load verbatim.

The format is minimal:

\`\`\`
bundle/
  index.md              (optional) directory listing
  log.md                (optional) chronological history
  <concept>.md          one concept per file
  <subdirectory>/       groups concepts
    <concept>.md
\`\`\`

One required frontmatter field: \`type\`. Everything else is optional. Markdown body with conventional headings (\`# Schema\`, \`# Examples\`, \`# Citations\`). Cross-links via bundle-relative paths.

That's it. No proprietary SDK, no vector database, no embedding provider. Just files.

## Why OKF Over RAG

The problem with RAG is that every query starts from zero. No accumulation, no cross-references, no synthesis. You retrieve chunks, the LLM pieces them together, and next time you ask the same question, it does it again from scratch.

OKF treats knowledge as a compiled artifact:

| Aspect | RAG | OKF |
|--------|-----|-----|
| Knowledge state | Retrieved per-query from raw chunks | Pre-compiled, maintained wiki |
| Cross-references | None (chunks are independent) | Markdown links between concepts |
| Version control | Not natively supported | Git-native (diff, blame, PRs) |
| Human readability | Chunks are not curated documents | Full markdown files |
| Agent consumption | Retrieval pipeline + context injection | Load file verbatim into context |
| Knowledge growth | Requires re-embedding corpus | Incremental file edits |

Karpathy's point: "The tedious part of maintaining a knowledge base is the bookkeeping... LLMs don't get bored, don't forget to update a cross-reference, and can touch 15 files in one pass."

## How We Got Here First

We've been building the same pattern with strata-memory — before OKF existed.

Strata-memory uses markdown files with YAML frontmatter, organized in tiered directories:

\`\`\`
1_draft → 2_knowledge → 3_intelligence
\`\`\`

Each tier is a directory of concept documents. Cross-links via relative markdown paths. Index files for navigation. The same LLM-wiki pattern OKF formalizes.

The difference: strata-memory adds SQLite indexing on top.

When you have 50 markdown files, \`grep\` works fine. When you have 500, it starts to slow down. When you have 1,000+, you need full-text search. That's where SQLite comes in — FTS5 full-text search over the markdown corpus, rebuildable from the markdown source if the index corrupts.

Markdown is canonical. SQLite is the derived index. Best of both worlds.

## What OKF Gets Right

OKF's three design principles align with what we've found in practice:

1. **Minimally opinionated** — Only \`type\` is required. Everything else is producer-defined. This matches strata-memory's approach: the markdown is the contract, not the tooling.

2. **Producer/consumer independence** — Human-authored or agent-generated bundles are consumed identically. We've found this matters: agents write markdown, humans read markdown, both work from the same source.

3. **Format, not platform** — No proprietary account, SDK, or runtime. Files on a filesystem. This is why we chose markdown + SQLite over RAG + Postgres.

## Where OKF Stops and We Go Further

OKF is a format specification. It doesn't tell you how to:

- **Promote knowledge across tiers** — strata-memory's \`strata promote\` moves drafts to knowledge to intelligence with review gates
- **Search at scale** — OKF assumes index.md + log.md suffice; strata-memory adds FTS5 for 1,000+ files
- **Manage lifecycle** — OKF doesn't prescribe when knowledge should be archived, reviewed, or promoted
- **Handle privacy** — strata-memory has review modes for sensitive content

OKF gives you the vocabulary. Strata-memory gives you the workflow.

## The Hybrid Approach

The real answer might be both. OKF as the interchange format — what you share with other agents, what you publish to registries. Strata-memory as the working environment — where you draft, promote, index, and manage the lifecycle.

\`\`\`
OKF bundle (shared)     ←→     strata-memory (working)
  index.md                       1_draft/
  concept.md                     2_knowledge/
  log.md                         3_intelligence/
                                 strata.db (SQLite index)
\`\`\`

OKF for portability. Strata-memory for scale. The markdown is the same on both sides.

## What's Next

OKF v0.1 is the starting point. The open questions:

- Will \`type\` values need a registry to prevent fragmentation?
- How does OKF scale beyond 1,000 concepts? (Our answer: SQLite indexing)
- Can OKF coexist with SQLite indices for hybrid file+query access? (Our answer: yes, that's what we built)

Google released the format. The ecosystem is already building on it — OKF Harness, EchoesVault, Smriti-MCP, Eidetic, and more.

We'll keep building strata-memory as the working environment, and keep an eye on OKF as the interchange standard. The markdown is the same. The indexing is the differentiator.

---

## References

- [Google Cloud Blog: Introducing the Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)
- [OKF v0.1 Specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
- [OKF Repository](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)
- [Karpathy's LLM-Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [strata-memory](https://github.com/inotives/strata-memory) — Local-first agent memory with markdown + SQLite indexing
`;export{e as default};