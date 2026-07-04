---
title: "Agentic Memory Management: How Production Agents Remember, Retrieve, and Forget"
date: 2026-07-04
tags: [ai-agents, memory-management, vector-search, knowledge-graph, hallucination, production-architecture]
series: building-ai-systems
summary: "Production agent memory is not a single vector store. It is a layered cognitive system with working memory, episodic memory, semantic memory, and archival storage. Retrieval uses composite scoring (similarity + recency + importance). Forgetting is essential — time-decay and consolidation prevent stale data from polluting responses. The key accuracy insight: structured typed memory beats unstructured vector search for high-stakes domains."
---

# Agentic Memory Management: How Production Agents Remember, Retrieve, and Forget

Production agent memory is not a database. It is cognitive infrastructure. The 2026 research consensus converges on a 3-4 tier memory architecture inspired by human cognition: working memory (current context), episodic memory (recent sessions), and semantic memory (durable facts and structured knowledge). Each tier has different storage mechanisms, retrieval strategies, and decay profiles.

The critical insight for production: accuracy comes from structured retrieval, not larger context windows. Vector similarity search alone is insufficient for high-stakes domains. It must be combined with typed schemas, entity-scoped filtering, and importance-weighted decay. The Governed Memory paper achieved 99.6% fact recall using a dual memory model (atomic facts + schema-enforced typed properties). Memori achieved 81.95% accuracy using only 5% of full context by structuring memories as semantic triples.

## The four memory layers

Production agents need multiple memory layers, not a single store.

```
Layer 0: Working Memory (Context Window)
  Current conversation turn
  System prompt + tools
  Bounded: 4K-128K tokens
  Ephemeral: lost on session end

Layer 1: Episodic Memory (Recent History)
  Session summaries
  Recent interactions (72h-7d)
  Bounded buffer
  Decay: fast (hours-days)

Layer 2: Semantic Memory (Durable Facts)
  User preferences
  Entity relationships
  Business rules
  Structured (schema-enforced)

Layer 3: Archival Memory (Long-term Store)
  Historical data
  Knowledge graph
  Unlimited size
  Decay: slow (months-years)
```

| Layer | What It Stores | Size | Lifetime | Access Speed |
|-------|---------------|------|----------|--------------|
| Working Memory | Current conversation, system prompt, tool results | 4K-128K tokens | Session only | Instant (in-context) |
| Episodic Memory | Session summaries, recent interactions | Bounded buffer | 72h-7d | Fast (vector search) |
| Semantic Memory | Typed facts, user preferences, business rules | Moderate | Months-years | Fast (structured query) |
| Archival Memory | Historical data, knowledge graph, documents | Unlimited | Indefinite | Slower (search required) |

## What goes where

**Working memory** holds only what the agent needs for the current turn. System prompt, current user message, last N messages (bounded), relevant retrieved memories from other layers, and current task state. Full conversation history, old preferences, and historical data do not belong here.

**Episodic memory** stores compact representations of recent sessions. LLM-generated session summaries, key decisions made, unresolved questions, emotional context. Storage format: vector embeddings of summaries + metadata. Decay is fast — hours to days.

**Semantic memory** holds typed, structured facts that persist across sessions. User preferences, entity relationships, business rules, learned patterns. Storage format: schema-enforced typed properties (NOT unstructured text). This is where accuracy lives.

**Archival memory** stores everything else. Historical data, research reports, market analysis, compliance rules. Storage format: knowledge graph + vector index (hybrid). Structured queries for accuracy, vector search for discovery.

**Crypto example — what goes where:**

```
Working memory:
  "You are a crypto trading assistant..."
  User message: "What's BTC price right now?"
  Retrieved: current BTC price from price feed
  Retrieved: user's portfolio positions (from semantic)

Episodic memory:
  "User asked about BTC/ETH spread arbitrage. Identified 0.8% spread
  between Binance and Kraken. User decided to wait for wider spread."
  Decay rate: half-life ~1.4 days

Semantic memory:
  {entity: "user:alice", risk_tolerance: "moderate", max_position_pct: 10,
   preferred_pairs: ["BTC/USDT", "ETH/USDT"], importance: 0.9}

Archival memory:
  Historical trade records (compliance), market events, research reports
```

## Retrieval: composite scoring

Production retrieval is NOT just vector similarity. It uses composite scoring:

```
final_score = 0.4 × semantic_similarity
            + 0.3 × recency_decay
            + 0.3 × importance_score
```

| Signal | What It Measures | Typical Weight | Purpose |
|--------|-----------------|----------------|---------|
| Semantic similarity | How well does this memory match the query? | 0.4-0.7 | Relevance |
| Recency decay | How fresh is this memory? | 0.2-0.3 | Timeliness |
| Importance | How significant is this memory? | 0.1-0.3 | Criticality |

The recency decay function: `recency_score = e^(-λ × (t_now - t_last_access))`

Where λ controls decay rate. Fast decay (λ=0.5) for episodic, slow decay (λ=0.01) for semantic.

Importance scores assigned at creation time: Critical (0.8-1.0) for user-explicit rules and trading limits, High (0.6-0.8) for business context and preferences, Medium (0.4-0.6) for session summaries, Low (0.1-0.3) for casual mentions.

Pre-filter before search: exclude memories whose decay score < 0.05. Keeps the search space lean.

**Composite scoring example:**

```
Query: "What's Alice's risk tolerance?"

1. Semantic: {risk_tolerance: "moderate"} (importance: 0.9, 2h ago)
   similarity: 0.95, recency: 0.92, importance: 0.9
   final: 0.4×0.95 + 0.3×0.92 + 0.3×0.9 = 0.926

2. Episodic: "Alice asked about aggressive altcoin strategy" (3 days ago)
   similarity: 0.7, recency: 0.37, importance: 0.4
   final: 0.4×0.7 + 0.3×0.37 + 0.3×0.4 = 0.501

Winner: Candidate 1 — correct, authoritative answer.
```

## Forgetting is essential

Production memory systems that never forget degrade in quality over time. Three forgetting mechanisms:

| Mechanism | When | What Happens |
|-----------|------|-------------|
| Time decay | At retrieval | Older memories score lower, surface less often |
| Consolidation | Periodic (hourly/daily) | High-utility episodic → semantic; low-utility → pruned |
| Capacity limits | On write | When buffer full, evict lowest-scoring memories |

Decay rates by tier: Working memory dies at session end. Episodic (recent) half-life is 1-3 days. Episodic (mid-term) is 7-14 days. Semantic is months-years. Archival is indefinite with importance filtering.

**What to keep and what to forget:**

```
Keep forever (semantic):
  User's risk tolerance: "moderate"
  User's position limits: "max 10% per trade"
  Exchange API keys (encrypted)

Keep for days (episodic):
  "User asked about SOL price 2 hours ago"
  "User set BTC price alert at $100K"

Forget after hours (working):
  Raw conversation turns
  Tool call results (unless relevant to future)
  Intermediate reasoning steps

Never forget (archival):
  Historical trade records (compliance)
  Market events (regulatory changes)
  Audit logs
```

**Consolidation loop pattern:**

```
1. Get all episodic memories
2. For each memory, calculate utility
3. If utility > HIGH_THRESHOLD → promote to semantic, remove from episodic
4. If utility < LOW_THRESHOLD → prune from episodic
5. Apply time-decay to all remaining memories
6. Soft delete memories with decay score < threshold
```

## Hallucination prevention: structured vs unstructured retrieval

Vector similarity search returns semantically related content, but semantic similarity does not equal factual accuracy. An agent retrieving "BTC price was $65K" from 3 months ago and presenting it as current is a hallucination.

| Approach | Accuracy | Hallucination Risk | Use Case |
|----------|----------|-------------------|----------|
| Unstructured vector search | Medium | High — can retrieve outdated facts | Discovery, exploration |
| Schema-enforced typed memory | High | Low — structured facts are precise | User preferences, rules, entity data |
| Knowledge graph traversal | Very High | Very Low — graph paths ensure logical consistency | Multi-hop reasoning, relationships |
| Hybrid (vector + graph) | Highest | Lowest | Production systems |

**The Governed Memory approach (99.6% fact recall):** Dual memory model with open-set atomic facts and schema-enforced typed properties. Entity-scoped isolation — memories are tagged to specific entities. Progressive context delivery — inject only relevant memories, not all.

**The Path-Constrained Retrieval approach (100% structural consistency):** Restrict search to nodes reachable from an anchor entity. Prevent retrieval of structurally disconnected information. Ensure all retrieved facts maintain logical relationships.

**Crypto example — hallucination prevention:**

```
BAD (unstructured vector search):
Query: "What's BTC price?"
Vector search returns: "BTC price analysis from March 2026" (semantically similar)
Agent response: "BTC is around $65,000" (outdated — hallucination)

GOOD (structured semantic memory):
Query: "What's BTC price?"
Structured query: SELECT price FROM market_data WHERE symbol='BTC/USDT'
                  AND source='live_feed' ORDER BY timestamp DESC LIMIT 1
Agent response: "BTC is currently $108,450 (as of 2 minutes ago)"

GOOD (knowledge graph):
Query: "What exchange does Alice trade BTC on?"
Graph traversal: Alice → trades_on → [Binance, Kraken]
Agent response: "Alice trades BTC on Binance and Kraken"
```

## The production memory pipeline

```
1. EXTRACTION: Agent interaction → extract facts
   "User said they prefer BTC over ETH" → {type: preference, symbol: BTC}

2. CLASSIFICATION: Assign type and importance
   type: "trading_preference", importance: 0.8

3. STORAGE: Write to appropriate tier
   High importance → semantic memory (typed)
   Session summary → episodic memory (vector)
   Raw text → working memory (context window)

4. RETRIEVAL: Composite scoring at query time
   semantic_similarity + recency_decay + importance → ranked results

5. CONSOLIDATION: Periodic maintenance
   High-utility episodic → promote to semantic
   Low-utility episodic → prune
   Stale semantic → decay, eventually forget

6. FORGETTING: When decay score < threshold
   Soft delete → hard delete after retention period
```

## Crypto system memory architecture

A production crypto trading agent maps each data type to the right layer:

| Data Type | Layer | Storage | Retrieval | Decay |
|-----------|-------|---------|-----------|-------|
| Current BTC price | Working + Live | Ephemeral | Direct read | Instant (stale after seconds) |
| "Alice prefers BTC" | Semantic | Typed JSON | Schema query | Slow (months) |
| "Alice asked about SOL" | Episodic | Vector embed | Semantic search | Fast (days) |
| Trade history | Archival | Knowledge graph | Graph traversal | None (compliance) |
| Risk tolerance | Semantic | Typed JSON | Exact lookup | Never (core preference) |
| Price alert target | Semantic | Typed JSON | Exact lookup | Until triggered |

## Anti-patterns

| Anti-Pattern | Why It Fails | Better Approach |
|-------------|-------------|-----------------|
| Single vector store for everything | No decay, no structure, hallucination-prone | Layered architecture with typed semantic memory |
| Never forgetting | Stale data pollutes responses over time | Time-decay + consolidation + pruning |
| Only vector retrieval | Semantic similarity ≠ factual accuracy | Composite scoring (similarity + recency + importance) |
| Raw conversation as memory | Too much noise, too many tokens | Extract and compress to structured facts |
| No importance scoring | Critical facts buried under trivial ones | LLM-assigned importance at extraction time |
| No entity scoping | Cross-entity data leakage | Entity-tagged memories with scoped queries |

## Open questions

- How do you handle memory conflicts when two agents write contradictory facts to semantic memory?
- What is the optimal composite scoring weight configuration for crypto trading agents specifically?
- How do you ensure memory consistency across distributed agent instances (multi-agent crypto trading)?
- What is the cost-performance tradeoff between vector search and knowledge graph traversal at scale?
- How do you handle real-time price data that changes every second — is it memory or live data?

---

## References

1. Taheri et al. — "Governed Memory: A Production Architecture for Multi-Agent Workflows" (ACL 2026): https://arxiv.org/pdf/2603.17787
2. Brown — "Stratified Context System: A Query-Type-Aware Architecture for AI Agent Memory" (Zenodo 2026): https://doi.org/10.5281/zenodo.19118994
3. Jiang et al. — "MAGMA: A Multi-Graph based Agentic Memory Architecture" (ACL 2026): https://aclanthology.org/2026.acl-long.1709/
4. Talebirad et al. — "Toward a Theory of Hierarchical Memory for Language Agents" (arxiv 2026): https://arxiv.org/pdf/2603.21564
5. Multi-Layer Memory Framework — "Multi-Layered Memory Architectures for LLM Agents" (arxiv 2026): https://arxiv.org/pdf/2603.29194
6. ACL Anthology — "Agentic Memory: Learning Unified Long-Term and Short-Term Memory Management" (ACL 2026): https://aclanthology.org/2026.acl-long.981/
7. Memanto — "Typed Semantic Memory with Information-Theoretic Retrieval" (arxiv 2026): https://arxiv.org/html/2604.22085
8. Memori — "A Persistent Memory Layer for Efficient, Context-Aware LLM Agents" (arxiv 2026): https://arxiv.org/pdf/2603.19935
9. TypeGraph — "Designing Agent Memory That Forgets: Time-Decay Scoring and Memory Consolidation" (April 2026): https://typegraph.ai/blog/agent-memory-time-decay-consolidation
10. Letta/MemGPT — "Context Hierarchy Documentation" (2026): https://docs.letta.com/guides/core-concepts/memory/context-hierarchy/
11. Atlan — "Agentic AI Memory vs Vector Database: Architecture Guide 2026" (April 2026): https://atlan.com/know/agentic-ai-memory-vs-vector-database/
12. reaatech/agent-memory — GitHub (Long-term memory layer with decay and contradiction resolution): https://github.com/reaatech/agent-memory
