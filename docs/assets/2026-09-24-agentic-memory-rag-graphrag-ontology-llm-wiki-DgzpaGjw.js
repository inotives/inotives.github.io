var e=`---
title: "RAG, GraphRAG, ontologies, and LLM-wikis: agent memory by stage and scale"
date: 2026-09-24
tags: [ai-agents, agent-memory, rag, graphrag, knowledge-graphs, ontology]
summary: "A practical guide to combining RAG, GraphRAG, ontologies, and LLM-wikis as different layers of agent memory, with deployment patterns for individuals, growing teams, and enterprises."
series: building-ai-systems
---

Agent memory is often discussed as though every system needs one winning storage pattern. It does not. Retrieval, relationships, business meaning, and durable institutional decisions are different jobs. A vector index is good at finding a relevant passage. It is not a reliable place to define what "active customer" means. A knowledge graph can expose a dependency chain, but it cannot replace the plain-language decision record a human needs to edit in a pull request.

The useful recent shift is toward combining these forms deliberately. RAG remains the practical retrieval base. GraphRAG adds graph construction and community summaries for questions that cross many documents. Ontologies bring governed terms and constraints. LLM-wikis are returning as a portable, human-readable memory layer, especially with Markdown- and YAML-based conventions such as OKF.

They should not all be installed on day one. The right architecture depends on the question the agent must answer, the volume and change rate of knowledge, and the cost of getting a wrong answer.

## The four memory forms solve different failures

| Memory form | What it stores | Best agent question | Strength | Main limitation |
| --- | --- | --- | --- | --- |
| RAG | Chunked documents with lexical and vector indexes. | "Which policy, ticket, or runbook is relevant right now?" | Fast to introduce, easy to refresh, and can return source passages. | Similar chunks are not the same as correct business meaning or multi-step reasoning. |
| GraphRAG | Extracted entities, relationships, graph communities, and their summaries. | "How are these customers, systems, incidents, and teams connected?" | Finds multi-hop relationships and supports broad corpus questions. | Indexing is expensive, LLM-extracted graphs can be wrong, and graph upkeep is real work. |
| Ontology | Governed concepts, types, allowed relationships, definitions, and constraints. | "What counts as a regulated product, a breach, or an active account?" | Gives agents a stable vocabulary, policy checks, and deterministic boundaries. | Requires domain owners and becomes harmful when modelled more broadly than the organisation can maintain. |
| LLM-wiki | Curated Markdown knowledge: decisions, facts, playbooks, project state, sources, and links. | "What did we decide, why, and who validated it?" | Human-readable, versionable, portable, and cheap to begin. | Needs disciplined writing, search, and review as it grows; folders alone do not provide retrieval. |

The labels overlap in real products. A wiki can be indexed by RAG. An ontology can become the controlled schema behind a graph. GraphRAG often falls back to text chunks for evidence. The distinction is useful because each layer should have a clear owner and a clear reason to exist.

## How an agent memory system actually works

Memory is a read and write loop, not a document store bolted to a chat window. At the start of work, the agent identifies the task, chooses the smallest useful retrieval path, and loads evidence with provenance. At the end, it captures the outcome but does not automatically elevate every conversation into long-term truth.

![An agent memory system routes a task to RAG, GraphRAG, ontology, and LLM-wiki layers, then captures and reviews outcomes before promotion.](/assets/images/agent-memory-system-loop.png)

The review-and-promote step matters. A support agent may learn that a customer reported a billing issue. That is an episode, not a new company policy. A resolved incident may produce a validated runbook change. That can be promoted to the LLM-wiki, re-indexed for RAG, linked to an affected service in GraphRAG, and checked against an ontology term such as \`payment_incident\`.

Without this distinction, long-term memory becomes a landfill of stale chat summaries. With it, each write has a destination:

- Working memory holds the active plan, retrieved context, and tool results for the current run. It should expire.
- Episodic memory records a bounded outcome: what happened, what the agent tried, result, time, and source links.
- Curated memory holds promoted decisions, runbooks, and domain knowledge that a human or a deterministic rule has validated.
- Retrieval indexes and graph structures are derived views. They can be rebuilt from the authoritative documents and governed data.

## RAG: the evidence retrieval layer

Retrieval-augmented generation combines an LLM with external non-parametric memory retrieved at answer time. In a modern agent, this normally means hybrid lexical and semantic search over chunked documents, with metadata filters and source citations.

RAG is the first layer to add when agents need current private knowledge. A finance operations agent can retrieve the latest chargeback policy, the merchant's ticket history, and a relevant reconciliation procedure. The agent should cite those passages rather than rely on a vague semantic memory of the policy.

The operational trap is treating a vector score as a truth score. Chunk boundaries can separate an exception from the rule it qualifies. A stale document can be semantically perfect for the query. Two departments may use the same word differently. Good RAG needs document ownership, effective dates, access filters, chunking chosen for the document type, and an evaluation set made from real questions.

Use RAG for narrow evidence retrieval. Do not expect it to infer a reliable organisation-wide dependency graph or settle contested business definitions.

## GraphRAG: the relationship and synthesis layer

GraphRAG builds a graph from a corpus, commonly by extracting entities and relationships with an LLM, then creating community summaries for higher-level questions. Microsoft's implementation describes it as a structured, hierarchical alternative to plain text-snippet retrieval.

It earns its cost when the answer depends on connections spread across the corpus. Consider a security agent asked: "Which services and customers could be affected by the identity-provider incident, and what changes were made after the last similar event?" The agent needs services, owners, dependencies, incident reports, change records, and historical relationships. A top-k chunk search can miss the bridge between them. A graph can surface the connected subgraph, while RAG retrieves the source evidence that supports each claim.

GraphRAG is not a free upgrade to RAG. Entity extraction and summarisation cost model calls, take time to re-index, and can introduce fabricated or overly broad edges. A graph needs a refresh policy, source provenance on nodes and edges, deletion handling, and a way to show the user the evidence behind a relationship. Start with a selected high-value domain such as service dependencies or fraud cases. Do not graph every Slack message because the graph database exists.

## Ontology: the meaning and control layer

An ontology is a controlled model of the concepts in a domain, their properties, and the relationships that are allowed between them. It is more prescriptive than a graph. "Merchant", "legal entity", and "account owner" may all be nodes in a graph. An ontology states which one can own an account, which jurisdiction applies to a product, and which fields an agent may use to classify a complaint.

For an enterprise agent, this is where business ambiguity becomes an engineering concern. A revenue agent should not decide for itself whether trial users count as active customers. The ontology or semantic policy should define the term, the data source, effective date, owner, and any access constraint. A graph can represent the relationships; the ontology tells the agent what they mean.

The cost is governance. Domain experts must own definitions. Changes need review, versioning, and impact analysis. Many teams can begin with a glossary, data contracts, and explicit JSON or YAML schemas rather than an ambitious formal OWL model. Formal ontology tooling becomes worthwhile when shared terms, regulated classifications, or cross-system interoperability make inconsistency expensive.

## LLM-wiki: the durable, editable memory layer

An LLM-wiki is a maintained knowledge base that agents and people can both read and update, usually with Markdown documents, structured frontmatter, links, and a reviewable history. It is not a single product category. The important property is that the durable memory remains understandable without a particular embedding model or vendor API.

This is often the best starting point for an individual, a small team, or an internal agent fleet. A developer can keep project decisions, deployment notes, customer-safe research, runbooks, and known constraints in a Git-backed wiki. The agent searches it, proposes changes, and a person promotes the change after review. A portable format such as the Open Knowledge Format helps keep the content readable across tools.

The weakness appears when the wiki becomes large and ungoverned. Agents then need an index, metadata filters, and clear write rules. A page called \`notes-final-v3.md\` is not memory architecture. Give documents a type, an owner, provenance, a freshness signal, and links to the source material. Build RAG over the wiki when browsing and keyword search stop being enough.

## Map the memory form to the stage, then to the scale

The useful order is not a rigid pipeline. It is a map of what each form contributes. LLM-wiki keeps the durable record; RAG retrieves evidence; GraphRAG connects the cases where relationships matter; ontology constrains meaning and permission. A mature system routes among them instead of filling the prompt with all four every time.

![A stage and scale map showing LLM-wiki for durable knowledge, RAG for evidence retrieval, GraphRAG for relationships, and ontology for business meaning and access rules.](/assets/images/agent-memory-stage-scale-map.png)

### Individual or small team: start with an LLM-wiki

Use a Git-backed or shared Markdown wiki with a small vocabulary of document types: decision, runbook, project, research note, and glossary entry. Keep a simple full-text search. Add lightweight embeddings only when the agent regularly fails to find the right page.

This setup wins because the human can inspect every record. There is little infrastructure to operate and no opaque graph to debug. It is a poor fit for an agent that must reconcile thousands of customer cases or answer access-controlled questions across many business systems.

### Growing business: combine a wiki with RAG, then add a focused graph

At this stage, the LLM-wiki remains the source for decisions and operating knowledge. RAG indexes approved documents, tickets, product documentation, and selected knowledge-base articles. The agent retrieves citations and respects document-level permissions.

Add a graph only after a recurring question needs relationship traversal that retrieval misses: an incident impact map, account hierarchies, supply-chain dependencies, or entity resolution in an investigation. Keep the scope narrow and evaluate it against those questions. A graph that has no specific query workload is expensive decoration.

### Enterprise: combine all four behind a memory router

An enterprise deployment can use every layer, but should keep their responsibilities separate:

| Layer | Enterprise responsibility | Example control |
| --- | --- | --- |
| LLM-wiki | Canonical operational decisions and validated playbooks. | Git review, ownership, provenance, retention. |
| RAG | Permission-aware evidence retrieval across approved sources. | Metadata filters, source citations, freshness evaluation. |
| GraphRAG | Relationship-heavy domains with measurable multi-hop questions. | Edge provenance, refresh jobs, graph-quality evaluation. |
| Ontology | Shared definitions, classifications, and action constraints. | Domain stewardship, versioning, policy-as-code. |

The router uses task type and access context to choose the path. A policy question may need ontology plus RAG. An incident question may need GraphRAG to identify the connected systems and RAG to quote the incident record. An engineering handoff may need only the LLM-wiki. This selective approach keeps latency, tokens, and governance exposure under control.

## A real business example: merchant-risk operations

Take a payments company with an agent helping risk analysts investigate unusual merchant activity. The agent receives a merchant ID and a question: "Why was this account restricted, who else is exposed, and what can the analyst do next?"

RAG retrieves the restriction policy, recent case notes, and the latest playbook. GraphRAG follows the links among the merchant, beneficial owners, devices, related accounts, and prior incidents. The ontology defines terms such as \`high_risk_merchant\`, the jurisdictions involved, the evidence threshold for restriction, and which analyst role may see each field. The LLM-wiki records the approved investigation procedure and the decision explaining why a previous threshold changed.

The agent can now separate evidence from inference. It can say which documents justify a restriction, identify connected entities for human review, and refuse an action that conflicts with the policy model. None of the layers is sufficient alone: plain RAG may miss a cross-account link; a graph without the policy may overreach; a policy model without current case evidence cannot resolve the investigation; and a wiki alone cannot efficiently search hundreds of thousands of records.

## What to measure before adding another layer

Do not pick an architecture from a diagram. Collect failed agent tasks and classify the failure:

- The agent cannot find the relevant current source: improve RAG coverage, metadata, or evaluation.
- The agent finds sources but misses an important connection: test a focused graph workload.
- The agent retrieves the right evidence but applies the wrong business definition or permission: introduce governed ontology terms or policy checks.
- The agent repeats decisions that the team already made: improve the LLM-wiki and its review workflow.

Measure answer support, retrieval recall, stale-source rate, relationship precision, policy violations blocked, indexing cost, and human correction rate. The winning memory system is the smallest set of layers that improves those numbers for real work.

## References

- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)
- [Microsoft GraphRAG documentation](https://microsoft.github.io/graphrag/)
- [Microsoft GraphRAG getting started guide](https://microsoft.github.io/graphrag/get_started/)
- [W3C OWL 2 Web Ontology Language Primer](https://www.w3.org/TR/owl2-primer/)
- [Open Knowledge Format workflow](https://openknowledge.ai/docs/workflows/supporting-open-knowledge-format)
- [OpenKnowledge OKF plugin and LLM-wiki linting](https://openknowledge.ai/blog/open-knowledge-format-okf-plugin-linter)
`;export{e as default};