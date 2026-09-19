---
title: "Flat Graph, Tiered Lenses: Rethinking Agent Memory with OKF"
date: 2026-09-19
tags: [agent-memory, open-knowledge-format, knowledge-graphs, strata-memory, ai-agents]
series: building-ai-systems
summary: "Agent memory does not need a deep folder tree. A flat, linked Markdown graph paired with OKF metadata for trust, lifecycle, and retrieval lenses avoids categorization paralysis while preserving the controls a durable agent memory system needs."
---

I started Strata Memory with a familiar lifecycle: **Draft → Knowledge → Intelligence**. It gives an agent somewhere safe to put an unreviewed observation, a place for verified facts, and a higher bar for distilled guidance that should influence decisions.

That model still makes sense. The part I am reconsidering is using the lifecycle as the physical shape of the knowledge base.

An agent does not naturally remember through a directory path. It remembers that one thing is related to another: an API has a rate limit; an incident changed a policy; a customer workflow depends on both. That is an associative graph. A deep tree turns the taxonomy into a retrieval contract: the writer must predict where a future reader will look.

The better design is a **flat graph with tiered lenses**. Store concepts as flat, portable documents connected by explicit links. Keep trust, lifecycle, access, and review state in metadata. At retrieval time, apply the appropriate lens to the same graph.

![A flat concept graph lets a memory agent retrieve related nodes by semantic search and standard links, while tiered metadata lenses control trust and lifecycle.](/assets/images/flat-graph-tiered-lenses-agent-memory.png)

## The problem with folders as memory

Folders are excellent for human-maintained operational artifacts: source exports, project scaffolds, legal records, and a repository's code. They are much weaker as the primary model for facts that have several valid homes.

Take a deliberately awkward memory entry:

> Bob avoids apples because of a childhood trauma in Paris.

In a tiered tree, where does it go?

- `people/bob/`
- `places/paris/`
- `food/apples/`
- `psychology/aversions/`

Every answer is defensible. The problem is not that a human cannot choose one. The problem is that the agent must choose one before it knows the next question. Put it under Bob and a query about Paris may never retrieve it. Duplicate it everywhere and the system acquires conflicting copies, unclear ownership, and a difficult update path.

In a flat graph, the fact has its own concept page or atomic entry. It links to Bob, Paris, and apples. Each related page can point back through normal links, an indexer, or a computed backlinks view. A question about any of those concepts has a route to the same underlying memory.

This is not an argument against structure. It is an argument for putting structure where it belongs: in the relationships and metadata, not solely in the path.

## What “flat” should mean in practice

Flat does not mean one giant `notes.md`, no naming rules, or no navigation. It means that a concept's durable identity is not a long folder location chosen as a guess about its future use.

For a small internal agent knowledge base, the canonical documents might look like this:

```text
memory/
  vendor-api.md
  rate-limits.md
  onboarding-flow.md
  support-incident-2026-06.md
  billing-policy.md
  index.md
```

The agent can ask for `rate-limits`, resolve a stable document ID, and read the relevant links. It does not need to reconstruct `engineering/integrations/vendor-x/api/limits/` before it can act.

For an OKF bundle, use standard Markdown links in the canonical store:

```markdown
The [Vendor API](vendor-api.md) returns `429` responses after the limits
described in [Rate limits](rate-limits.md). The June support incident is
recorded in [Incident 2026-06](support-incident-2026-06.md).
```

`[[Wiki links]]` are convenient in a wiki editor, but they are not portable Markdown. The OpenKnowledge OKF plugin deliberately flags them because another OKF consumer may render the brackets literally. A writer-facing wiki can support them as a convenience, but the stored representation should remain ordinary relative links when portability matters.

## Turn tiers into lenses, not destinations

The original Draft → Knowledge → Intelligence model is still useful. It just becomes a property of a document rather than the directory that contains it.

Here is an illustrative OKF-compatible concept record. `type` is the required OKF field; the lifecycle fields below are local extensions, chosen by the memory system rather than imposed by the format.

```yaml
---
type: Concept
id: vendor-api-rate-limits
title: "Vendor API rate limits"
description: "Observed and documented API throttling behaviour."
tags: [vendor-api, reliability, integration]
memory_state: knowledge
importance: high
status: active
stale_after: 2026-12-31T00:00:00Z
sources:
  - resource: https://docs.vendor.example/rate-limits
    last_modified: 2026-09-12T00:00:00Z
verified:
  - by: human:platform-team
    at: 2026-09-18T08:30:00Z
---
```

One set of documents can now be viewed in several ways:

| Lens | Example filter | What the agent may do |
| --- | --- | --- |
| Working memory | `memory_state: draft` and recent | Propose, question, and seek confirmation; never present as fact. |
| Trusted context | `memory_state: knowledge` plus human verification | Use to answer an operational question with sources. |
| Decision guidance | `memory_state: intelligence`, current, and approved | Recommend an action, while retaining links to the underlying evidence. |
| Incident review | `tags: [reliability]` plus a time range | Pull connected policies, runbooks, and past failures. |

This distinction matters. “Draft” is not a subject area. It is a claim about confidence and lifecycle. A rate-limit note can move from draft to knowledge without moving to another conceptual home or breaking its incoming links.

## Retrieval should start with meaning, then traverse carefully

A flat graph only pays off if the retrieval layer uses it. Browsing directories is the wrong retrieval primitive. A practical agent memory request should follow a bounded sequence:

```text
user question
  → lexical and semantic candidate search
  → apply trust, lifecycle, access, and freshness lenses
  → expand relevant links by one hop
  → build a small evidence pack with source pointers
  → answer or request review
```

Consider a support agent asked: “Can we raise the quote API concurrency for the new onboarding flow?” A good retrieval service may find `vendor-api.md` semantically, then rank `rate-limits.md` through an explicit link. It should also pull `support-incident-2026-06.md` because that incident is linked to the limit policy. A draft observation that says “the limit seems higher now” stays out of the authoritative answer unless the task explicitly asks for hypotheses.

That last step is where many memory systems go wrong. A vector search result is a candidate, not truth. Ranking must respect metadata before it optimizes for similarity.

```text
score = semantic relevance
      + lexical match
      + relationship relevance
      + recency signal
      + trust eligibility
```

In practice, make trust eligibility a gate for factual or operational actions, not just a small score bonus. A highly similar stale draft should not outweigh a slightly less similar human-verified policy.

## The graph needs rules or it becomes a junk drawer

A flat layout removes path anxiety. It does not remove the need for discipline.

| Failure mode | Guardrail |
| --- | --- |
| Two pages represent the same concept | Give every document a stable ID and aliases; resolve titles to IDs before writing. |
| An agent creates invented or broken links | Validate links and IDs in the write path; show unresolved links to a reviewer. |
| Retrieval expands the whole graph | Cap traversal depth, number of neighbors, token budget, and result count. |
| A draft contaminates an answer | Filter lifecycle, verification, and stale status before assembling evidence. |
| Distilled guidance loses its evidence | Require intelligence documents to link to the knowledge and sources that justify them. |
| A renamed title breaks callers | Treat title as presentation and ID as identity; maintain redirects or aliases. |

The rule of thumb is simple: let the model propose associations, but make the memory service enforce identity, permissions, provenance, and bounded retrieval.

## How I would evolve Strata Memory

I would not mass-move a working vault into a flat directory just to make a philosophical point. That risks breaking references and creates churn with little immediate value.

Instead, I would separate the two concerns in stages:

1. Keep the current Draft, Knowledge, and Intelligence labels as lifecycle metadata and review policy.
2. Add stable IDs, aliases, and explicit Markdown links to new concept records.
3. Build a resolver that searches titles, aliases, tags, and embeddings across all eligible records.
4. Return a bounded graph neighborhood with source and verification details, rather than a folder listing.
5. Treat existing folders as an operational concern for archives, imports, and human navigation. Do not make them the only meaning an agent can use.

This preserves the part of the tiered approach that matters: a draft cannot silently become a decision rule. It also lets a fact connect naturally to people, systems, projects, incidents, and policies without being copied across them.

## Why OKF fits this direction

OKF is deliberately minimal: Markdown files with YAML frontmatter, designed to be readable by people and consumable by agents without a bespoke runtime. That makes it a strong substrate for a memory graph. Links remain visible in plain files, metadata can carry provenance and verification, and Git can review every change.

The format does not magically provide graph search, embeddings, or lifecycle governance. Those belong in the memory service around the bundle. That separation is healthy. The files are the portable source of truth; the index, vector store, backlink cache, and retrieval policy are rebuildable derived systems.

For a Hermes fleet or any multi-agent team, this also clarifies collaboration. Agents can open a pull request that adds a draft concept and links it to known records. A human reviewer can verify the source, promote its `memory_state`, and merge it. Every agent sees the same flat knowledge graph, while each role receives a different retrieval lens and permission boundary.

## The real shift

The tiered model was never wrong. It was doing two jobs at once: organizing concepts and expressing trust. Those jobs pull in different directions.

Use a flat, linked graph to represent what the organization knows. Use tiers as lenses to decide what an agent may retrieve, trust, edit, or act on. That gives the agent the associative memory it needs without giving up the operational discipline a real business system requires.

## References

- [Open Knowledge Format v0.2 specification](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)
- [OpenKnowledge OKF portability plugin](https://openknowledge.ai/docs/plugins/okf)
- [Strata Memory](https://github.com/inotives/strata-memory)
