var e=`---
title: "RAG, GraphRAG, and the enterprise agent wiki"
date: 2026-10-07
tags: [ai-agents, agentic-memory, rag, graphrag, knowledge-graphs, enterprise-architecture]
summary: "How a shared agent wiki can remain the canonical source while vector search and graph search provide complementary retrieval paths for precise facts, relationships, and multi-hop reasoning."
series: building-ai-systems
---

The previous article moved agent memory from a personal notebook into a shared company wiki. That introduced owners, page status, review, scope, and a contribution boundary for agents.

The next question is retrieval. A large wiki cannot be useful to an agent if the agent must read every page before answering. We need projections that make the knowledge searchable without turning those projections into a second source of truth.

This is where Retrieval-Augmented Generation (RAG) and GraphRAG fit.

![Agent wiki with RAG and GraphRAG retrieval](/assets/images/agent-wiki-rag-graphrag-architecture.svg)

The design in this article is hybrid. The wiki remains canonical. A vector index helps an agent find precise passages. A knowledge graph helps it follow relationships. A router chooses one path or combines both.

## The wiki remains the source of truth

Use the same structure from the previous article:

\`\`\`text
knowledge/
├── domains/
├── projects/
├── decisions/
├── runbooks/
├── glossary/
└── shared-rules/
\`\`\`

Each page carries the context that makes it safe to reuse:

\`\`\`text
owner
status
scope
source or reason
last reviewed
replacement or related pages
\`\`\`

That metadata should travel into retrieval results. A semantically similar page with a retired status should not silently outrank a current page. A definition owned by one domain should not be presented as a company-wide rule without its scope.

RAG and GraphRAG are derived views over this wiki. They can be rebuilt when a page changes, a parser improves, or a retrieval strategy is replaced. They should not become places where agents make independent authoritative edits.

## What RAG does

Retrieval-Augmented Generation combines search with language-model generation. Instead of asking a model to answer from its general training, the application retrieves relevant context and includes that context in the prompt.

In a typical vector RAG path:

1. A page is split into useful chunks.
2. Each chunk is represented as an embedding.
3. The embedding and page metadata are stored in a vector index.
4. A question is embedded in the same space.
5. Similar chunks are retrieved.
6. The agent uses those passages to write an answer.

The important unit is not only the vector. It is the vector plus provenance: canonical page, section, owner, status, scope, and last review.

### When to call \`vector_search_tool\`

Use \`vector_search_tool\` when the agent needs a specific fact or passage:

- the definition of a term;
- the steps in a runbook;
- the wording of a policy;
- an explanation of how a component works;
- an example from a project page;
- a precise paragraph that supports an answer.

The question usually sounds like “What does the page say?” or “Where is the procedure for this?” Vector retrieval is good at finding the text that answers that question.

Vector search can also include lexical filters, metadata filters, or reranking. “Vector” does not have to mean “ignore exact words.” A page status or domain scope should filter the candidate set before the agent treats a result as evidence.

## What GraphRAG adds

GraphRAG combines retrieval with an explicit graph of entities and relationships. Instead of representing a page only as chunks of prose, the system extracts useful nodes and edges.

For example:

\`\`\`text
Team ──owns──> Domain
Project ──uses──> Capability
System ──depends_on──> System
Decision ──constrains──> Architecture
Policy ──supersedes──> Policy
Page ──defines──> Concept
\`\`\`

The graph does not need to contain every sentence. It captures stable relationships that help the agent navigate the knowledge base.

### When to call \`graph_search_tool\`

Use \`graph_search_tool\` when the question is about relationships or several connected steps:

- Which team owns this domain?
- What depends on this system?
- Which decisions constrain this architecture?
- What policy replaced the previous rule?
- Which projects use this capability?
- What pages define the concepts involved in this decision?

These questions are difficult to answer with nearest-neighbor text alone. The relevant evidence may be spread across several pages, and the path between the pages is part of the answer.

## What belongs in each view

The same wiki page can contribute to both projections. The content is grouped by retrieval behavior, not copied into unrelated stores as separate truth.

![Data placement across the agent wiki, RAG, and GraphRAG](/assets/images/agent-wiki-rag-data-placement.svg)

### Keep in the canonical wiki

Keep the reviewed prose and lifecycle context in the wiki:

- decisions and their rationale;
- domain definitions;
- project context;
- runbooks and procedures;
- architecture explanations;
- ownership and scope;
- source links and review history;
- replacement and related-page links.

This is where a person corrects meaning. It is also where an agent should propose a change.

### Project into vector RAG

Send explanatory text to vector retrieval:

- definitions and examples;
- procedure steps;
- policy paragraphs;
- troubleshooting notes;
- questions and answers;
- summaries of long pages.

Chunk boundaries matter. A chunk should carry enough context to stand on its own, but not so much that a short fact is buried inside an entire document. Store the page path and section heading with every chunk.

### Project into GraphRAG

Extract stable entities and relationships:

- people, teams, and domains;
- projects and systems;
- capabilities and concepts;
- decisions and policies;
- ownership, dependency, definition, and supersession edges;
- links between a relationship and the page that supports it.

Graph edges need provenance. An edge without a source page is a claim with no way to inspect it. When a page is retired, its derived edges should be marked stale or re-evaluated rather than silently left as current facts.

## The hybrid query path

Most useful enterprise questions are not purely factual or purely relational. They need the graph to find the neighborhood and vector search to retrieve the words that explain it.

![Hybrid RAG and GraphRAG query sequence](/assets/images/agent-wiki-hybrid-query-sequence.svg)

Consider the question: “What changed, which systems are affected, and who owns the follow-up?”

The agent can:

1. identify the change or policy as a graph node;
2. traverse decision, system, and ownership relationships;
3. collect the relevant page identifiers;
4. call \`vector_search_tool\` for the supporting explanations;
5. verify each page's owner, status, scope, and review state;
6. answer with both the relationship path and citations to canonical pages.

The graph supplies structure. The vector index supplies language. The wiki supplies authority.

## A simple routing policy

The router does not need a complicated classifier to start. A small set of intent rules is enough:

\`\`\`text
specific fact or phrase
  → vector_search_tool

owner, dependency, impact, or history
  → graph_search_tool

multi-hop question needing evidence
  → graph_search_tool, then vector_search_tool
\`\`\`

The tools should return source-page identifiers, not only generated text. The agent can then fetch the canonical page or relevant section before answering. Retrieval should reduce the amount of context the agent reads, not remove the ability to inspect the source.

## Keep projections synchronized

The retrieval indexes are useful only when they reflect the wiki lifecycle.

![Agent wiki projection lifecycle](/assets/images/agent-wiki-projection-lifecycle.svg)

The safe sequence is:

\`\`\`text
draft and review wiki change
  → publish canonical page
  → rebuild vector chunks
  → rebuild graph entities and edges
  → expose updated retrieval views
\`\`\`

Do not update the vector index when a draft is still private unless the retrieval boundary explicitly supports private content. Do not promote a graph edge from an unreviewed page into a company-wide relationship without preserving its status.

Incremental updates are fine. The design should still support a full rebuild. A rebuild is the simplest recovery when chunking logic, embedding models, entity extraction, or relationship rules change.

## Retrieval is not permission

Finding a page does not automatically mean every agent should see or use it. Retrieval must respect the wiki's scope and access boundaries. At minimum, carry page status, domain, owner, and audience metadata into both projections.

The graph can create a particularly subtle leak. A relationship such as “project depends on system” may reveal more than the source paragraph. Graph construction should therefore apply the same publication and access rules as text indexing.

This is another reason to keep the wiki canonical. If a page is withdrawn, the system has one place to mark the source state and a clear process for invalidating its derived views.

## What the hybrid system should return

A good retrieval response has more than an answer string. It should include:

- the answer or candidate context;
- source-page paths;
- the relevant section or relationship;
- page status and scope;
- owner and review date;
- uncertainty or unresolved conflict;
- whether the result came from vector, graph, or hybrid retrieval.

This gives the final agent a way to explain its reasoning without pretending that retrieval is proof. It also gives a person a path to correct the canonical page when the answer is wrong.

## The practical design rule

Use the wiki to store meaning and responsibility. Use vector search to find text. Use GraphRAG to navigate relationships. Use both when the question crosses several pages.

The system works because the three layers have different jobs. The wiki is reviewed and durable. The vector index is fast at finding passages. The graph is useful for connected reasoning. None of them needs to pretend to be the others.

## References

- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)
- [Microsoft GraphRAG](https://github.com/microsoft/graphrag)
- [Neo4j GraphRAG package](https://neo4j.com/docs/neo4j-graphrag-python/current/)
- [GitHub pull requests](https://docs.github.com/en/pull-requests)
- [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
`;export{e as default};