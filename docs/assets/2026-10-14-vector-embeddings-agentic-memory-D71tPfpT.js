var e=`---
title: "From Words to Vectors: Embeddings in Agentic Memory"
date: 2026-10-14
tags: [ai-agents, embeddings, vector-search, postgresql, pgvector, rag, agentic-memory]
summary: "A practical explanation of vector embeddings, semantic similarity, RAG, and hybrid search, with a PostgreSQL and pgvector pipeline for turning team knowledge into searchable agent memory."
series: building-ai-systems
---

While building shared agent memory, I kept coming back to one question: how can an agent find a useful passage when the person searching uses different words from the document?

Keyword search is good at matching words. It can find an exact product code or phrase, but it may miss a procedure that describes the same idea in different language. Vector embeddings give us another way to search: represent a piece of content as numbers, then compare its position with the representation of a question.

I’m using PostgreSQL with \`pgvector\` as the memory database. That means pages, metadata, text-search indexes, and embeddings can live together. The vector is useful, but it is only one part of the memory record.

![Dark diagram showing text changing into an embedding vector and nearby meanings grouped in a semantic space](/assets/images/embedding-semantic-space.svg)

## What is an embedding?

An embedding is a list of numbers produced by a model from an input such as a sentence, paragraph, image, or other supported content. For text, the numbers are intended to preserve useful language patterns learned by the model.

For example, an embedding model might place these sentences near each other:

\`\`\`text
“How do I return a damaged item?”
“What is our process for defective-product refunds?”
\`\`\`

The wording differs, but their intent overlaps. A vector-search system can rank the second sentence as relevant to a search for the first.

You can picture a vector as a point in a space with many dimensions. A model could output hundreds or thousands of numbers for one input. People cannot look at those coordinates and read a definition from them. The representation is useful because a search system can compare it with other vectors.

The model has not stored a perfect definition of the sentence. It has made a compressed, model-dependent representation. Similarity is a signal for retrieval, not proof that two passages say the same thing.

## How semantic similarity works

At indexing time, an embedding model converts each searchable text chunk into a vector. At query time, the same compatible model converts the question into a vector. The database compares the query vector with stored vectors and returns the nearest candidates.

One common comparison is cosine distance. It compares the direction of two vectors, rather than treating the raw numbers as plain text. With \`pgvector\`, the \`<=>\` operator calculates cosine distance; smaller distance means closer vectors. A cosine similarity score can be expressed as \`1 - cosine distance\`.

\`\`\`sql
SELECT
  chunk_id,
  content,
  1 - (embedding <=> $1::vector) AS similarity
FROM memory_chunks
WHERE workspace_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 8;
\`\`\`

The workspace filter matters. A semantically relevant result from another team's private memory must not appear just because it is nearby in vector space. Authorization and tenant filters belong in the retrieval design, not as a cleanup step after results are returned.

Distance is not the same as confidence. A close result may still be outdated, contradictory, or missing the exact answer. The agent should read the source passage and its metadata before using it.

## How embeddings make RAG possible

Retrieval-Augmented Generation (RAG) connects retrieval to an answer-generating model. The agent searches external memory, receives relevant passages, and includes them as context when it asks the language model to answer.

\`\`\`text
Question
  → embed the question
  → retrieve relevant chunks
  → add those chunks to the model context
  → generate an answer with source references
\`\`\`

The embedding helps locate candidate passages. It does not generate the answer and does not guarantee that the selected passages support it. RAG still needs good extraction, chunking, ranking, provenance, and answer instructions.

Semantic search can also be useful without RAG. A person or an agent may simply want to find and open the relevant memory page. RAG is the next step when retrieved material is passed into a model to produce a response or complete a task.

![Animated dark diagram of a question moving through embedding, retrieval, and answer generation](/assets/images/embedding-rag-flow.svg)

## Why hybrid search is a better default for team memory

Vector search answers “which passages are similar in meaning?” Full-text search answers “which passages contain these words?” Team memory needs both.

Semantic search can find a refund procedure when the question says “send money back.” Full-text search is more dependable when looking for a supplier name, error code, order identifier, acronym, or exact policy phrase. Combining candidate lists gives the agent both kinds of evidence.

With PostgreSQL, one path is to run vector retrieval with \`pgvector\` and lexical retrieval with PostgreSQL full-text search, then fuse their ranked results. Reciprocal Rank Fusion (RRF) is one way to combine rankings without assuming that vector and text-search scores share the same scale. A reranker can then score the smaller candidate set if the use case needs it.

![Dark diagram comparing keyword search and vector search before their results are fused into hybrid search](/assets/images/embedding-hybrid-search.svg)

The retrieval results should keep links to their canonical page, version, and source. When a user asks an exact question, the system should not substitute a semantically similar guess for a precise match.

## Turning different files into searchable memory

Embedding a document does not mean putting the whole file into a vector column. The ingestion process first turns the source into clean, attributable text. It then breaks that text into passages that can be retrieved independently.

\`\`\`text
File or memory page
  → extract readable content
  → normalize without losing structure
  → split into meaningful chunks
  → attach source and access metadata
  → create embeddings
  → store text, vector, and provenance
\`\`\`

The extraction step depends on the source. Markdown already has headings and lists. DOCX and PDF files need text extraction; scanned pages may need OCR. Tables should be retained in a readable form instead of flattened into a row of disconnected values. A research paper should preserve section headings, citation details, and page references where available.

| Memory content | Useful preparation before embedding | Metadata to keep |
| --- | --- | --- |
| Markdown | Keep heading paths, lists, code blocks, and links with the relevant passage | Page slug, heading, version |
| Documents and PDFs | Extract paragraphs and tables; use OCR for scans; retain page or section location | Filename, page, source URI |
| Research | Preserve abstract, method, findings, limitations, and citations as distinct sections | Authors, publication date, citations |
| Concepts | Store the canonical definition with aliases and related concepts | Concept ID, status, related pages |
| Entities | Keep structured fields for exact lookup, plus a text description for semantic discovery | Entity type, stable ID, owner |
| Skills and workflows | Keep instructions, prerequisites, and steps together in coherent units | Skill or workflow ID, version |

Different content needs different chunk boundaries. A definition should stay with its explanation. A workflow should not be split so that a step loses its prerequisites. A product record may be best represented as structured fields plus a compact text description. Chunking every file into identical character counts can sever context and make retrieval harder.

For searchable agent memory, each chunk should retain a path back to the full page or original document. Store the chunk text and metadata alongside its embedding. The vector cannot reconstruct the original source.

## A PostgreSQL and pgvector memory record

The exact schema depends on the application, but a retrievable chunk usually needs fields for:

- the original page or document ID;
- chunk order and text;
- category, tags, workspace, and access scope;
- source URI and extraction location;
- embedding vector and model identifier;
- content version and ingestion timestamp.

For example, \`pgvector\` supports vector columns and nearest-neighbor ordering. It can run exact search by default or use approximate indexes such as HNSW and IVFFlat when data size and latency make that trade useful. Approximate search is faster in many cases, but can trade some recall for speed. Start with measured query behavior; an index is not automatically better for a small corpus.

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_chunks (
  chunk_id       uuid PRIMARY KEY,
  workspace_id   uuid NOT NULL,
  page_id        uuid NOT NULL,
  chunk_number   integer NOT NULL,
  content        text NOT NULL,
  source_uri     text,
  model_id       text NOT NULL,
  embedding      vector(1536) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memory_chunks_embedding_hnsw
  ON memory_chunks USING hnsw (embedding vector_cosine_ops);
\`\`\`

The dimension shown here is only an example. The column dimension must match the embedding model output. Choose one model and compatible query/document encoding strategy for an index. If the model changes, do not compare its new query vectors against old vectors as if they shared the same space. Track the model version and re-embed the affected content, often by building and validating a replacement index before switching retrieval over.

## Which embedding models can I use?

Several well-known providers offer models built specifically to create embeddings. These are separate from the chat or reasoning models that generate answers. OpenAI, for example, offers embedding models alongside GPT models; the GPT model itself is not what this article uses to encode memory.

| Provider and example model | What stands out | Good fit to evaluate |
| --- | --- | --- |
| OpenAI \`text-embedding-3-small\` / \`text-embedding-3-large\` | Text embeddings; output dimensions can be reduced from the defaults (1,536 and 3,072). Small is a practical starting point; large is a higher-capacity option. | General text search when you already use the OpenAI API or want adjustable vector size. |
| Google \`gemini-embedding-2\` | Multimodal embedding inputs include text, images, video, audio, and PDFs. Output size is configurable. Retrieval prompts/task formatting matter. | A memory collection where documents contain useful visual or other non-text content. |
| Cohere \`embed-v5.0-pro\` / \`embed-v5.0-fast\` | Supports text, images, and mixed inputs such as PDFs. You choose a dimension, and the API distinguishes \`search_document\` from \`search_query\`. Pro favors quality; Fast favors latency. | Search over mixed document content, especially when you want explicit query/document modes. |
| Voyage \`voyage-4-large\` / \`voyage-4\` / \`voyage-4-lite\` | General-purpose family with quality, balanced, and latency/cost choices. The API distinguishes query and document inputs; Voyage also offers \`voyage-code-4\` for code retrieval. | General or multilingual retrieval, and a separate code-search workload. |
| Amazon Titan Text Embeddings V2 | Text-focused and available through Amazon Bedrock. Supports 1,024, 512, or 256 dimensions and input up to 8,192 tokens. | A team that wants embedding inference within its AWS and Bedrock setup. |

Anthropic’s current Claude documentation says Anthropic does not offer its own embedding model. You can still use Claude to read, synthesize, or answer from retrieved memory while a separate embedding provider creates the vectors. Anthropic’s guide points users to Voyage for that embedding step.

These model descriptions are a shortlist, not a leaderboard. They differ in supported modalities, vector dimensions, retrieval-specific input handling, language coverage, latency, hosting options, and cost. A larger vector is not automatically a better retrieval result, and a provider’s benchmark may not reflect your team’s documents or questions. Build a small evaluation set from real memory queries and compare whether the right source appears near the top.

Keep an embedding model identifier with every indexed chunk. Query vectors and stored vectors must use compatible models, dimensions, and task settings. If you test a second provider, store its vectors separately or build a separate index; never compare vectors from different model spaces as if their distances were interchangeable.

## The ingestion path: keep source, text, and vector together

A robust pipeline has two different jobs: extract and index. Extraction makes content readable and preserves provenance. Indexing creates chunks and embeddings for search.

![Dark pipeline diagram showing Markdown, PDFs, research, entities, and procedures becoming attributed PostgreSQL memory chunks](/assets/images/embedding-ingestion-pipeline.svg)

An ingestion record should be traceable back to its source. If a file changes, the system needs to know which chunks belong to the old version so it can replace or archive them. If embedding generation fails, the page should not silently look fully indexed. Record ingestion state and surface failures for retry.

Sensitive content needs the same access checks in vector search as it does in page reads. Filtering only after candidate retrieval can leak snippets or influence ranking across access boundaries. Apply workspace and permission constraints as part of the query, and choose index/partition strategies that preserve expected recall under those filters.

## Practical limits to keep in mind

Embeddings are useful, but not magical:

- Similarity does not prove that two chunks are equivalent.
- A vector can miss a rare name, exact number, negation, or newly introduced term.
- Poor extraction produces poor vectors; a broken table or OCR result remains broken after embedding.
- Bad chunk boundaries make useful context harder to retrieve.
- Query and document vectors must use a compatible model and intended task mode.
- A model upgrade can require re-embedding and retrieval evaluation.
- Approximate nearest-neighbor indexes need recall and latency checks against the actual workload.
- Retrieved content can be stale or malicious; it remains untrusted input for the agent.

Keep the original page or document available, cite retrieved sources in answers, and evaluate with real team questions. Good retrieval is measured by whether the right source appears near the top, not by whether the vector column is populated.

## Putting it together

In our agentic memory setup, PostgreSQL is the system of record and \`pgvector\` supplies one retrieval method. The ingestion pipeline prepares Markdown, documents, research, concepts, entities, skills, and workflows. It keeps source content, structured metadata, and chunk embeddings connected.

At search time, the user question is embedded and compared with the indexed chunks. PostgreSQL full-text search contributes exact term matches. Hybrid ranking returns a short list of attributed sources. The agent then reads those sources and uses them in a RAG answer or task.

\`\`\`text
Memory sources → extract and chunk → embed → PostgreSQL + pgvector
                                                ↑
Question → query embedding → vector search ─────┤
Question → full-text search ────────────────────┤
                                                ↓
                                   hybrid ranking → agent context
\`\`\`

The main insight for me is that an embedding is not the memory itself. It is an index key for finding the memory. The durable record is still the source, its context, and the history that tells the team where it came from.

## References

- [pgvector: vector similarity search for Postgres](https://github.com/pgvector/pgvector)
- [PostgreSQL full-text search types](https://www.postgresql.org/docs/current/datatype-textsearch.html)
- [PostgreSQL text-search functions and operators](https://www.postgresql.org/docs/current/functions-textsearch.html)
- [Sentence Transformers: Semantic Search](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html)
- [Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks](https://arxiv.org/abs/1908.10084)
- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)
- [OpenAI: Vector embeddings](https://developers.openai.com/api/docs/guides/embeddings)
- [Google: Gemini Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
- [Cohere: Embed models](https://docs.cohere.com/docs/cohere-embed)
- [Voyage AI: Text embeddings](https://docs.voyageai.com/docs/embeddings)
- [Amazon Bedrock: Titan Text Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html)
- [Anthropic: Embeddings](https://platform.claude.com/docs/en/build-with-claude/embeddings)
- [Previous article: Durable Team Agent Memory with PostgreSQL and MCP](https://inotives.github.io/posts/2026-10-14-postgres-mcp-team-agent-memory/)
`;export{e as default};