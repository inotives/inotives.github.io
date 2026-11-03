---
title: "NVIDIA Auto Ontology, and why our agent knowledge layer is a wiki instead"
date: 2026-11-04
tags: [ai-agents, knowledge-graphs, ontology, semantic-layer, text-to-sql, mcp, agentic-memory, nvidia]
series: building-ai-systems
summary: "NVIDIA's open-source Auto Ontology builds a semantic graph over warehouse metadata so agents can generate SQL they can trust. Under the hood it looks a lot like Knowledge Grid, the team knowledge layer we are building: LLM extraction, Postgres with pgvector, and an MCP surface for agents. The difference is the unit of knowledge: a typed graph node that points at columns, or a wiki page that holds what the team means and why."
---

NVIDIA has open-sourced [Auto Ontology](https://github.com/NVIDIA/auto-ontology) (Apache 2.0). It was announced at GTC Berlin in October as part of the [Agent Knowledge Foundation](https://thenewstack.io/nvidia-agent-knowledge-foundation/), alongside Nemotron Retriever models, Kumo models for structured data and the CUDA-X data libraries. It also follows NVIDIA's purchase of Illumex earlier this year, a startup that automated semantic layers for enterprise data.

I read the code because it is solving a problem close to one we are working on. We have been building **Knowledge Grid**, a team knowledge layer for people and their agents. Once I looked past the vocabulary, the two systems turned out to have the same skeleton. They differ in one important way: Auto Ontology stores knowledge as a **graph**, and we store it as a **wiki**. This note covers what Auto Ontology is, where it fits in real work, and why the two designs make different choices.

## What Auto Ontology is

The README states the problem directly: *a revenue metric answered faster is worth nothing if the number is wrong.* Agents can already write SQL. What they lack is context: which table holds the real orders, what "active customer" means in this company, which join is safe, and which of three revenue columns finance actually uses.

Auto Ontology builds that context from metadata you already have, then serves it to agents. It works in four steps:

1. **Connect** to Databricks, Snowflake, Postgres or DuckDB, and to any existing semantic models.
2. **Compile** a semantic layer. For each table it samples rows and probes distinct values, then asks an LLM (Nemotron through NVIDIA NIM by default) to propose business **Terms** such as *Purchase Order* and map columns to them as attributes with readable names such as *Order Date*. It also looks for joins the schema never declared. If a real foreign key exists it uses that. If not, it embeds the column, searches for similar attributes, asks the LLM to pick one, and checks the guess against sample values in the live database.
3. **Store** the result in Postgres with pgvector. The catalog is modelled as a property graph: `Database → Schema → Table → Column` nodes with `CONTAINS`, `FOREIGN_KEY`, `JOIN` and `HAS_SQL` edges, plus a semantic layer of Terms joined to columns by `HAS_ATTRIBUTE` and to each other by `SEMANTIC_FK`. Even the stored SQL your team has already written becomes edges between the tables it joins.
4. **Serve** it through MCP, a CLI and a REST API. Questions go through a LangGraph pipeline: work out the intent, retrieve candidate terms and joins, build SQL, validate values and join paths, run it, check for suspiciously empty results, and repair the query when a step fails.

A few design choices stand out, and I agree with them:

- **The MCP server is read-only and deliberately small.** The API has 87 operations, but MCP exposes nine: `check_readiness`, `search_terms`, `check_answerable`, `ask_question`, and a few term and table lookups. The docs say plainly that exposing everything "would degrade tool selection badly".
- **There is no raw-schema browser on purpose.** An agent cannot list tables and columns, because that invites it to reason from raw tables instead of approved meaning. `describe_table` returns only the terms and SQL attributes a table takes part in.
- **The server sends instructions at handshake** that set the order of calls, because left alone a model "tends to reach straight for `ask_question`".
- **A session can do exactly what its user can do.** The MCP server holds no credentials. It calls the public API as the signed-in person, so a viewer gets a viewer's answers.
- **Writes are governed, not chatty.** Changing meaning goes through REST with a written procedure: export the scope as YAML with a SHA-256 hash as the rollback copy, apply in an isolated environment, read back and compare exact IDs, run positive and negative probes, then promote. The skill files even list open bugs where the import can silently keep old properties, and tell agents to stop instead of patching Postgres directly.
- **It ships its own agent skills** (`nvidia-ontology-setup`, `-management`, `-query`). The query skill is mostly about not trusting a successful query: check the population, grain, unit, joins and truncation before presenting a number.

## How it will be used in real work

The target user is anyone pointing an agent at a warehouse and getting confident, wrong numbers back. Some concrete cases:

- **Self-serve analytics through an agent.** An analyst asks Claude or Cursor "net deposits on Tron last week". The agent calls `check_answerable`, then `ask_question`, and gets the answer, the SQL that produced it and the rows. The SQL is the receipt: a reviewer can see which population and which join were used.
- **Reconciling definitions across systems.** The same company often has three "customer" tables in three tools. The compile step proposes Terms and the joins between them, so the reconciliation becomes reviewable data instead of tribal knowledge.
- **A grounding layer inside larger agent stacks.** NVIDIA's own skills describe it sitting under the AI-Q blueprint (with SSO tokens passed through) and feeding numbers to other tools, such as cuOpt for optimisation or Kumo for predictive queries, which do the solving. Auto Ontology itself only answers questions about data.
- **Faster semantic-layer bootstrap.** NVIDIA's coverage cites about 90% less time to build an ontology. That figure comes from [vendor testing](https://www.besthub.dev/articles/nvidia-s-auto-ontology-90-faster-ontology-building-but-governance-remains-key-b83fd98bb262), and the honest reading is that it saves the drafting, not the review. A person still has to approve that *Total Amount* is net of refunds.

## The same skeleton as Knowledge Grid

Knowledge Grid is a team knowledge layer. People and agents (Claude, Cursor, custom runtimes) save notes, research, concepts, entity profiles, skills and workflows, and read them back over MCP. I wrote about the ideas behind it in [team memory on Postgres and MCP](/notes/2026-10-14-postgres-mcp-team-agent-memory) and about retrieval in [RAG, GraphRAG and the agent wiki](/notes/2026-10-07-rag-graphrag-agent-wiki).

Put the two side by side and the layers line up almost one to one:

![Two columns compared layer by layer. Auto Ontology reads warehouses, compiles terms with Nemotron, stores a typed graph in Postgres and pgvector and serves nine read-only MCP tools. Knowledge Grid reads documents, uses Claude as the extractor, stores wiki pages in Postgres and pgvector and serves read and write MCP tools.](/assets/images/auto-ontology-vs-knowledge-grid-stack.svg)

- **An LLM does the extraction.** Their compile step proposes Terms from tables. Our ingestion uses Claude as the extractor: it reads a Google Drive file, a calendar event or a local document, picks one of six pillars, writes a summary and adds `[[wikilinks]]`. In both systems the backend stores and checks; it does not try to understand text with hand-written parsers.
- **The store is Postgres with pgvector.** Neither uses a graph database. Auto Ontology keeps graph nodes and edges as relational rows. We keep pages, chunks, revisions and a `page_links` table. The graph view in our UI is computed from those links. "Graph" and "wiki" are modelling choices on top of the same base.
- **Embeddings help find things; they are not the source of truth.** They embed column and term descriptions to match joins. We embed page chunks (local multilingual E5) and fuse vector and full-text results with Reciprocal Rank Fusion.
- **Agents come in through MCP, with an identity.** Their sessions act as the signed-in user. Our tokens belong to a registered agent owned by a person, and every revision records which agent or person wrote it.
- **Change is controlled.** Theirs is a staged publication with readback and rollback. Ours is optimistic concurrency: every write needs `expectedVersion`, a stale write returns `VERSION_CONFLICT`, nothing is merged for you, and every version is kept.

## Where they differ: a node or a page

The real difference is row four in the diagram: what one unit of knowledge is.

![Left, a typed graph: Term Order linked by HAS_ATTRIBUTE to Order Date and Total Amount, which map to columns in the orders table, and by SEMANTIC_FK to Term Customer. Right, a wiki page concepts/net-deposits with a definition, the reason for it, and Connections that link to an entity, a note and another concept.](/assets/images/auto-ontology-node-vs-wiki-page.svg)

In Auto Ontology the unit is a **node with typed edges**. *Order* is a Term. Its attributes map to exact columns, and its relationship to *Customer* has a direction and a many-to-one cardinality. The modelling guide is strict about this: a matching column name is not proof of a join, a ratio of totals is not a mean of ratios, and every measure needs a grain, a unit and null behaviour. That precision exists because the output is SQL, and SQL does not forgive vagueness.

In Knowledge Grid the unit is a **page**: a slug such as `concepts/net-deposits`, a summary, tags and Markdown. The links are untyped `[[slug]]` references, and new pages are linked automatically to up to five related pages found by hybrid search. A page can hold things a graph node cannot: *we count a deposit after 12 confirmations, because we double counted on Tron in October, and the treasury desk owns this rule.* That is the knowledge people actually ask about in a team: definitions, decisions, reasons and who to ask.

So the two systems answer different kinds of question:

![Two lanes. Auto Ontology checks coverage, retrieves terms, builds and validates SQL, executes it and returns the answer with SQL and rows. Knowledge Grid runs hybrid search, reads summaries, reads pages, follows links and lets the agent write an answer citing page slugs and versions.](/assets/images/auto-ontology-query-paths.svg)

- Auto Ontology **computes** an answer. The number comes from the database at the time of the question, and you check it by reading the SQL and the rows.
- Knowledge Grid **recalls** an answer. The text comes from what the team wrote, and you check it by opening the cited pages and their history. It is only as fresh as the last edit.

We chose a wiki because most of what our agents need is prose that changes as the team learns, not schemas. Markdown is also easy for people to read, edit and review in the UI, and agents read and write it with almost no extra instruction. A typed graph would force every note into nodes and edges before anyone could write it down, and most notes never need that structure.

## What I am taking from Auto Ontology

Reading their design gave me a short list of ideas to borrow:

1. **A pre-flight tool.** `check_answerable` is cheap and tells the agent whether the layer covers the question before it spends effort. A wiki version would be "is there a concept or entity page for these nouns?", returned before a full search and read.
2. **Handshake instructions that set the call order.** We already describe each tool carefully. Telling the client "search, read summaries, then open pages" at connection time is a better place for it.
3. **Optional typed links.** Our `[[links]]` say *related* but not *how*. A small set of link types on concept and entity pages, such as `defines`, `owned-by` or `supersedes`, would give agents some of the graph's precision without turning the wiki into a graph.
4. **Honest receipts.** Their publication skill separates "validated and published" from "receipt only, nothing was published". Our agents should say the same when an ingest was skipped or a write lost a version race.

## Using both

They also fit together. One agent can connect to both MCP servers and ask each the question it is built for:

![An agent harness connected to two MCP servers. Knowledge Grid answers what a metric means, who owns it and what was decided. Auto Ontology answers how much, by chain, with SQL and rows. A concept page can name the ontology term, and a validated result can be saved back to the wiki as a research page.](/assets/images/auto-ontology-knowledge-grid-together.svg)

The wiki holds *what "net deposits" means here and why*. The ontology runs *how much, by chain, last week*. A concept page can record the ontology term it relies on in its metadata, and a validated answer, with its SQL, can be saved back to the wiki as a research page so the next person starts from it.

My short summary: Auto Ontology is a governed map of the data, built so an agent can compute a number it can defend. Knowledge Grid is the team's written memory, built so an agent can recall what the team knows and why. They share the same base, and the difference is mainly whether the knowledge is structured for queries or written for reading.
