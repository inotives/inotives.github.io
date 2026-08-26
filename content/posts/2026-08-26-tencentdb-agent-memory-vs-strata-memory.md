---
title: "TencentDB Agent Memory and Strata Memory: Two Different Takes on Long-Term Agent Context"
date: 2026-08-26
tags: [ai-agents, agent-memory, knowledge-management, retrieval, strata-memory]
summary: "TencentDB Agent Memory builds a governed shared memory hub from conversations, skills, documents, and code. This article examines its layered retrieval design and compares it with Strata Memory's local-first, review-driven lifecycle from draft to durable knowledge to executable intelligence."
series: building-ai-systems
---

Agent memory often gets described as a vector database with a chat history attached. That description misses the expensive questions: what is worth keeping, who may use it, how does it become trustworthy, and how does an agent retrieve enough context without burying its actual task?

[TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) addresses those questions as a team memory hub. It ingests conversations, documents, and code, then turns them into reusable assets: Chat Memory, Skills, an LLM-Wiki, and a Code-Graph. Its retrieval design is layered, hybrid, and identity-aware. A human-facing Memory Hub governs what agents can share and load.

[Strata Memory](https://github.com/inotives/strata-memory) starts from a different constraint: memory should remain local, inspectable, and deliberately curated. Its vault lifecycle separates raw drafts from durable knowledge and executable intelligence. A Rust CLI indexes the Markdown vault, validates it, and promotes material only when a person or process decides it deserves a longer life.

The two projects overlap in their belief that memory is more than a transcript. They differ in where they put the control plane.

## The problem TencentDB Agent Memory is solving

An agent team loses expensive work in several ways. A conversation contains a hard-won fix but the next agent never sees it. A useful procedure lives in a chat message instead of becoming a reusable skill. Product documentation and code drift apart. One agent learns a user's preferences, then another agent either cannot use them or receives too much private context.

TencentDB Agent Memory frames this as a problem of reusable memory assets rather than a problem of storing every message. Its README identifies three decisions:

1. What experience should be retained?
2. Which agent or person may use it?
3. How can the next agent retrieve the smallest useful subset?

This changes the unit of storage. A raw conversation is evidence, but it is not the only product. The system aims to extract a preference, an event, a task procedure, a document explanation, or a code relationship that another agent can use later.

For a small engineering team, imagine an incident in which two exchange-price providers disagree. The chat transcript contains debugging, a temporary workaround, an eventual root cause, and a decision to use a documented reconciliation mart. A transcript-only memory system may retrieve a long, noisy conversation. An asset-oriented system can retain a concise rule, a skill for the investigation workflow, a documentation entry describing the mart, and a code relationship showing where the reconciliation policy lives.

## Four memory assets, not one prompt

TencentDB Agent Memory groups its stored experience into four types.

| Asset | Purpose | Example |
| --- | --- | --- |
| Chat Memory | Preserve people, preferences, constraints, and prior events | "This operator wants provider gaps reported in basis points." |
| Skill | Preserve repeatable procedures | A read-only workflow for checking a provider outage |
| LLM-Wiki | Explain documentation and code in agent-readable form | What `mart_daily_btc_usdt_price` means and how it is built |
| Code-Graph | Capture code structure and relationships | Which job writes raw responses and which model publishes the mart |

This is a sensible boundary. A user preference is not a procedure. A procedure is not a code dependency. Treating all three as chunks in one index gives retrieval fewer signals to work with.

The design is also closer to how a team actually works. New agents need a loadout: a role, selected skills, scoped knowledge, and access to the right code context. They do not need every conversation the team has ever had.

## The L0-L3 memory lifecycle

The project's core technical idea is a layered memory pyramid. Conversations land in L0, then an asynchronous pipeline refines them into higher-level assets.

| Layer | Stored material | Why it exists |
| --- | --- | --- |
| L0 Conversation | Raw conversations with timestamps and full context | Evidence, exact wording, source verification |
| L1 Atom | Extracted facts, preferences, constraints, and events | Precise recall of actionable details |
| L2 Scenario | Knowledge blocks organised around a project or situation | Fast restoration of a working context |
| L3 Core / Persona | Stable patterns, long-term profiles, and high-level cognition | A quick bootstrap for a user or team context |

The ascent is important. A raw conversation can later be re-read to verify a higher-level summary. An L1 fact is easier to retrieve than the full conversation. An L2 scenario is a practical entry point for an agent that has to work on a known project. L3 offers a compact starting context for persistent behaviour.

This mirrors a common data-engineering pattern:

```text
raw evidence -> normalised facts -> task-oriented views -> reusable operating context
```

The dangerous version of this pattern is silent compression. If L3 says a user always prefers a certain behaviour, the system needs a route back to the L0 evidence and a human path to correct it. TencentDB's emphasis on a human-controlled Memory Hub is therefore more important than the pyramid diagram itself.

## Hybrid retrieval, with a budget

TencentDB Agent Memory does not rely on a single semantic search. Its normal path uses L2 and L3 for a quick context bootstrap. When an agent needs a specific fact, it falls back to L1 and L0 using BM25, vector retrieval, and Reciprocal Rank Fusion (RRF).

BM25 helps when a query needs exact words: a model name, a schema field, an incident identifier, or a provider name. Vector retrieval helps when the useful wording is similar rather than identical. RRF combines ranked lists without pretending that a lexical score and a vector similarity score mean the same thing.

The project also applies item counts, character budgets, and timeouts. This is a small but essential detail. Retrieval that returns the right ten documents can still fail the agent if it injects all ten into a limited context window. The memory system needs a budget just as much as a warehouse query needs a cost limit.

In the exchange-price example, a good retrieval request could return:

```text
L3: team policy says price investigations are read-only
L2: provider-disagreement incident scenario
L1: acceptable gap is 50 basis points
L0: source conversation where the policy was approved
```

That is enough for an agent to begin. It can call a documented tool for current data instead of using memory as if it were the current state of production.

## Identity-aware memory assembly

The project's other notable choice is that memory is not one global system prompt. It is assembled as an agent's loadout, based on identity and scope. A support agent, a code-review agent, and an incident-response agent can therefore receive different combinations of skills, knowledge, and user context.

This is a better model for shared memory than simple global sharing. "All agents share the same memory server" should never imply "all agents see the same private history." The data model needs tenant, team, agent, role, project, sensitivity, and retention fields before the retrieval layer has a chance to make a safe decision.

The Memory Hub is where this becomes an operational feature rather than a prompt convention. Human owners can review assets, control sharing, and decide what becomes part of a team's reusable context. That makes the memory layer a governance surface.

## What technologies the project uses

The repository documents a local-first deployment path and names SQLite, BM25, embeddings, vector retrieval, and RRF in its storage and search design. Its source layout also includes local SQLite and BM25 implementations, embedding support, and Tencent Cloud VectorDB client and store modules. That suggests an architecture with a local baseline and a path to managed vector infrastructure rather than a mandatory cloud-only database.

It also ships integration work for Hermes Agent. That matters because it positions memory as a service an agent framework can consume, not merely a private application database. The broader promise is framework-level memory that can be equipped across agents.

The public project describes a benchmark section, but memory quality should not be reduced to one leaderboard number. A useful evaluation needs at least four measures:

- Did the system retrieve the correct asset?
- Did it preserve the source and permission boundary?
- Did the injected context improve the task outcome?
- Did it avoid returning irrelevant or private memory?

Those tests should use real multi-step workflows instead of question-answer pairs over a fixed corpus.

## Strata Memory takes a different path

Strata Memory is a local-first vault and Rust CLI. Its core lifecycle is intentionally visible in the filesystem:

```text
0_core/          installed engine, templates, config, cache, and index
1_draft/         raw, unreviewed material
2_knowledge/     curated durable knowledge
3_intelligence/  skills, agents, workflows, and reports
```

The key operation is promotion. A research draft can be reviewed, normalised, linked, tagged, and then promoted from `1_draft` into `2_knowledge` or `3_intelligence`. The original is archived. This gives a memory item a lifecycle that is easy to inspect with ordinary files and version control.

That is different from extracting a conversation automatically into L1, L2, and L3. Strata treats curation as an explicit gate. It is slower for a high-volume conversational agent, but it is a strong fit for durable research, procedures, decisions, and skills where a wrong memory can mislead future work for months.

## Strata's technical core

Strata uses SQLite as its stable default index backend. It supports Markdown search, SQLite full-text search, local semantic embeddings, and hybrid search. The CLI exposes the lifecycle directly:

```text
strata index             index one file or a vault
strata search            retrieve indexed memory
strata semantic-refresh  rebuild local embeddings
strata promote           move reviewed material into a durable tier
strata link-review       detect broken durable links
strata privacy-review    flag local-path and privacy risks
strata doctor            inspect vault health without mutation
```

Turso is available as an embedded local experimental backend. The project does not silently fall back between backends, and it keeps backend evaluation visible through ADRs, benchmark scripts, and curated search-evaluation material. That sounds mundane, but it prevents a common failure mode: a user believes they are testing semantic search while the system quietly serves results from a different index.

Strata's memory is therefore closer to a maintained knowledge base with a search engine than a live shared agent-memory service. Its durable unit is a Markdown note with provenance and links. Its strength is that a person can open the file, read it, change it, review it in Git, and understand where it sits in the lifecycle.

## TencentDB Agent Memory and Strata Memory compared

| Dimension | TencentDB Agent Memory | Strata Memory |
| --- | --- | --- |
| Primary unit | Reusable memory assets from chats, docs, and code | Markdown knowledge moving through an explicit vault lifecycle |
| Main users | Shared teams of agents and people | A local user or team curating a durable vault |
| Lifecycle | Async extraction from L0 evidence into L1-L3 memory | Review, validation, and promotion from draft to knowledge or intelligence |
| Retrieval | Layered bootstrap plus BM25, vector search, and RRF | SQLite full-text search, local semantic indexing, and hybrid search |
| Context assembly | Identity-aware agent loadout | Files, tiers, templates, and agent instructions selected by the workflow |
| Governance | Memory Hub controls asset sharing and team visibility | Git-visible files, privacy review, links, tags, rooms, and promotion gates |
| Code knowledge | LLM-Wiki and Code-Graph are first-class assets | Code and documentation can be curated as knowledge; no equivalent dynamic code graph is the core model |
| Runtime shape | Memory service designed for agent-framework integration | Local Rust CLI and filesystem vault |
| Default database posture | Local capability plus Tencent Cloud VectorDB-related modules | SQLite default; embedded local Turso is experimental |

Neither approach subsumes the other.

TencentDB Agent Memory is better aligned with an always-on team of agents that needs automatic accumulation, scoped sharing, and fast context restoration. Strata is better aligned with knowledge that should be inspected and promoted before it becomes a repeated instruction. The choice is less about whether to use embeddings and more about how quickly information is allowed to become operational memory.

## What Strata can learn from TencentDB's design

The most useful ideas are not a request to turn Strata into a chat-log warehouse.

First, Strata could make memory assembly more explicit. It already has `3_intelligence` for skills, agents, workflows, and reports. A lightweight, versioned "agent loadout" manifest could select an agent's approved skills, knowledge rooms, and context budget without exposing an entire vault.

Second, the L0-to-L3 model is a good reminder to preserve source evidence when creating summaries. Strata already keeps drafts and promotion history; it can strengthen the relationship by making the source draft, review rationale, and durable knowledge item easy to traverse in either direction.

Third, TencentDB's retrieval budget is worth treating as a first-class contract. Strata search can find relevant notes, but an agent needs an assembly step that selects a bounded set of excerpts, records why they were included, and makes the result reproducible.

Fourth, TencentDB's split between procedural skills, documentation knowledge, and code relationships is useful vocabulary. Strata has rooms and tiers that can represent those distinctions. Keeping the types clear prevents a "skill" from becoming an untested note and a "decision" from becoming an unscoped prompt fragment.

## What TencentDB's design should not erase

Automatic memory extraction deserves friction. A concise but incorrect L1 atom can travel further than its source conversation ever would. A team-wide persona can become a privacy problem. A Code-Graph can become stale as quickly as the repository changes.

Strata's explicit review, link validation, privacy review, and promotion model are good counterweights. A shared memory server needs the same habits: immutable source references, reviewer identity, a correction path, retention rules, access control, and an evaluation suite that includes bad retrievals.

The practical system may use both ideas. Keep source material and reviewed knowledge in a local durable vault. Publish selected, approved assets into an agent-memory service with an identity-aware loadout. Retrieve snippets within a fixed budget. Let an agent call documented tools for live facts. Log which memory items influenced the outcome.

That turns agent memory from a collection of clever prompts into an auditable information system.

## References

- [TencentDB Agent Memory repository](https://github.com/TencentCloud/TencentDB-Agent-Memory)
- [TencentDB Agent Memory README](https://github.com/TencentCloud/TencentDB-Agent-Memory/blob/feat/server_team/README.md)
- [Strata Memory repository](https://github.com/inotives/strata-memory)
- [Strata Memory project specification](https://github.com/inotives/strata-memory/blob/main/docs/project_spec.md)
- [Strata Memory architecture decisions](https://github.com/inotives/strata-memory/tree/main/docs/adr)
- [Data Engineering in 30 Days, Day 29: Data for AI systems](/posts/2026-08-18-data-engineering-day-29-data-for-ai-systems)
- [DeepSeek Harness: a plugin-first agent runtime](/posts/2026-08-21-deepseek-harness-agent-runtime-comparison)
