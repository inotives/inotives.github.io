---
title: "Durable Team Agent Memory with PostgreSQL and MCP"
date: 2026-10-14
tags: [ai-agents, agentic-memory, postgresql, mcp, team-knowledge, multi-agent-systems]
summary: "A practical architecture for shared agent memory using PostgreSQL and the Model Context Protocol, designed for teams that want durable knowledge without making every user learn Git."
series: building-ai-systems
---

The first version of our shared agent memory used a Git repository full of Markdown files. It was transparent, portable, and easy for an engineer to review. It also assumed that everyone who needed to use the memory understood branches, pulls, merge conflicts, and commit history.

That assumption does not hold for most teams.

A sales lead should be able to record a customer decision. An operations teammate should be able to find yesterday's procedure. A researcher should be able to leave notes for another agent. None of them should need to understand Git to do those things.

This article describes a cleaner model: PostgreSQL stores the durable memory, and a Model Context Protocol (MCP) server provides the safe, searchable interface that both people and agents use. Git can still be used for source code, migrations, configuration, and optional exports. It no longer has to be the memory product.

![Dark architecture diagram showing agents connecting through MCP to PostgreSQL team memory](/assets/images/team-memory-postgres-mcp-architecture.svg)

## The design in one sentence

Agents do the reasoning, MCP provides the governed tools, and PostgreSQL keeps the team's durable knowledge in one shared place.

This separation matters. An agent should not receive a raw database password and invent SQL against production tables. A human should not have to know which table contains a research note. The MCP layer turns storage operations into a small, understandable contract:

- search the shared memory;
- read a page or a version;
- create a note, concept, entity, skill, or workflow;
- update a page with an expected version;
- archive or restore a page;
- record who performed the action.

The database remains durable and queryable. The agent sees a task-oriented interface.

## Why the Git-backed model becomes difficult for teams

A repository is a good collaboration surface for software. It is less comfortable as the primary interface for a living knowledge base.

The friction appears in ordinary moments:

- Someone edits a document without pulling the latest version first.
- Two agents update the same Markdown file and create a merge conflict.
- A non-technical teammate does not know where a new note belongs.
- Search depends on filenames, links, and whatever indexing a local tool happens to provide.
- Access is often defined at repository or folder level, while business knowledge needs narrower rules.
- A commit tells you that a file changed, but not always why the change was accepted or which agent acted on behalf of which person.

Git is not the problem. It is simply solving a different problem: versioning a set of files. Team memory needs a service boundary, structured metadata, search, identity, and operational controls.

The database approach puts those controls behind a normal application or MCP connection. A teammate can use a small web interface, a chat client, or an agent CLI. The storage mechanism stays out of their way.

## PostgreSQL as the durable memory layer

PostgreSQL is a practical foundation because it can hold the canonical page, metadata, audit fields, and retrieval indexes in one system. With the `pgvector` extension, it can also store embeddings for semantic search. PostgreSQL full-text search handles exact words, names, and operational vocabulary.

The useful pattern is hybrid retrieval:

1. Full-text search finds pages that contain the words the user typed.
2. Vector search finds pages with a similar meaning even when the wording differs.
3. The MCP service combines and ranks the candidates before returning concise results.

This is especially useful for team memory. A query such as “how do we handle an urgent marketplace refund?” may match a procedure by meaning, while a query for an exact order number should still behave like exact search.

The storage model does not need to expose every internal table to agents. A page-oriented domain is enough:

| Memory category | What belongs there | Example |
| --- | --- | --- |
| Notes | Dated observations and short records | Meeting notes, release log |
| Researches | Evidence-heavy investigations | Vendor evaluation, incident study |
| Concepts | Canonical explanations | Definition of a business term |
| Entities | People, teams, vendors, and projects | Customer profile, supplier |
| Skills | One reusable capability | Format a report, classify a lead |
| Workflows | Multi-step operating procedures | Incident response, onboarding |

Skills and workflows can remain ordinary pages with structured metadata. They do not need a separate memory system. That keeps search, versioning, archiving, and audit behavior consistent.

## MCP is the team memory interface

The Model Context Protocol gives agent clients a standard way to discover and call tools. The team memory server can expose a deliberately small surface:

```text
hybrid_search(query, category?, tags?, limit?)
get_page(slug, version?)
list_pages(category?, status?, cursor?)
create_page(title, category, body, tags?, source?)
update_page(slug, body, expected_version)
archive_page(slug, expected_version)
restore_page(slug)
```

The exact names are less important than the contract. Each tool should validate its input, enforce size limits, return stable errors, and record the caller identity.

For example, `update_page` should not silently overwrite a newer edit. The agent sends the version it read. If another person or agent has already changed the page, the service returns a version conflict. The agent can retrieve the latest page, explain the difference, and ask for a review.

That is safer than allowing whichever process writes last to win.

![Animated dark diagram showing agents reading and writing shared memory through MCP](/assets/images/team-memory-mcp-collaboration.svg)

## Identity is part of memory

Shared memory without identity quickly turns into a box of anonymous claims. Every request should carry enough context to answer:

- Which human or service account initiated the action?
- Which agent made the call?
- Was the operation a read, create, update, archive, or restore?
- Which page and version were involved?
- When did it happen?

For a local CLI, the MCP server can receive identity from a controlled environment or the local process configuration. For a remote HTTP MCP endpoint, identity can be conveyed through authenticated headers or a gateway-issued token. The important point is that credentials authenticate the connection; the application-level identity explains the action.

Do not put long-lived database credentials in prompts, Markdown pages, or skill instructions. Keep secrets in the runtime or secret manager, use least-privilege database roles, and make the MCP server the only component that needs direct database access.

## A small architecture that scales with the team

The first deployment can be modest:

```text
Agent CLI or chat client
        │
        │ MCP over stdio or authenticated HTTP
        ▼
Team memory MCP service
        │
        ├── validation and domain rules
        ├── identity and audit logging
        ├── hybrid retrieval
        └── optimistic concurrency checks
        │
        ▼
PostgreSQL + full-text search + pgvector
```

For a local team, the MCP server and PostgreSQL can run with Docker Compose. For a distributed team, place the MCP service behind an authenticated endpoint and keep PostgreSQL on a private network. The agents do not need network access to the database.

![Dark deployment diagram showing local and remote agents reaching a private PostgreSQL database through an MCP service](/assets/images/team-memory-deployment.svg)

An example client configuration should contain the MCP command or endpoint, not a database connection string:

```json
{
  "mcpServers": {
    "team-memory": {
      "command": "node",
      "args": ["/opt/team-memory/mcp-server.js"],
      "env": {
        "AGENT_NAME": "research-assistant"
      }
    }
  }
}
```

For a remote deployment, the client configuration points to the authenticated MCP URL instead. The same tools can then be used by Claude, Codex, OpenCode, or another MCP-compatible agent client without giving each client a bespoke database integration.

## How a team uses it day to day

### 1. Capture

An agent turns a meeting, support conversation, or research session into a page. It chooses a category, adds a short summary, records the source, and links related pages.

The agent should not store every transcript forever. Durable memory is curated memory. Store the decision, the evidence needed to understand it, and the next action. Keep raw exports in an appropriate system and link to them when necessary.

### 2. Retrieve

Before answering a team question, the agent searches the shared memory. It can filter by category, tags, owner, or status. The result should include a concise snippet and a stable page identifier so the agent can fetch the full page before relying on it.

### 3. Synthesize

The agent combines several pages into a response, report, or proposed procedure. It should preserve source links and distinguish an established decision from an unverified suggestion.

### 4. Review and publish

Not every generated draft should become canonical memory. A reviewer can approve a page, correct it, or archive it. A workflow can require human approval for policy, financial, legal, or customer-facing content.

### 5. Learn from the work

When the team discovers that a procedure was incomplete, update the procedure rather than leaving the correction in a chat thread. Over time, the memory becomes a maintained operating system for the team.

## Guardrails that make shared memory trustworthy

The database is durable, but durability alone does not make information correct. The MCP service and the agent instructions should enforce a few simple rules:

- Validate category, title, body size, tags, and required metadata.
- Store provenance for imported or externally researched content.
- Separate draft, published, archived, and superseded states.
- Use optimistic concurrency for updates.
- Make writes synchronous: if indexing fails, do not leave a half-written page.
- Keep an audit record for important reads and all mutations.
- Return stable errors such as `NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_INPUT`, and `EMBEDDING_FAILED`.
- Put limits on search results and page size so one request cannot exhaust the service.
- Treat retrieved text as data, not as permission to bypass the agent's instructions.
- Make sensitive folders or categories subject to explicit authorization.

The most important guardrail is trust calibration. Search results are evidence for the agent, not automatic truth. A page that has not been reviewed recently should be labelled as stale or uncertain. A newly generated idea should not quietly become company policy.

## What Git is still good for

Moving memory out of Git does not mean abandoning engineering discipline. Git remains useful for:

- database migrations;
- MCP server source code;
- deployment configuration;
- seed content and default skills;
- reviewable changes to schemas and policies;
- periodic exports or backups when the team needs a portable snapshot.

The distinction is simple: Git manages the system that runs team memory; PostgreSQL manages the memory that changes during team work.

## A sensible implementation path

Start with one vertical slice rather than a large platform:

1. Run PostgreSQL with full-text search and `pgvector`.
2. Create a page model with category, tags, status, source, version, and audit fields.
3. Implement `create_page`, `get_page`, `update_page`, and `hybrid_search` as MCP tools.
4. Add identity for the human and agent making each request.
5. Add version conflicts before inviting multiple agents to write.
6. Add archive and restore before adding automated ingestion.
7. Add a small read-only UI so non-technical teammates can browse and correct memory.
8. Add more categories, workflows, and integrations only when a real team task needs them.

This sequence produces something useful early. It also keeps the dangerous part, shared writes, explicit and testable.

## Where this fits with an agent rig

An agent rig and a team-memory service solve different layers of the problem.

The rig can define roles, task state, handoffs, worker and reviewer loops, and local execution rules. PostgreSQL plus MCP supplies the shared context those roles need. A worker can search for the current procedure, a reviewer can read the evidence behind a decision, and a completed task can publish a durable summary for the next run.

The integration should preserve the boundary:

- the rig owns execution state and coordination policy;
- MCP owns the memory API and access rules;
- PostgreSQL owns durable team knowledge and retrieval indexes;
- the agent CLI owns reasoning and tool selection.

![Dark diagram showing an agent rig using MCP as its durable team-memory boundary](/assets/images/team-memory-agent-rig.svg)

This gives the team a path from local multi-agent experiments to shared operations. The people who want Git can inspect migrations and exports. The people who do not want Git can use a client, a UI, or an assistant. Both groups work against the same governed memory.

## References

- [PostgreSQL](https://www.postgresql.org/)
- [pgvector](https://github.com/pgvector/pgvector)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP server concepts](https://modelcontextprotocol.io/docs/concepts/servers)
- [Previous article: Agentic memory with a shared wiki](https://inotives.github.io/posts/2026-10-06-personal-agent-memory-shared-wiki/)
