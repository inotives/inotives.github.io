---
title: "Turso: SQLite Rewritten in Rust — And Why I'm Evaluating It for strata-memory"
date: 2026-06-23
tags: [turso, sqlite, rust, database, embedded-database, strata-memory, mvcc, io-uring, wasm, ai-agents]
summary: "Turso is a ground-up Rust rewrite of SQLite that adds concurrent writes, async I/O, WebAssembly-first design, vector search, and an MCP server for AI agents. I'm not using it yet — but I'm evaluating it for strata-memory, where SQLite indexing is the bottleneck when markdown files grow past 1,000."
---

# Turso: SQLite Rewritten in Rust — And Why I'm Evaluating It for strata-memory

SQLite is the most deployed database in history. It's in every phone, every browser, every embedded device. It's written in C, it's battle-tested, and it works.

Turso is a ground-up rewrite of SQLite in Rust. Same file format. Same SQL dialect. But with capabilities SQLite can't easily add: concurrent writes, async I/O, WebAssembly-first design, vector search, and a built-in MCP server for AI agents.

I'm not using it yet. But I'm evaluating it for strata-memory, where SQLite indexing is the bottleneck when markdown files grow past 1,000.

## Why Rewrite SQLite?

Turso started as libSQL — a fork of SQLite. After 2 years and 13k stars, the project hit a ceiling:

- **SQLite's test suite is proprietary.** You can't verify your fork's correctness against the original tests. Making large-scale changes is terrifying.
- **C is memory-unsafe.** Evolving a C codebase with confidence is fundamentally harder. Every change risks use-after-free, buffer overflows, undefined behavior.
- **Fork velocity ceiling.** libSQL attracted contributions to remote execution code, but deep core database contributions were rare. The fork model couldn't generate the activation energy for community-driven evolution.

The trigger: adding vector search to libSQL required invasive bytecode changes. The SQL syntax they wanted wasn't achievable without rewriting core internals. So they rewrote it in Rust. Without marketing, it organically reached 1,000 stars and 30 contributors. The community response proved the idea had legs.

## The Architectural Differences

| Dimension | SQLite | Turso |
|---|---|---|
| **Language** | C (unsafe) | Rust (memory-safe) |
| **I/O Model** | Synchronous (blocking) | Async-first (io_uring on Linux) |
| **Concurrency** | Single-writer lock | MVCC (`BEGIN CONCURRENT`) |
| **WASM Support** | Afterthought | First-class (designed from day 1) |
| **Testing** | Proprietary test suite | DST + Antithesis |
| **MCP Server** | None | Built-in (9 tools for AI assistants) |
| **Vector Search** | No native support | Native (data type + index + SQL syntax) |

## What Turso Adds Over SQLite

**Concurrent writes (MVCC).** SQLite uses a single-writer lock — only one transaction can write at a time. Turso implements Multi-Version Concurrency Control, enabling `BEGIN CONCURRENT` for multiple simultaneous writers. For a system like strata-memory where multiple agents might write knowledge entries, this matters.

**Async I/O with io_uring.** SQLite's `sqlite3_step()` blocks until data is ready. That's fine for simple local queries. But when queries involve large aggregations, remote data, or network round trips, blocking is a problem. Turso extends `sqlite3_step()` to be async, returning to the caller if data isn't ready.

**WebAssembly first.** SQLite can compile to WASM, but it's an afterthought. Turso was designed from day 1 for WASM — browser support with OPFS persistence, VFS implementation that works with Drizzle ORM out of the box.

**Native vector search.** SQLite has no native vector support. Turso adds vectors as a first-class data type with `vector_distance_cos()` and integrated indexes. For agent memory systems that need semantic search, this is interesting.

**Built-in MCP server.** Turso's CLI includes a Model Context Protocol server (`tursodb --mcp`) with 9 tools for AI assistants. Designed for the "many-database architecture" where each AI agent gets its own database.

**Deterministic Simulation Testing.** SQLite's correctness is validated by its proprietary test suite. Turso uses DST (inspired by TigerBeetle) — simulates years of execution with different event orderings, reproducing issues 100% reliably. Plus an Antithesis partnership for deterministic hypervisor testing.

## What SQLite Still Does Better

- **Maturity.** 24+ years of production use across billions of devices. Turso is explicitly beta.
- **Full C API coverage.** Turso's C API compatibility is partial — many advanced APIs still stubbed.
- **WITH RECURSIVE.** Not yet supported in Turso.
- **WINDOW functions.** Only `row_number()` and aggregate `OVER()` work.
- **Ecosystem.** SQLite has vast tooling, documentation, and institutional knowledge.

## Why I'm Evaluating It for strata-memory

The use case is simple. strata-memory stores knowledge as markdown files. SQLite is just the index — FTS5 full-text search over those files. The markdown is the source of truth. SQLite is the derived artifact.

That simplicity is why Turso is interesting. I don't need a full database replacement. I need a better index.

**Concurrency is the number one reason.** Right now, when multiple agents write knowledge entries at the same time, SQLite's single-writer lock forces serialization. One agent writes while the others wait. With Turso's MVCC (`BEGIN CONCURRENT`), multiple agents can write simultaneously without external locking. That's the bottleneck I'm hitting.

**The simplicity of the use case helps.** Since SQLite is only the index, switching to Turso is low risk. The markdown files stay the same. The index is rebuildable from markdown if anything goes wrong. The worst case is reverting to SQLite — I rebuild the index and keep going.

**Vector search is a plus.** FTS5 is good for keyword search, but knowledge entries often need semantic search — "find entries about agent identity" should match entries that discuss DIDs, verifiable credentials, and blockchain anchoring, even if they don't use the exact phrase "agent identity." Turso's native vector search could improve accuracy over FTS5 for this kind of query.

## The Open Questions

- Will Turso achieve SQLite-level reliability? The team says their bar is "SQLite-level reliability" and they're not there yet.
- How will the libSQL-to-Turso migration work for existing users?
- Will the MVCC implementation handle all edge cases? It's still experimental.
- Can Turso's async I/O match SQLite's synchronous performance for simple local queries?

## The Bottom Line

SQLite is the gold standard for embedded databases. Turso is a modern rewrite that adds what SQLite can't easily add — concurrency, async I/O, WASM-first design, vector search, MCP integration.

For strata-memory, the question is: does the scaling benefit justify the maturity risk? I'm evaluating. The answer might be "not yet" — or it might be "for the indexing layer only, keep SQLite for the core."

Either way, it's worth watching. The "many-database architecture" thesis is compelling, and Turso is building the database for it.

---

## References

- [Turso GitHub](https://github.com/tursodatabase/turso) — 21.8k stars, MIT license
- [Why Rewrite SQLite](https://turso.tech/blog/we-will-rewrite-sqlite-and-we-are-going-all-in) — The motivation behind the Rust rewrite
- [Introducing Limbo](https://turso.tech/blog/introducing-limbo-a-complete-rewrite-of-sqlite-in-rust) — The original announcement
- [Databases Will Be Free](https://turso.tech/blog/databases-will-be-free) — The "many-database architecture" thesis
- [Turso AGENTS.md](https://github.com/tursodatabase/turso/blob/main/AGENTS.md) — Architecture, testing, core principles
- [Turso COMPAT.md](https://github.com/tursodatabase/turso/blob/main/COMPAT.md) — Detailed compatibility tracking
- [strata-memory](https://github.com/inotives/strata-memory) — Our current SQLite-based agent memory system
