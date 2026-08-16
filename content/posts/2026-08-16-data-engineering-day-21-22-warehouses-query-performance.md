---
title: "Data Engineering in 30 Days, Days 21–22: Warehouses and Query Performance"
date: 2026-08-16
tags: [data-engineering, learning-path, data-warehouse, query-performance]
summary: "Practical warehouse and query-performance guidelines: choose the right table grain, reduce scanned data, use partitions, clustering, and indexes deliberately, read plans, and optimise from measured evidence."
series: data-engineering-in-30-days
---

Most slow data queries are not fixed by a clever index. They are fixed by asking a smaller, more precise question of a model with the right grain.

Warehouses make it easy to query years of history, join many tables, and aggregate millions of rows. That convenience can hide the cost of scanning too much data, joining at the wrong grain, shuffling large intermediate results, or rebuilding tables that should be incremental. Days 21–22 establish a practical way to reason about those trade-offs.

The examples use a market-data warehouse with price observations, markets, providers, and daily marts. The guidelines apply equally to product events, payments, support tickets, and application logs.

## The outcome for these two days

By the end, you should be able to:

1. Explain why analytical warehouses differ from operational databases.
2. Estimate what makes a query expensive before running it at full scale.
3. Choose partitions, clustering keys, and indexes from real access patterns.
4. Read a query plan as evidence, not decoration.
5. Improve query cost or latency without changing the meaning of the result.

## 1. A warehouse is built for analytical work

An operational database is designed around frequent, small transactions: create a user, update an order, fetch the latest balance. A warehouse or analytical engine is designed around reading many records, scanning selected columns, joining history, and calculating aggregates.

The technology varies. BigQuery and Snowflake separate storage and compute. ClickHouse is a column-oriented analytical database. PostgreSQL can serve analytical workloads at a smaller scale or as part of a mixed system. The engineering questions are shared:

```text
How much data does this query need to read?
Which rows can be skipped early?
Which columns can be skipped?
How large are intermediate joins and sorts?
How often must this result be rebuilt?
What does the team pay: bytes scanned, compute time, concurrency, or all three?
```

Do not choose a warehouse because it sounds more advanced than the current database. Choose it when the workload needs analytical storage, isolation, scale, concurrency, or managed operations that the current system cannot provide credibly.

## 2. Start with grain and access patterns

Before partitioning or indexing a table, write down two things:

```text
Table grain: one row per provider market per observation time.
Common questions: recent prices for one market, daily aggregates by provider,
                  monthly market comparison, and late-data reconciliation.
```

The grain tells you why rows exist. The access patterns tell you how the table will be read. A storage design that is excellent for “one market over the last day” may be poor for “all providers over five years.” There is no single physical layout that makes every query free.

For `fct_price_observation`, a useful first access pattern matrix might be:

| Question | Typical filter | Typical output | Performance implication |
| --- | --- | --- | --- |
| Latest price per market | Recent time, one provider or market | Few rows | Time pruning and a selective market lookup help. |
| Daily provider report | One or several dates | Grouped aggregate | A daily mart may be cheaper than scanning observations. |
| Historical asset chart | One market, long date range | Ordered series | Time and market ordering matter. |
| Data-quality check | Recent receipt time, all active providers | Counts and missing pairs | A small freshness or completeness mart may be enough. |
| Backfill reconciliation | One historical time range | Source-target comparison | Partition-level reads and stable keys matter. |

This table is more valuable than guessing a “best” index before users have asked any questions.

## 3. Read less data first

The most portable performance rule is to reduce rows and columns before expensive work. Start with these habits:

| Guideline | Why it helps | Example |
| --- | --- | --- |
| Select named columns | Columnar engines can avoid reading unused columns; every engine returns less data. | Use `symbol, observed_at, price`, not `SELECT *`. |
| Filter early | Fewer rows enter joins, sorts, and aggregates. | Restrict a report to one date range before joining dimensions. |
| Use sargable predicates | Let the engine use partition metadata or indexes. | Compare `observed_at` directly rather than wrapping it in a function. |
| Aggregate at the needed grain | Avoid carrying raw event rows into a dashboard that needs daily totals. | Query `mart_daily_market_price` for daily charts. |
| Avoid accidental fan-out joins | A many-to-many join multiplies rows and compute. | Join facts to dimensions on a stable key. |
| Limit exploratory queries | Prevent a first look from scanning the complete history. | Start with one day and `LIMIT 100`. |

**Sargable** means a predicate is searchable in a form the engine can use efficiently. This predicate often permits partition pruning or an index lookup:

```sql
WHERE observed_at >= TIMESTAMP '2026-08-15 00:00:00+00'
  AND observed_at < TIMESTAMP '2026-08-16 00:00:00+00'
```

This version may force the engine to calculate a function for every row before comparing it:

```sql
WHERE CAST(observed_at AS date) = DATE '2026-08-15'
```

The result can be equivalent. The physical work may not be. If a date expression is required for reporting, use it in the `SELECT` or a derived model while retaining a direct timestamp filter on the base relation.

## 4. Partitioning is a data-skipping contract

A **partition** divides a large table into independently manageable pieces, commonly by date. The engine can skip partitions that cannot match a filter, a process often called partition pruning.

For observations, daily partitioning is a common starting point:

```text
fct_price_observation
├── observed_date = 2026-08-14
├── observed_date = 2026-08-15
└── observed_date = 2026-08-16
```

Queries should then filter on the partition field or an equivalent range:

```sql
SELECT provider, symbol, avg(price) AS average_price
FROM analytics.fct_price_observation
WHERE observed_date = DATE '2026-08-15'
GROUP BY provider, symbol;
```

Choose a partition key from the most common bounded filter, often event date, ingestion date, or receipt date. The choice depends on the question the table serves:

| Candidate | Good when | Weak when |
| --- | --- | --- |
| Event date | Users analyse when the real-world event occurred. | Very late records require old partitions to be reopened. |
| Receipt date | Operations focus on ingestion behaviour and arrival time. | Historical event analysis scans more partitions. |
| Tenant or provider | Workloads usually isolate one large customer or source. | Cross-tenant reporting becomes fragmented. |

Do not create extremely fine partitions by default. Thousands of tiny partitions increase metadata and planning overhead. A one-minute partition for a table that most users query by month rarely helps. Start with the coarsest partition that lets common queries skip substantial data, then measure.

Partitioning is useful only when queries include a compatible filter. A “last 24 hours” dashboard that omits the date predicate can still scan years of partitions.

## 5. Clustering and indexes solve different layouts

After partitioning reduces the broad search space, ordering data within each partition can help narrower filters, joins, and aggregations.

**Clustering**, **sort keys**, and similar warehouse features physically organise values that are often queried together. A market-data table might cluster by `provider, symbol` after partitioning by date. Queries that filter a date and then one provider or symbol can skip more blocks of data.

**Indexes** are separate lookup structures. PostgreSQL commonly uses B-tree indexes for equality and range lookups. A useful index depends on the filters and joins a database actually sees:

```sql
CREATE INDEX fct_price_observation_market_time_idx
ON analytics.fct_price_observation (market_id, observed_at DESC);
```

This could help “latest observation for one market” queries. It may not help “aggregate every market for the last month,” where scanning a large range is still the correct plan.

| Mechanism | Typical environment | Best for | Cost |
| --- | --- | --- | --- |
| Partitioning | Warehouses and large analytical tables | Skipping broad date or tenant ranges. | Poor key choice leaves scans broad; too many partitions add overhead. |
| Clustering or sort key | Columnar warehouses and analytical engines | Skipping blocks inside a selected partition; grouped access patterns. | Maintenance or imperfect ordering after new writes. |
| Index | Row-oriented databases and some analytical engines | Selective lookups, joins, and ranges. | Extra storage and write cost; unused indexes add maintenance. |
| Materialised aggregate | Any platform with a supported implementation | Reusing expensive, stable summaries. | Refresh and staleness policy become a contract. |

Design from the predicate order. A composite B-tree index on `(market_id, observed_at)` is useful for `WHERE market_id = ... AND observed_at >= ...`. Reversing it is better only if time is the selective leading condition in real queries. Check the plan; do not memorise a rule without the workload.

## 6. A mart is often the right optimisation

If a dashboard needs daily open, high, low, close, average, and volume, it should rarely calculate all of those from raw ticks each time a user changes a date picker. Build a mart at the consumer's grain:

```text
fct_price_observation: one row per market observation
mart_daily_market_price: one row per market per UTC day
```

```sql
SELECT
  market_id,
  observed_date,
  min(price) AS low_price,
  max(price) AS high_price,
  avg(price) AS average_price
FROM analytics.fct_price_observation
WHERE observed_date = DATE '2026-08-15'
GROUP BY market_id, observed_date;
```

This is a semantic optimisation as well as a performance one. It publishes what “daily price” means once, instead of leaving every dashboard or LLM tool to implement a slightly different version.

Do not precompute every imaginable aggregate. Each mart needs a clear consumer, defined grain, freshness expectation, owner, and test. A pile of unused summary tables is just another source of staleness and confusion.

## 7. Plans reveal the work you are actually asking for

Days 5–7 introduced `EXPLAIN` and `EXPLAIN ANALYZE`. Use them before adding indexes or rewriting logic.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  market_id,
  max(observed_at) AS latest_observation
FROM analytics.fct_price_observation
WHERE observed_at >= now() - interval '1 day'
GROUP BY market_id;
```

Read the plan from the leaves upward:

```text
HashAggregate
  Group Key: market_id
  ->  Index Only Scan using fct_price_observation_market_time_idx
        Index Cond: observed_at >= now() - '1 day'::interval
```

The names are less important than the questions:

1. Which relation was read first, and how many rows did it produce?
2. Did the filter remove rows early or after a large join?
3. Did estimated rows differ sharply from actual rows?
4. Did a sort, hash, or join spill to disk or repeat many loops?
5. Is the result correct at the declared grain?

For warehouse query profiles, look for the analogous signals: bytes scanned, partitions or micro-partitions read, stage time, shuffle volume, slot or warehouse time, and skewed workers. Each product names them differently; the investigation loop is the same.

### Estimate errors are optimisation clues

If a planner expects 100 rows and receives 10 million, its selected join or aggregation strategy can be disastrous. Update statistics before inventing a new index:

```sql
ANALYZE analytics.fct_price_observation;
```

Then compare the same representative query. Large estimate errors can come from stale statistics, highly skewed values, correlated columns, type casts, functions around filtered fields, or an unrepresentative parameter. Fix the data model or statistics issue before forcing a plan.

## 8. Cost, concurrency, and caching are part of performance

Query performance is not merely latency. In a warehouse, it can be bytes scanned and compute credits. In a database, it can be CPU, I/O, lock contention, memory, and impact on other users. In a shared platform, it also includes concurrency: a query that is fast alone can be expensive when 50 dashboards run it together.

Use these habits:

- Put a bounded date filter in shared exploratory queries.
- Cancel or limit accidental full-history queries early.
- Set sensible warehouse or workload-group limits for interactive users.
- Use marts for repeated consumer questions.
- Treat result caching as a bonus, not a correctness or cost strategy; cache invalidation and data freshness still matter.
- Measure p50 and p95 run time, bytes scanned, and failed or retried jobs after a change.

Avoid “optimising” a query by returning a different result. Replacing an inner join with a left join, filtering away nulls, or dropping a dimension can make the number faster and wrong. Keep a representative result check beside the performance comparison.

## A disciplined tuning loop

When a warehouse job or query slows down, use one loop:

```text
1. State the intended output grain and a representative parameter set.
2. Capture baseline runtime, cost, rows, and plan or query profile.
3. Find the largest scan, join fan-out, shuffle, sort, or estimate mismatch.
4. Form one hypothesis: narrower filter, better model, partition key, index,
   statistics refresh, or materialised mart.
5. Change one thing.
6. Verify output equivalence and rerun the same representative workload.
7. Keep or revert based on measured evidence.
```

This is slower than guessing on the first query and much faster than carrying a wrong index, partition scheme, or summary table for a year.

## A small exercise for day 22

Use a table with at least several days of event history. It can be a local PostgreSQL table, DuckDB file, or warehouse sandbox.

```text
1. Write the table grain and three common access patterns.
2. Run a deliberately broad query and record its rows, time, and plan/profile.
3. Add a bounded time predicate and named columns. Compare the result and work done.
4. Explain which partition, cluster, or index design would suit the access patterns.
5. Build one daily aggregate mart and compare it with raw-event aggregation.
6. Verify that both versions return the same answer for one known date.
```

The exercise is complete when you can explain the improvement in terms of fewer rows, columns, blocks, partitions, or repeated calculations—not merely “the second query was faster.”

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Data warehouse | A system designed for analytical storage and large historical queries. | `Compare an operational PostgreSQL database and an analytical warehouse using price observations, daily marts, query patterns, and concurrency.` |
| Columnar storage | Storage that groups values by column rather than by row. | `Explain columnar storage with a ten-column price-observation table and a query that only reads symbol, time, and price.` |
| Partition pruning | Skipping partitions that cannot match a query filter. | `Teach partition pruning with daily price partitions. Show one predicate that prunes data and one that accidentally scans the full history.` |
| Clustering key | A physical ordering choice that groups commonly filtered values. | `Explain clustering after date partitioning for provider and symbol queries. How is it different from an index?` |
| Composite index | An index over more than one column, in a defined order. | `Explain a composite PostgreSQL index on market_id and observed_at. Which query predicates benefit and why does column order matter?` |
| Sargable predicate | A filter written in a form the engine can search efficiently. | `Show sargable and non-sargable timestamp predicates for a partitioned price table. Explain the execution difference.` |
| Query profile | A warehouse view of stages, bytes scanned, shuffles, and time. | `Teach me how to read a warehouse query profile. Map bytes scanned, partitions read, shuffle, and skew to possible fixes.` |
| Shuffle | Redistributing data between workers for a distributed operation. | `Explain shuffle in a distributed join or GROUP BY. Why can a high-cardinality join key or skew make it expensive?` |
| Statistics | Metadata a planner uses to estimate row counts and select plans. | `Explain query-planner statistics with a skewed provider column. Show how stale statistics can create a bad join plan.` |
| Materialised aggregate | A stored result at a useful consumer grain. | `Design a daily market-price mart. Explain freshness, late-data rebuilds, tests, and why it can beat raw-tick aggregation.` |
| Query equivalence | Proof that an optimisation preserves the intended result. | `Show how to compare an old and new SQL query for equivalent results at a declared grain before deploying a performance change.` |

When asking an LLM to optimise a query, provide the database or warehouse, table sizes, schema, grain, real predicates, execution plan or profile, and the required result. Without that context, an index suggestion is often a guess dressed as advice.

## What comes next

Days 23–24 focus on data observability and quality: freshness, volume, schema drift, distribution changes, disagreement between providers, and how to turn a surprising number into a useful incident investigation.

## References

- [PostgreSQL documentation: indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL documentation: `EXPLAIN`](https://www.postgresql.org/docs/current/sql-explain.html)
- [BigQuery documentation: partitioned tables](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [BigQuery documentation: clustered tables](https://cloud.google.com/bigquery/docs/clustered-tables)
- [Snowflake documentation: micro-partitions and data clustering](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [ClickHouse documentation: primary indexes](https://clickhouse.com/docs/primary-indexes)
