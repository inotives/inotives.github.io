var e=`---
title: "PostgreSQL Huge Pages: The 512x Reduction You're Probably Not Using"
date: 2026-07-06
tags: [postgresql, huge-pages, linux-kernel, performance-tuning, memory-management, data-engineering]
summary: "PostgreSQL huge pages replace 4KB memory pages with 2MB pages, reducing page-table entries by 512x and cutting per-backend RAM overhead from 200MB to tens of-MB. For a 100GB shared_buffers with 100 connections, that's ~20GB of RAM reclaimed. Configuration is two steps: reserve at Linux level, enable in postgresql.conf. The critical detail: use huge_pages=on, not try."
series: data-engineering
---

# PostgreSQL Huge Pages: The 512x Reduction You're Probably Not Using

PostgreSQL keeps its entire buffer cache — \`shared_buffers\` — in a single shared memory region. Every backend process maps this same memory through its own page tables. With standard 4KB pages, a 100GB \`shared_buffers\` creates roughly 26 million page-table entries per backend.

That's 200MB of RAM per backend, spent entirely on bookkeeping. With 100 connections, you're burning 20GB on page tables alone. And that's before any actual query runs.

Huge pages fix this. One config change, 512x fewer page-table entries, 5-30% throughput gain. No SQL changes required.

## How the TLB Bottleneck Works

The TLB (Translation Lookaside Buffer) is a CPU cache that stores virtual-to-physical address translations. Modern CPUs have around 1,500-4,000 TLB entries across levels. With 4KB pages:

- 1,500 entries × 4KB = **6MB of memory covered**
- On a 100GB buffer pool, TLB covers 0.006%
- First buffer touched outside that 6MB = TLB miss = tens of CPU cycles wasted on a page-table walk

With 2MB huge pages:

- 1,500 entries × 2MB = **3GB of memory covered**
- TLB covers 3% of the buffer pool — 512x improvement
- Hot working set stays in TLB, no page-table walks

The CPU spends less time figuring out where data lives and more time actually processing it.

## Why PostgreSQL Amplifies the Problem

Other databases handle this differently. PostgreSQL's architecture makes page-table overhead worse:

1. **Single shared memory region**: \`shared_buffers\` is one contiguous segment, not split per table or database
2. **Fork-based concurrency**: Every backend is a forked process with its own page tables
3. **Every backend maps the same memory**: 100 connections = 100 copies of page tables for the same \`shared_buffers\`
4. **Buffer pool is the hottest data structure**: Almost every query touches it

More connections means more page-table overhead. This is why huge pages become critical as connection count grows.

## Static HugeTLB vs Transparent Huge Pages

This distinction causes most confusion, and getting it wrong causes real problems.

**Static HugeTLB** (what PostgreSQL's \`huge_pages=on\` uses) reserves pages explicitly at boot or via sysctl. The pages are pre-allocated, never fragmented, and guaranteed to be available. If not enough pages exist, PostgreSQL refuses to start — a loud, correctable failure.

**Transparent Huge Pages (THP)** lets the kernel coalesce 4KB pages into 2MB pages in the background. The kernel's \`khugepaged\` thread defragments memory silently, which can cause multi-second pause events in PostgreSQL. THP is not equivalent to static huge pages.

| Aspect | Static HugeTLB | THP |
|--------|---------------|-----|
| Control | Application requests via \`MAP_HUGETLB\` | Kernel does it silently |
| Guarantee | Pages pre-allocated, never fragmented | Pages may be reclaimed, fragmented |
| PostgreSQL support | Official \`huge_pages\` GUC | Not recommended |
| Failure mode | Startup failure (loud) | Silent performance degradation |

Set THP to \`madvise\` so it only applies to processes that explicitly request it:

\`\`\`bash
echo madvise > /sys/kernel/mm/transparent_hugepage/enabled
echo defer+madvise > /sys/kernel/mm/transparent_hugepage/defrag
\`\`\`

## Configuration: Two Steps

### Step 1: Reserve Huge Pages at Linux Level

Calculate how many pages you need:

\`\`\`bash
# PostgreSQL 15+ gives you the answer directly:
postgres -D $PGDATA -C shared_memory_size_in_huge_pages

# Or manually: shared_buffers / huge_page_size + ~5% overhead
# For 32GB shared_buffers with 2MB pages:
# 32768MB / 2MB = 16384 pages + overhead ≈ 17000 pages
\`\`\`

Reserve them:

\`\`\`bash
# Runtime (may fail on fragmented systems):
sysctl -w vm.nr_hugepages=17000

# Persistent:
echo 'vm.nr_hugepages = 17000' > /etc/sysctl.d/10-postgres-hugepages.conf
sysctl --system
\`\`\`

For production, reserve at boot instead (more reliable on fragmented systems):

\`\`\`bash
# In /etc/default/grub:
hugepagesz=2M hugepages=17000
\`\`\`

Allow PostgreSQL to use the reserved pages:

\`\`\`bash
# Preferred:
echo "vm.hugetlb_shm_group = $(id -g postgres)" > /etc/sysctl.d/hugepages.conf
sysctl --system
\`\`\`

### Step 2: Configure PostgreSQL

\`\`\`sql
-- postgresql.conf
shared_buffers = '32GB'
huge_pages = on        -- NOT 'try'
\`\`\`

The \`huge_pages\` GUC has three values:

| Value | Behavior |
|-------|----------|
| \`off\` | Never use huge pages |
| \`try\` | Try huge pages, fall back to 4KB silently |
| \`on\` | Require huge pages, fail startup if unavailable |

**Use \`on\` in production.** The \`try\` failure mode is "running fine, half the throughput, no alert." The \`on\` failure mode is "won't start, fix it now." A loud failure is always better than silent degradation.

## Deployment Cookbook

### Bare Metal / Dedicated Server

\`\`\`bash
# Calculate and reserve
hugepages=$(($(psql -tAc "SELECT current_setting('shared_buffers')::bigint / 1024 / 1024") + 1700))
echo "vm.nr_hugepages = $hugepages" > /etc/sysctl.d/10-postgres-hugepages.conf
sysctl --system

# Configure PostgreSQL: huge_pages = on

# Verify
grep -E 'HugePages_Total|Hugepagesize' /proc/meminfo
psql -c "SHOW huge_pages"
\`\`\`

### Kubernetes / Containers

Two conditions must be met:

1. The **host** must have huge pages reserved (via kernel command line, daemonset, or node-init script)
2. The **pod spec** must request them:

\`\`\`yaml
resources:
  limits:
    memory: 128Gi
    hugepages-2Mi: 96Gi
  requests:
    memory: 128Gi
    hugepages-2Mi: 96Gi
\`\`\`

Operators like CloudNativePG, StackGres, and Zalando Postgres Operator handle this if configured correctly.

### Managed Services (RDS, Aurora, Cloud SQL)

You cannot set this yourself. The vendor handles it. Pick memory-optimized instance classes and trust the provider. If you suspect issues, open a support ticket.

## 2MB vs 1GB Pages

For most production systems, 2MB pages are sufficient. 1GB pages only make sense for the largest instances:

| Aspect | 2MB Pages | 1GB Pages |
|--------|-----------|-----------|
| TLB reduction vs 4KB | 512x | 262,144x |
| Allocation | Runtime (on unfragmented host) | Boot-time only |
| Use case | Most production systems | \`shared_buffers\` > 256GB |
| Operational complexity | Low | Medium |

Use 2MB pages for everything up to roughly 256GB \`shared_buffers\`. 1GB pages only for the largest instances where TLB misses are still a measurable variable.

## Verification Checklist

\`\`\`bash
# 1. Reservation is in place:
grep -E 'HugePages_Total|Hugepagesize' /proc/meminfo
# HugePages_Total: 17000
# Hugepagesize:       2048 kB

# 2. PostgreSQL is using them:
psql -c "SHOW huge_pages"
# huge_pages | on

# 3. Reservation dropped when Postgres started:
grep HugePages_Free /proc/meminfo
# HugePages_Free:  <should be smaller than HugePages_Total>

# 4. Postgres is NOT silently on 4KB pages:
awk '/VmPeak|VmHWM|HugetlbPages/' /proc/$(pgrep -o postgres)/status
# HugetlbPages:   <should be multiple GB; if 0, you are on 4KB pages>
\`\`\`

The last check matters most. \`HugetlbPages: 0\` on the postmaster process means \`huge_pages = try\` fell back and nothing told you. Put this in a monitoring script.

## When Huge Pages Aren't Worth It

- \`shared_buffers\` < 2GB — TLB reach isn't the bottleneck
- Development/CI machines — startup failures worse than performance loss
- Shared-tenancy hosts — cannot reserve memory exclusively

## Why This Matters for Agentic Workflows

If you're using Postgres as the backend for agentic memory — pgvector for embeddings, pgmq for task queues, JSONB for conversation state — huge pages become more than a tuning knob. They address a structural problem with how agentic systems use the database.

**The connection pattern is the problem.** Agentic workflows create many concurrent backend processes. Each agent process is a short-lived Postgres connection: poll a queue, read embeddings, write state, close. At 100 concurrent agents, that's 100 backends, each maintaining its own page tables for \`shared_buffers\`. The page-table overhead scales linearly with connection count.

**Vector search is memory-heavy.** HNSW indexes for pgvector consume 2-3x the raw vector size in memory. A 5M vector index at 768 dimensions is roughly 15GB of index data. With 4KB pages, that's millions of page-table entries per backend just for the index. Every nearest-neighbor query touches this data. TLB misses during vector search waste CPU cycles on address translation instead of distance computation.

**The buffer pool is always hot.** Agentic memory systems have a specific access pattern: recent conversations, active task queues, and frequently queried embeddings stay in \`shared_buffers\`. This is exactly the workload where TLB coverage matters most. The hot working set fits in TLB with huge pages; without them, every cache miss triggers a page-table walk.

The math for a typical agentic Postgres setup:

- 32GB \`shared_buffers\` (embeddings + state + queues)
- 100 concurrent agent connections
- Without huge pages: ~13GB RAM wasted on page tables alone
- With huge pages: tens of MB total

That reclaimed RAM can go toward larger \`shared_buffers\`, more embeddings, or higher connection limits. The throughput gain (5-20% on OLTP, up to 30% on analytical queries) means agents spend less time waiting on the database and more time doing actual work.

If your agentic system uses Postgres for memory, huge pages are not optional. They're the difference between the database being the bottleneck and the database staying out of the way.

## Performance Impact

| Metric | Without | With | Improvement |
|--------|---------|------|-------------|
| Page-table entries (100GB) | ~26 million | ~51 thousand | 512x fewer |
| Page-table RAM per backend | ~200MB | Tens of MB | 10-20x less |
| 100 connections page-table RAM | ~20GB | Tens of MB | 200-600x less |
| TLB coverage | ~6MB | ~3GB | 512x more |
| OLTP throughput | Baseline | +5-20% | Significant |
| OLAP throughput | Baseline | Up to +30% | Significant |

Huge pages don't make PostgreSQL write faster. They make PostgreSQL spend less CPU figuring out where to write. The bottleneck shifts from CPU memory translation to WAL I/O and storage, which is where it should be.

## References

- [PostgreSQL Documentation — Managing Kernel Resources](https://www.postgresql.org/docs/current/kernel-resources.html)
- [PostgreSQL Documentation — Resource Consumption](https://www.postgresql.org/docs/current/runtime-config-resource.html)
- [The Build — Huge Pages, End to End](https://thebuild.com/blog/2026/04/24/huge-pages-end-to-end/)
- [Stormatics — Configuring Linux Huge Pages for PostgreSQL](https://stormatics.tech/blogs/configuring-linux-huge-pages-for-postgresql)
- [JusDB — PostgreSQL Huge Pages: Linux Configuration](https://www.jusdb.com/blog/postgresql-huge-pages-linux-configuration)
- [Kernel Internals — Databases: Linux Kernel Internals](https://kernel-internals.org/mm/tuning-databases/)
- [Percona — Benchmark PostgreSQL With Linux HugePages](https://www.percona.com/blog/benchmark-postgresql-with-linux-hugepages/)
- [Postgres Is the Engine of Agentic Workflows](https://inotives.github.io/posts/2026-05-21-postgres-in-agentic-workflows) — Using pgvector, pgmq, pg_cron for agent memory and task queues
`;export{e as default};