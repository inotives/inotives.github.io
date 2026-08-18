---
title: "Data Engineering in 30 Days, Day 29: Data for AI Systems"
date: 2026-08-18
tags: [data-engineering, learning-path, ai-agents, retrieval]
summary: "AI systems depend on data engineering: clean retrieval inputs, chunking and metadata choices, permission-aware access, stable tool contracts, checkpoints, audit trails, and evaluations that exercise failure paths."
series: data-engineering-in-30-days
---

An AI system can have an excellent model and still be unsafe or useless because the data around it is vague. A retrieval system returns stale documents. An agent scrapes an undocumented production table. A tool response changes shape halfway through a workflow. An evaluation proves a final sentence sounds good while missing that the agent used the wrong source or ignored a permission boundary.

Data engineering is the work that makes an AI system's inputs and outputs dependable. The same principles from the rest of this series still apply: retain raw evidence, define stable interfaces, trace transformations, grant the minimum access, and test failure paths rather than only happy answers.

Day 29 turns those principles into concrete design choices for retrieval and agent workflows.

## The outcome for day 29

By the end, you should be able to:

1. Explain why retrieval quality starts before embeddings and prompts.
2. Choose document chunks and metadata from the questions a system must answer.
3. Carry permissions from source documents through retrieval and tools.
4. Define stable, read-only agent tools over documented marts or APIs.
5. Use checkpoints, audit trails, and reusable evaluation environments to test an AI workflow honestly.

## 1. An AI system is a data system with a model in the middle

The model is only one component. A useful production design has several contracts:

```text
source documents and events
  → raw evidence
  → cleaned, versioned knowledge or marts
  → retrieval index or bounded tool
  → agent workflow and checkpoint
  → answer, action proposal, and audit trail
```

Each arrow can alter meaning, access, freshness, or reproducibility. The model should not be asked to compensate for an unknown source, ambiguous schema, or missing permission rule.

Consider an internal market-risk assistant. A user asks, “Why did the daily price alert trigger for BTC/USD?” A reliable answer needs a documented price mart, alert configuration, source freshness, the relevant data interval, and perhaps raw-provider evidence. It does not need an agent to browse arbitrary warehouse schemas hoping to find a plausible `price` column.

The better interface is a small tool such as `get_price_alert_explanation` with a defined input, output, ownership, and access policy.

## 2. Retrieval starts with clean documents, not a vector database

Retrieval-augmented generation, or **RAG**, retrieves relevant source material and passes it to a model as context. The retrieval system can only return what was captured, cleaned, chunked, indexed, and authorised correctly.

Before embedding anything, establish a document pipeline:

```text
original document
  → extracted text and structure
  → cleaned version with source reference
  → chunks with metadata and permissions
  → embedding/index representation
  → retrieval result with citations
```

Keep the original document or an immutable reference to it. Text extraction can lose tables, headings, page numbers, or footnotes. A retrieval answer needs a way back to the authoritative source, especially when a user disputes it.

### Chunking is a data-model decision

A **chunk** is the unit retrieved into a model's context. There is no universal ideal token length. The right size depends on what a user asks and where the source's meaning lives.

| Source shape | Useful chunking starting point | Why |
| --- | --- | --- |
| Policy document | A heading and its subsections, with limited overlap. | Definitions and exceptions often live together. |
| API reference | One endpoint or resource definition per chunk. | Inputs, outputs, and errors should stay together. |
| Table or report | Preserve title, time period, units, headers, and row context. | A number without units or period is misleading. |
| Incident runbook | One procedure or decision branch per chunk. | The agent needs an actionable, bounded instruction. |
| Conversation or ticket | A coherent turn group with author and time metadata. | Individual sentences often lose the decision context. |

Small chunks can improve precise retrieval but split a rule from its exception. Large chunks retain context but consume more prompt space and may bury the relevant sentence. Start with the user question and source structure, then evaluate retrieval on representative questions.

Do not make chunks by cutting every 500 tokens without preserving headings, document IDs, version, page or section, and permission labels. That creates an index full of text fragments with no trustworthy provenance.

## 3. Metadata makes retrieval useful and safe

The text of a chunk is only part of the retrieval record. Metadata lets the system filter, rank, cite, and secure it.

```json
{
  "chunk_id": "risk-policy-v3:section-4.2",
  "document_id": "risk-policy-v3",
  "source_uri": "policy://risk/v3",
  "title": "Price alert escalation",
  "section": "4.2",
  "published_at": "2026-07-01T00:00:00Z",
  "effective_from": "2026-07-15T00:00:00Z",
  "classification": "internal",
  "allowed_roles": ["risk_analyst", "operations"],
  "content_hash": "...",
  "chunk_version": 1
}
```

Useful metadata commonly includes:

| Field | What it supports |
| --- | --- |
| Source ID and URI | Citation and return to the authoritative document. |
| Version, publication, and effective time | Freshness and policy-history reasoning. |
| Title, section, and document type | Better retrieval and human-readable citations. |
| Author, owner, and classification | Accountability and access decisions. |
| Permission or tenancy label | Retrieval-time access filtering. |
| Content hash and ingestion run | Change detection and reproducibility. |
| Language, region, product, or time period | Domain-aware filtering and relevance. |

Metadata is an interface. Renaming `allowed_roles` or changing its meaning can be as disruptive as changing a database column in a consumer mart.

## 4. Permissions must survive the retrieval path

Retrieval is a data-access operation. If a user cannot read a source document directly, the system should not reveal it because a semantic search happened to retrieve a similar sentence.

The safe sequence is:

```text
authenticate caller
  → resolve caller roles, tenant, and purpose
  → filter candidate chunks by those permissions
  → retrieve and rank only authorised chunks
  → show citations that the caller may open
```

Filtering after retrieval can still leak information through titles, ranking, count, timing, or an accidental chunk preview. Enforce permissions as close to candidate selection as the index and architecture allow.

For the risk assistant, an operations user can retrieve approved alert runbooks and aggregate market data. A compliance investigator with an assigned case can retrieve case-scoped identity and transaction evidence. An AI agent given a read-only market-analysis role should not receive raw KYC documents simply because the raw schema is convenient.

### PII and embeddings need the same discipline as tables

Embeddings and vector indexes are derived data, not a permission-free copy. If raw text contains PII or confidential information, the chunks, metadata, embedding store, backups, logs, and evaluation fixtures inherit the sensitivity.

Minimise the source text before indexing when possible. Keep direct identifiers in a restricted domain. Apply retention and deletion policy to the index as well as the source. A document deletion that leaves its text searchable in an embedding index is incomplete deletion.

## 5. Agents need documented tools, not arbitrary database access

An agent tool is an API contract. It should answer one well-defined question or perform one scoped action. The tool's response should be stable, typed, bounded, permission-checked, and traceable.

Avoid this interface:

```text
tool: run_sql
input: any SQL string
output: arbitrary production rows
```

It hands the agent a schema-discovery problem, broad read risk, unbounded query risk, and a path to accidental PII exposure. It also makes evaluation vague: there is no stable contract to test.

Prefer a documented mart or tool contract:

```json
{
  "tool": "get_daily_market_price",
  "input": {
    "market": "BTC/USD",
    "date": "2026-08-18"
  },
  "output": {
    "market": "BTC/USD",
    "observation_date": "2026-08-18",
    "open_price": "118100.00",
    "high_price": "118900.00",
    "low_price": "117800.00",
    "close_price": "118450.25",
    "data_status": "certified",
    "source_mart": "mart_daily_market_price",
    "mart_version": "2026-08-18.1"
  }
}
```

This contract has a clear grain: one market per UTC day. It returns a status, source, and version so the agent can avoid presenting a provisional number as a certified value. The implementation can query the warehouse, call an internal API, or read a cached service. Consumers depend on the contract, not the storage detail.

### Tool design guidelines

| Guideline | Why it matters |
| --- | --- |
| Read from a curated mart or view | Gives the agent stable business semantics and avoids raw-source quirks. |
| Define input and output schemas | Lets callers validate requests and lets evaluations compare results. |
| Bound result size and time range | Prevents unbounded scans and context floods. |
| Enforce caller permissions in the tool | Makes access independent of model behaviour. |
| Return source, freshness, and status metadata | Lets the agent express uncertainty accurately. |
| Use idempotency keys for actions | Prevents a retry from creating duplicate external effects. |
| Version breaking changes | Allows agents and evaluators to migrate deliberately. |

The model may choose whether to call a tool. The tool must decide what is allowed to happen.

## 6. Checkpoints make agent work resumable and reviewable

An agent workflow often spans several steps: interpret a request, retrieve policy, query a mart, evaluate evidence, propose an action, and ask for approval. A **checkpoint** records a durable, typed state between meaningful transitions.

```text
request_received
  → evidence_retrieved
  → market_data_verified
  → action_proposed
  → approval_required
  → completed
```

At each checkpoint, store only the data needed to resume and audit safely:

```text
workflow_run_id
checkpoint_type and schema_version
caller identity and authorisation context
input reference and validated parameters
tool calls, result IDs, and source versions
decision or approval status
timestamps and code/prompt version
```

Do not store unbounded conversation transcripts or raw PII merely because it might be useful later. Store references to approved evidence, apply retention, and make sensitive checkpoint fields access-controlled.

Checkpoints improve recovery. If a mart query succeeded but a downstream formatter failed, the system can resume from the validated result rather than repeat every tool call. They also improve review: a human can see which source version and policy led to a proposal.

## 7. Evaluation needs reusable environments, not a single benchmark answer

An AI evaluation should test the observable workflow alongside the final prose. A benchmark question can be answered correctly for the wrong reason: an agent may use stale context, call an unauthorised tool, skip a required approval, or find a coincidentally correct number in an undocumented table.

Build small reusable evaluation environments with known source data, contracts, permissions, expected outcomes, and failure injections:

```text
fixture warehouse: known mart rows, raw evidence, and one stale dataset
fixture retrieval index: versioned documents with allowed_roles labels
fixture tools: stable schemas and controlled errors
fixture identities: analyst, compliance investigator, and unauthorised caller
expected outcomes: answer, citations, tool calls, refusal, or escalation
```

For the market-risk assistant, useful cases include:

| Case | Expected behaviour |
| --- | --- |
| Certified price alert | Retrieve the right policy section, query the documented mart, cite its data status, and explain the trigger. |
| Stale mart | Say the data is stale or escalate; do not present it as current. |
| Permission-denied KYC request | Refuse or route to the approved case workflow without retrieving private chunks. |
| Schema-version mismatch | Stop with a tool-contract error or use a supported compatibility path. |
| Conflicting provider values | Surface the quality status and request review instead of selecting a convenient price. |
| Tool timeout after checkpoint | Retry safely or resume from the prior checkpoint without duplicating an action. |

This is data engineering for agents: controlled fixtures, defined interfaces, visible state, and repeatable failure conditions. A single benchmark score cannot substitute for it.

## 8. Audit trails connect AI output to evidence and policy

An **audit trail** records the events needed to explain a system's behaviour later. For an AI workflow, a useful trail can include:

```text
who made the request
which identity and permissions were resolved
which retrieval index and document versions were searched
which chunks and citations were returned
which tools were called with validated parameters
which mart and data versions supplied values
which checkpoint or approval transition occurred
which model, prompt, and application version produced the response
```

This is not an argument for logging every hidden reasoning token or storing every customer conversation indefinitely. It is a targeted evidence trail for the observable decisions and data access that the organisation must explain, debug, or review.

Apply the governance rules from Days 25–26: logs can contain PII, tool arguments can reveal sensitive intent, and retrieval traces can expose document titles. Set access and retention controls for audit data too.

## A small exercise for day 29

Design one bounded AI data interface. It can be a retrieval corpus, a read-only agent tool, or a short workflow that uses both.

```text
Consumer question:
Authoritative source and raw evidence:
Chunking or table grain:
Required metadata and permissions:
Input and output schema:
Freshness and data-status rule:
Checkpoint states:
Audit fields:
Known-good evaluation case:
Failure case: stale, denied, conflicting, or schema-changed data:
Expected safe behaviour:
```

The exercise is complete when the agent has no reason to scrape an arbitrary production table. It receives one documented path to the information, a bounded result, and a visible response when the path is not trustworthy.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| RAG | Retrieving approved source material to ground a model response. | `Explain RAG as a data pipeline: source document, extraction, chunking, metadata, index, retrieval, citation, and evaluation.` |
| Chunk | The unit of source content retrieved into model context. | `Design chunks for a policy document with headings, exceptions, effective dates, and permissions. Compare 200-token, 500-token, and section-based chunks.` |
| Embedding | A numerical representation used to compare semantic similarity. | `Explain embeddings for a data engineer. What data, metadata, permissions, retention, and evaluation concerns remain after text is embedded?` |
| Retrieval metadata | Structured fields that filter, rank, cite, and secure chunks. | `Design retrieval metadata for internal runbooks and policies. Include source, version, effective date, owner, classification, roles, and content hash.` |
| Retrieval-time access control | Filtering documents before a caller receives retrieved content. | `Explain why permission filtering after semantic retrieval can leak information. Design an authorised retrieval sequence for a compliance assistant.` |
| Tool contract | A stable input/output agreement for an agent capability. | `Design a read-only get_daily_market_price tool contract with schema, bounds, permissions, freshness, source mart, and data status.` |
| Checkpoint | Durable workflow state saved between meaningful steps. | `Design checkpoints for an AI alert-investigation workflow. What should be stored, referenced, versioned, and excluded for privacy?` |
| Evaluation environment | A reusable controlled setup with known data, tools, identities, and expected outcomes. | `Build an AI evaluation environment for a market-risk assistant. Include normal, stale-data, permission-denied, schema-mismatch, and tool-timeout cases.` |
| Failure-path test | A test that proves safe behaviour when a dependency is wrong or unavailable. | `Give failure-path tests for an agent that retrieves policies and queries a price mart. What should it do for stale, conflicting, and denied data?` |
| Audit trail | Evidence of requests, access, tool use, decisions, and versions. | `Design a minimal privacy-aware audit trail for an AI workflow. Separate useful operational evidence from unnecessary transcript retention.` |
| Data status | A machine-readable declaration of freshness, quality, or certification. | `Explain data status values such as certified, provisional, stale, conflicting, and unavailable. Show how an agent should phrase each to a user.` |

When asking an LLM to design an AI data workflow, provide source authority, consumer permission, model and tool boundaries, expected data status, retention constraints, and failure behaviour. Prompt wording cannot reliably substitute for a permission check, a schema, or a reproducible test environment.

## What comes next

Day 30 closes the path with a small capstone: build one complete pipeline that ingests provider data, retains raw evidence, standardises it, flags disagreement, publishes a mart, and produces a short quality report.

## References

- [OpenAI guide: retrieval](https://platform.openai.com/docs/guides/retrieval)
- [OpenAI guide: evals](https://platform.openai.com/docs/guides/evals)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [OpenLineage documentation](https://openlineage.io/docs/)
- [dbt documentation: model contracts](https://docs.getdbt.com/docs/collaborate/govern/model-contracts)
