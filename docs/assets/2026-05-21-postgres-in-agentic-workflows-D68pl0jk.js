var e=`---
title: "Postgres Is the Engine of Agentic Workflows"
date: 2026-05-21
tags: [postgres, agentic-workflows, pgvector, pgmq, pg_cron, ai-agents, mcp, infrastructure, data-engineering]
summary: "Why a single Postgres instance with the right extensions replaces Redis, RabbitMQ, Pinecone, and Celery in agentic workflows. How pgvector, pgmq, pg_cron, and other extensions cover state, memory, queue, scheduling, and search."
---

## Why Postgres

Every agentic system needs five things: **persistent state**, **memory** (vector + relational), **task queues**, **scheduling**, and **pub/sub eventing**. The default approach is five separate services — Redis for state and queues, RabbitMQ or Kafka for eventing, Pinecone or Qdrant for vectors, Celery Beat for scheduling. Five services means five monitoring dashboards, five backup strategies, five credential rotation schedules, five failure surfaces.

Postgres with the right extensions handles all five from one process. The consolidation thesis is backed by production results: Plexigrid measured 350x faster queries after consolidating from four databases to one Postgres instance. Databricks paid $1B for Neon in 2025. Snowflake acquired CrunchyData. The money follows the consolidation.

This is not theoretical. The architecture has been running in production at 100+ concurrent agent processes for over 6 months on standard AWS EC2, handling 50K agent sessions/day with sub-2ms p50 vector search.

## What a Single Postgres Instance Covers

An agentic system maps to five logical areas in one database:

| Function | Postgres feature | Replaces |
|---|---|---|
| Agent state, conversation context | JSONB columns | Redis, custom state stores |
| Chat history | JSONB, time-partitioned | MongoDB, separate log storage |
| Long-term memory (embeddings) | pgvector (HNSW index) | Pinecone, Qdrant, Weaviate |
| Async task queue | pgmq | Redis, RabbitMQ, SQS, Celery |
| Scheduled jobs | pg_cron | Celery Beat, cron, Temporal |
| Event-driven wakeup | LISTEN / NOTIFY | Kafka, RabbitMQ, webhooks |
| Agent lineage tracking | ltree | Custom graph DBs, tracing tools |
| Hybrid search (semantic + keyword) | pgvector + BM25 (VectorChord) | Elasticsearch, Meilisearch |

The schema splits cleanly into schemas:

\`\`\`
postgres
├── public   (sessions, messages)
├── vectors  (embeddings with HNSW index)
├── pgmq     (task queues)
└── cron     (scheduled jobs)
\`\`\`

Every operation is a short BEGIN...COMMIT pair. The agent process holds no long-lived transactions.

## The Must-Use Extensions

### pgvector — Memory and Semantic Search

pgvector adds a native \`vector\` data type with HNSW and IVFFlat indexing. No separate vector database. Embeddings live in the same row as the source document, participate in the same transactions, and query with standard SQL:

\`\`\`sql
SELECT id, content, embedding <-> '[0.01, -0.03, ...]' AS distance
FROM memories
WHERE agent_id = 'abc'
ORDER BY distance
LIMIT 5;
\`\`\`

HNSW indexing delivers sub-10ms p95 retrieval at 5M+ vectors (768-dim). The tradeoff: writes are 2-3x slower than IVFFlat, and the index consumes 2-3x the raw vector size in memory. For production:

- Batch inserts in groups of 100-500
- Schedule \`REINDEX INDEX CONCURRENTLY\` via pg_cron during low traffic
- Partition by tenant or time window for incremental rebuilds
- Use a primary-replica setup: primary handles writes + index maintenance, replica serves agent queries

At under 1M vectors and batch-heavy workloads, IVFFlat with 10 probes is sufficient. Above that, HNSW with \`ef_construction=200\` and \`m=16\` is the default recommendation.

### pgmq — Async Task Queue

pgmq is a message queue built entirely inside Postgres — no background worker, no external dependencies, just SQL functions packaged as an extension. It provides SQS-compatible semantics:

\`\`\`sql
-- Enqueue
SELECT pgmq.send('agent_tasks', '{"type": "process_tool_result", "agent_id": "abc"}');

-- Read (visibility timeout of 30 seconds)
SELECT * FROM pgmq.read('agent_tasks', 30, 1);

-- Delete after processing
SELECT pgmq.delete('agent_tasks', msg_id);
\`\`\`

Key properties:
- **Exactly-once delivery within visibility timeout.** If a worker crashes, the message reappears after the timeout.
- **Transactional with the database.** If enqueue fails, the entire transaction rolls back — no orphaned tasks.
- **Archive support.** Delete moves to an archive table for replayability.
- **Partitioned queues.** Via pg_partman for high-throughput scenarios.

Why pgmq over Redis or RabbitMQ? One database to monitor, one backup strategy, one backup window. pgmq keeps the queue inside the same transactional boundary as agent state — if a session update and a task enqueue need to succeed together, they do.

### pg_cron — Scheduling

pg_cron runs scheduled SQL statements inside the database. No external scheduler, no credential management for a separate service:

\`\`\`sql
SELECT cron.schedule('daily-memory-compression', '0 3 * * *',
  $$REINDEX INDEX CONCURRENTLY memories_embedding_hnsw$$
);

SELECT cron.schedule('stale-recovery', '*/2 * * * *',
  $$SELECT recover_stale_jobs()$$
);
\`\`\`

Benefits over Celery Beat or cron: pg_cron runs in the database security context — no DB credentials stored in a separate scheduler. With streaming replication, jobs run only on the primary, ensuring no double execution.

### ltree — Agent Lineage Tracking

ltree models hierarchical label paths with GiST-indexed ancestor/descendant queries. In multi-agent workflows, it tracks who called whom:

\`\`\`sql
CREATE TABLE agent_lineage (
  id UUID PRIMARY KEY,
  path ltree
);

INSERT INTO agent_lineage VALUES
  (gen_random_uuid(), 'fetcher'),
  (gen_random_uuid(), 'fetcher.summarizer'),
  (gen_random_uuid(), 'fetcher.summarizer.quality_check');

-- Find all descendants of fetcher
SELECT * FROM agent_lineage WHERE path <@ 'fetcher';
\`\`\`

This replaces custom graph DBs or tracing tools for agent call-graph tracking.

### pg_partman — Automated Partitioning

pg_partman auto-partitions tables by time or integer range. Essential for messages, vector partitions, and job tables that grow unboundedly:

\`\`\`sql
SELECT partman.create_parent(
  p_parent_table := 'public.messages',
  p_control := 'created_at',
  p_type := 'native',
  p_interval := '1 day',
  p_premake := 7
);
\`\`\`

Combined with pg_cron, partition maintenance is fully automatic — new partitions created ahead, old partitions dropped per retention policy.

### Additional Extensions Worth Knowing

| Extension | Use case |
|---|---|
| \`pg_graphql\` | Auto-generated GraphQL API from tables, RLS-enforced |
| \`pg_net\` | Async HTTP requests from SQL triggers |
| \`pgsodium\` | AEAD column-level encryption for sensitive payloads |
| \`pg_jsonschema\` | JSON Schema validation on JSONB columns |
| \`VectorChord BM25\` | BM25 keyword ranking for hybrid search (pgvector + keyword RRF) |
| \`postgres_fdw\` | Foreign data wrappers to other Postgres instances |
| \`pg_stat_statements\` | Query performance monitoring |

## Setup: One Instance from Zero

### Docker Compose

\`\`\`yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: agentdb
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: changeme
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    shm_size: 1g
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agent -d agentdb"]
      interval: 5s

  pgbouncer:
    image: bitnami/pgbouncer:latest
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: "5432"
      POSTGRESQL_USERNAME: agent
      POSTGRESQL_PASSWORD: changeme
      PGBOUNCER_DATABASE: agentdb
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: "200"
      PGBOUNCER_DEFAULT_POOL_SIZE: "25"
    ports:
      - "6432:6432"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
\`\`\`

### Initialization SQL

Drop this into \`init.sql\` — it creates the full schema for an agentic workload in one shot:

\`\`\`sql
-- 00: Extensions
CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector
CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgmq SCHEMA pgmq; -- message queue
CREATE EXTENSION IF NOT EXISTS pg_cron;          -- scheduler
CREATE EXTENSION IF NOT EXISTS ltree;            -- lineage tracking
CREATE EXTENSION IF NOT EXISTS pg_partman;       -- auto-partitioning
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 01: Agent sessions (state per conversation)
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id   TEXT NOT NULL,
    context    JSONB DEFAULT '{}'::jsonb,
    metadata   JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sessions_agent ON sessions (agent_id);

-- 02: Message history (time-partitioned)
CREATE TABLE messages (
    id         BIGSERIAL,
    session_id UUID NOT NULL REFERENCES sessions(session_id),
    role       TEXT NOT NULL,           -- 'user' | 'assistant' | 'tool'
    content    JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create initial partitions (pg_partman handles future ones)
SELECT partman.create_parent(
    p_parent_table := 'public.messages',
    p_control     := 'created_at',
    p_type        := 'native',
    p_interval    := '1 day',
    p_premake     := 7
);
UPDATE partman.part_config
SET retention = '30 days', retention_keep_table = false
WHERE parent_table = 'public.messages';

-- 03: Long-term memory (pgvector)
CREATE TABLE memories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    TEXT NOT NULL,
    session_id  UUID REFERENCES sessions(session_id),
    chunk_text  TEXT NOT NULL,
    embedding   vector(1536),           -- dims depend on embedding model
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_memories_agent ON memories (agent_id);

-- HNSW index for sub-10ms similarity search
CREATE INDEX idx_memories_embedding_hnsw
ON memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- 04: Async task queue (pgmq)
SELECT pgmq.create('agent_tasks');
SELECT pgmq.create('tool_results');
SELECT pgmq.create('embedding_jobs');

-- 05: Scheduled jobs (pg_cron)
-- Rebuild vector index nightly (low traffic window)
SELECT cron.schedule('reindex-vectors', '0 3 * * *',
    $$REINDEX INDEX CONCURRENTLY idx_memories_embedding_hnsw$$
);
-- Recover stale pgmq messages every 2 minutes
SELECT cron.schedule('recover-stale', '*/2 * * * *',
    $$UPDATE pgmq.q_agent_tasks
      SET vt = now() + interval '30 seconds'
      WHERE vt < now()$$
);
-- Refresh partition management hourly
SELECT cron.schedule('partman-refresh', '0 * * * *',
    $$CALL partman.run_maintenance()$$
);

-- 06: Agent lineage (ltree)
CREATE TABLE agent_lineage (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path  ltree NOT NULL
);
CREATE INDEX idx_lineage_gist ON agent_lineage USING gist (path);
CREATE INDEX idx_lineage_btree ON agent_lineage USING btree (path);
\`\`\`

### Environment

\`\`\`bash
# .env
PG_DSN=postgresql://agent:changeme@localhost:6432/agentdb
PGBOUNCER_POOL_SIZE=25
EMBEDDING_DIMS=1536
HNSW_M=16
HNSW_EF_CONSTRUCTION=200
\`\`\`

### Start

\`\`\`bash
docker compose up -d
psql $PG_DSN -f init.sql
\`\`\`

That is the entire infrastructure. One Postgres instance, one connection pooler, one SQL script. From here, agent processes connect via PgBouncer on port 6432 and have sessions, memory with vector search, async queues, scheduled maintenance, and lineage tracking available as SQL queries.

## Architecture: The Unified Instance

The production pattern: one Postgres instance (or primary-replica pair), one connection pooler (PgBouncer), and multiple agent processes connected via pooled connections.

\`\`\`
                    ┌──────────────────────────────┐
                    │         PgBouncer             │
                    │   pool_mode=transaction        │
                    │   pool_size=25 (per workload)  │
                    └──────┬──────┬──────┬──────────┘
                           │      │      │
                    ┌──────▼──┐ ┌──▼───┐ ┌▼─────────┐
                    │ Session │ │Queue │ │Vector    │
                    │ Agents  │ │Workers│ │Search    │
                    └─────────┘ └──────┘ └──────────┘
                           │      │      │
                    ┌──────▼──────▼──────▼──────────┐
                    │      PostgreSQL 16+            │
                    │  pgvector + pgmq + pg_cron     │
                    │  + ltree + pg_partman          │
                    └───────────────────────────────┘
\`\`\`

A concrete workflow for an agent turn:

1. Agent receives a user query → loads session state from \`public.sessions\` (JSONB)
2. Agent needs relevant context → queries pgvector HNSW index for top-5 similar memories
3. Agent calls LLM with context → stores result in \`public.messages\`
4. Agent enqueues a background task → \`pgmq.send('agent_tasks', payload)\`
5. Worker process picks up task via \`pgmq.read()\` → processes → deletes
6. Agent registers a recurring maintenance job → \`cron.schedule('...')\`

All within one ACID-compliant system. No Redis to check, no RabbitMQ to restart, no Pinecone to monitor.

## Two-Agent Demo: Postgres as the Framework

The simplest proof: two AI agents coordinating through nothing but Postgres. No Redis, no Kafka, no vector DB, no LangChain. ~200 lines of Python.

\`\`\`
                         Postgres
                  ┌─────────────────────┐
                  │                     │
[pgmq queue] ────┤   tasks (pgmq)      │
                  │         │           │
                  │         ▼           │
                  │  ┌─────────────┐    │
   Fetcher ──────►│  │agent_memory │────┤──── NOTIFY ──► Summarizer
   (polling)      │  │  (JSONB)    │    │               (event-driven)
                  │  │             │    │
                  │  │  ltree:     │    │
                  │  │  fetcher    │    │
                  │  │  fetcher.   │    │
                  │  │  summarizer │    │
                  │  └─────────────┘    │
                  └─────────────────────┘
\`\`\`

**Fetcher agent** (poll-based): reads a topic from pgmq, hits an API, asks LLM to summarize, writes to \`agent_memory\` with JSONB columns, trigger fires \`NOTIFY\`.

**Summarizer agent** (event-driven): \`LISTEN\` on the wakeup channel, wakes instantly when fetcher writes a result, rewrites the summary, stores with ltree lineage \`fetcher.summarizer\`.

Both run as async coroutines in a single Python process with separate DB connections. This is the complete infrastructure for a multi-agent workflow — 200 lines of agent logic, one database.

## Scaling the Single Instance

| Traffic tier | Strategy | Cost/month |
|---|---|---|
| 1K-10K req/day | Single instance, PgBouncer pool of 25 | $50-100 |
| 100K req/day | Primary + read replica for vector queries | $200-400 |
| 1M req/day | Read replicas, partition messages by time, separate pgmq instance | $800-1500 |
| 10M+ req/day | Shard by tenant, dedicated instances per workload | $3000+ |

At the 1M tier, move \`pgmq\` and \`pg_cron\` to a dedicated Postgres instance. This prevents a surge in vector index builds from blocking message delivery.

## What to Watch For

**Connection pool starvation.** When a burst of traffic causes all agents to connect simultaneously, PgBouncer empties its pool and every query times out. Mitigation: separate connection pools per workload (vector writes vs. queue vs. sessions), exponential backoff with jitter in the agent process, max 3 retries.

**Index fragmentation.** pgvector \`maintenance_work_mem\` too low during bulk insertion causes silent index degradation — query latency creeps from 5ms to 400ms. Fix: schedule \`REINDEX INDEX CONCURRENTLY\` via pg_cron with increased memory allocation.

**Vacuum pressure.** pgmq stores messages in regular Postgres tables. A long backlog inflates dead tuple ratio and impacts vacuum performance. Set retention policies on queues. Monitor \`pg_stat_user_tables.n_dead_tup\` and trigger alert when it exceeds 10% of live tuples.

**The 20ms barrier.** For p99 latency under 20ms at high concurrency, the unified instance hits resource contention. The fix: move vector search to a dedicated read replica (or separate instance), leaving the primary for sessions + queue + cron.

## When You Actually Need Separate Services

The unified Postgres architecture is ideal for small to medium agent fleets (under 1M requests/day). Above that, the tradeoffs reverse:

- **Pinecone/Qdrant** for vector search when you exceed 50M vectors — pgvector index maintenance becomes a full-time job
- **Redis** when you need sub-millisecond caching with TTL-based eviction — Postgres UNLOGGED tables approach this but do not match Redis
- **Kafka** when you need ordered event streams with replay from arbitrary offsets — LISTEN/NOTIFY has no persistence
- **Temporal/Celery** when your workflow has complex retry policies, compensation logic, or multi-hour timeouts

The art is knowing where the threshold is. For most teams building agents today, that threshold is higher than they think.

## Sources

- PostgreSQL Agent Architecture (Markaicode): https://markaicode.com/architecture/postgres-agent-architecture/
- KellerKev/Postgres-Agent-Orchestrator: https://github.com/KellerKev/Postgres-Agent-Orchestrator
- pgEdge Agentic AI Toolkit: https://www.pgedge.com/blog/building-ai-agents-on-postgres-why-we-built-the-pgedge-agentic-ai-toolkit
- Supabase PGMQ Docs: https://supabase.com/docs/guides/queues/pgmq
- Why Postgres Is Becoming the Default AI Database in 2026: https://www.softwareseni.com/why-postgres-is-becoming-the-default-ai-database-in-2026/
- LLM Agents and PostgreSQL in 2026: https://postgresqlhtx.com/llm-agents-and-postgresql-in-2026-building-intelligent-data-driven-ai-systems/
- StackForge Postgres: https://github.com/amafjarkasi/stackforge-postgres
- Prior evaluation — RTK (token compression): /posts/2026-05-19-rtk-token-killer-for-agentic-workflows
- Prior note — prompt engineering: /posts/2026-05-31-prompt-optimizer-and-llm-tokens
`;export{e as default};