---
title: "Data Engineering in 30 Days, Days 5–7: SQL Foundations and Database Vocabulary"
date: 2026-08-10
tags: [data-engineering, learning-path, sql, postgresql]
summary: "Build the SQL foundation for data engineering: understand databases, schemas, tables, DDL and DML, then learn to select, join, aggregate, structure, and compare data safely."
series: data-engineering-in-30-days
---

SQL is the working language of data engineering. Python can fetch an API and an orchestrator can schedule a job, but SQL usually decides what data exists for the rest of the business to use.

Days 5–7 do not aim to teach every SQL feature. They build the vocabulary and habits needed to read a schema, make a safe change, ask a precise question, and spot a query that is quietly changing the meaning of the data.

We will keep using the market-data system from earlier articles: providers publish prices, raw responses are retained, and cleaned observations become tables for analysis.

## The outcome for these three days

By the end, you should be able to:

1. Explain the difference between a database, schema, table, row, column, and constraint.
2. Recognise DDL and DML and know why they carry different risks.
3. Write `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, and joins for a real question.
4. Use a CTE and a window function without losing the grain of a table.
5. Read enough SQL vocabulary to ask an LLM or teammate the right follow-up question.

## 1. The map inside a database

People often use “database” to mean every storage-related thing. It helps to separate the levels:

```text
PostgreSQL server
└── database: market_data
    ├── schema: raw
    │   └── table: exchange_responses
    └── schema: analytics
        ├── table: price_observation
        └── view: daily_market_summary
```

| Term | Meaning | Example |
| --- | --- | --- |
| Database server | The running database software that can host databases. | One PostgreSQL instance. |
| Database | A named collection of related data and objects. | `market_data`. |
| Schema | A namespace used to organise database objects. | `raw` and `analytics`. |
| Table | A defined collection of rows with named columns. | `analytics.price_observation`. |
| Row | One record at the table’s grain. | One provider’s price for one market at one time. |
| Column | One attribute of every row. | `observed_at` or `price`. |
| View | A saved query that behaves like a table when read. | A daily summary calculated from observations. |
| Constraint | A database-enforced rule about valid data. | A price must be greater than zero. |

Schemas are useful when one database holds several layers of the same system. Keeping raw source records in `raw` and business-ready models in `analytics` signals that the tables have different consumers and stability expectations. It does not replace permissions or documentation, but it makes the boundary visible.

## 2. DDL changes structure; DML changes data

The first SQL distinction to learn is between **data definition language** and **data manipulation language**.

**DDL** defines or changes database structure. Common commands are `CREATE`, `ALTER`, `DROP`, and `TRUNCATE`.

```sql
CREATE TABLE analytics.provider (
  provider_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE analytics.price_observation (
  provider_id bigint NOT NULL REFERENCES analytics.provider,
  symbol text NOT NULL,
  observed_at timestamptz NOT NULL,
  price numeric NOT NULL CHECK (price > 0),
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider, symbol, observed_at)
);
```

This one statement defines the table's columns, types, and rules. It makes an assumption about grain explicit: the combination of provider, symbol, and observation time identifies one row.

**DML** reads or changes the rows inside that structure. Common commands are `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `MERGE`.

```sql
INSERT INTO analytics.price_observation (
  provider_id, symbol, observed_at, price, received_at
)
VALUES (
  1, 'BTC/USDT', '2026-08-10 09:00:00+00', 118450.25,
  '2026-08-10 09:00:02+00'
);
```

The distinction matters operationally. An incorrect `UPDATE` may damage rows; an incorrect `DROP TABLE` can remove the structure and the data with it. In a team, DDL should be versioned and reviewed through migrations. DML used for repairs should be narrow, explainable, and checked before it runs.

### DCL and TCL: two more terms worth recognising

You will also see:

- **DCL**, data control language: permissions such as `GRANT` and `REVOKE`.
- **TCL**, transaction control language: commands such as `BEGIN`, `COMMIT`, and `ROLLBACK`.

A transaction groups work so it either succeeds together or is undone together. For a correction involving several tables, that boundary prevents one half of the fix from becoming visible without the other.

```sql
BEGIN;

UPDATE analytics.price_observation
SET symbol = 'BTC/USD'
WHERE provider_id = 1
  AND symbol = 'XBTUSD';

COMMIT;
```

In real work, inspect the rows with a `SELECT` using the same `WHERE` condition before running the update. If you are unsure, use `ROLLBACK` rather than treating production as a practice environment.

## 3. Start every query by naming the grain

The safe way to write SQL is to say what one output row should represent before writing the query.

Question: “Show the latest price recorded for each Binance market.”

Output grain: one row per Binance market, containing its latest observation.

The first query may simply inspect records:

```sql
SELECT provider_id, symbol, observed_at, price
FROM analytics.price_observation
WHERE provider_id = 1
ORDER BY observed_at DESC;
```

This uses four foundational clauses:

| Clause | Job | Question it answers |
| --- | --- | --- |
| `SELECT` | Chooses columns or expressions to return. | What do I want to see? |
| `FROM` | Chooses the source table or query. | Where does it come from? |
| `WHERE` | Filters individual rows before aggregation. | Which records qualify? |
| `ORDER BY` | Sorts the result for reading or ranking. | In what order should it appear? |

`ORDER BY` does not make a query “latest per market.” It sorts every row. That difference is where window functions become useful later.

## 4. SQL is written top to bottom, but understood in another order

This is one of the most useful SQL fundamentals. A query is usually written in this order:

```sql
SELECT ...
FROM ...
JOIN ... ON ...
WHERE ...
GROUP BY ...
HAVING ...
ORDER BY ...
LIMIT ...;
```

But the logical processing order is closer to this:

| Logical order | Clause | What happens |
| ---: | --- | --- |
| 1 | `FROM` | Choose the starting rows. |
| 2 | `JOIN` and `ON` | Match related rows and form the joined relation. |
| 3 | `WHERE` | Remove individual rows that do not qualify. |
| 4 | `GROUP BY` | Form groups of the remaining rows. |
| 5 | Aggregate functions | Calculate `count`, `sum`, `avg`, and similar values for each group. |
| 6 | `HAVING` | Remove groups that do not qualify. |
| 7 | Window functions | Calculate across related result rows while keeping their detail. |
| 8 | `SELECT` | Choose and name the output columns and expressions. |
| 9 | `DISTINCT` | Remove duplicate output rows when requested. |
| 10 | `ORDER BY` | Sort the final result. |
| 11 | `LIMIT` and `OFFSET` | Return only the requested slice. |

This is a logical model, not a promise about the physical query plan. PostgreSQL can rearrange work internally when it can prove the result stays the same. The model is still what lets you predict SQL behaviour.

Consider this query:

```sql
SELECT
  p.name,
  count(*) AS observations
FROM analytics.price_observation AS o
JOIN analytics.provider AS p
  ON p.provider_id = o.provider_id
WHERE o.observed_at >= DATE '2026-08-10'
GROUP BY p.name
HAVING count(*) >= 100
ORDER BY observations DESC
LIMIT 5;
```

Read it in logical order:

1. Start with `price_observation`.
2. Join each observation to its provider.
3. Keep only observations on or after 10 August.
4. Group the remaining observations by provider name.
5. Count the rows in each provider group.
6. Keep only providers with at least 100 observations.
7. Select the provider name and count.
8. Sort those groups by the `observations` alias.
9. Return the top five.

This explains two common beginner surprises:

```sql
-- This fails in most SQL databases.
SELECT price * 1.1 AS adjusted_price
FROM analytics.price_observation
WHERE adjusted_price > 100;
```

`WHERE` happens before `SELECT`, so the `adjusted_price` alias does not exist yet. Repeat the expression, use a CTE, or filter in an outer query.

```sql
-- This uses HAVING because the count exists after grouping.
SELECT provider_id, count(*) AS observations
FROM analytics.price_observation
GROUP BY provider_id
HAVING count(*) >= 100;
```

When a query is confusing, state the intended grain, then walk through this order. Most accidental duplicates, missing left-join rows, and invalid aggregate queries become easier to diagnose.

## 5. Aggregation answers questions about groups

An aggregate combines several rows into one value. `count`, `sum`, `avg`, `min`, and `max` are common aggregates.

To count observations per provider for one day:

```sql
SELECT
  provider_id,
  count(*) AS observations,
  min(observed_at) AS first_observation,
  max(observed_at) AS last_observation
FROM analytics.price_observation
WHERE observed_at >= DATE '2026-08-10'
  AND observed_at < DATE '2026-08-11'
GROUP BY provider_id
ORDER BY observations DESC;
```

`GROUP BY provider_id` changes the grain. The output is no longer one row per price observation. It is one row per provider per selected time range. That is exactly what we want here, but it should always be a deliberate change.

Use `HAVING` when the filter applies after grouping:

```sql
SELECT provider_id, count(*) AS observations
FROM analytics.price_observation
GROUP BY provider_id
HAVING count(*) < 100;
```

`WHERE` filters input rows. `HAVING` filters the groups created by aggregation. Asking “which providers have fewer than 100 records?” requires `HAVING` because the count does not exist until after the rows are grouped.

## 6. Joins connect tables, and can multiply data

A join combines rows from two sources using a relationship. Suppose the cleaned system has a table of providers and a table of observations:

```text
provider                         price_observation
┌─────────────┬─────────┐         ┌─────────────┬─────────┬───────────┐
│ provider_id │ name    │         │ provider_id │ symbol  │ price     │
├─────────────┼─────────┤         ├─────────────┼─────────┼───────────┤
│ 1           │ Binance │         │ 1           │ BTC/USDT│ 118450.25 │
│ 2           │ Kraken  │         │ 1           │ ETH/USDT│ 3850.10   │
└─────────────┴─────────┘         └─────────────┴─────────┴───────────┘
```

An `INNER JOIN` keeps only matching rows:

```sql
SELECT p.name, o.symbol, o.price
FROM analytics.price_observation AS o
JOIN analytics.provider AS p
  ON p.provider_id = o.provider_id;
```

A `LEFT JOIN` keeps every row from the left-hand table even if no match exists on the right. It is useful for questions such as “which configured providers did not send any observations today?”

```sql
SELECT p.name, count(o.provider_id) AS observations
FROM analytics.provider AS p
LEFT JOIN analytics.price_observation AS o
  ON o.provider_id = p.provider_id
 AND o.observed_at >= DATE '2026-08-10'
 AND o.observed_at < DATE '2026-08-11'
GROUP BY p.name;
```

The placement of the time filter matters. Leaving it in the `ON` clause preserves providers with zero matching observations. Putting `o.observed_at` in a `WHERE` clause would remove the `NULL` rows created by the left join and quietly turn this into an inner join.

Before joining, ask how many rows can match on each side:

```text
one provider → many observations
one market   → many observations
one minute   → many trades
```

Joining a one-to-many table is normal. Joining two many-to-many tables without a bridge or a careful condition can multiply rows and inflate totals. Check the output grain again after every join.

## 7. CTEs give a query names and steps

A common table expression, or **CTE**, is a named subquery introduced with `WITH`. It helps a complex query read like a sequence of small transformations.

```sql
WITH today AS (
  SELECT provider_id, symbol, observed_at, price
  FROM analytics.price_observation
  WHERE observed_at >= DATE '2026-08-10'
    AND observed_at < DATE '2026-08-11'
),
provider_summary AS (
  SELECT provider_id, count(*) AS observations, avg(price) AS average_price
  FROM today
  GROUP BY provider_id
)
SELECT p.name, s.observations, s.average_price
FROM provider_summary AS s
JOIN analytics.provider AS p
  ON p.provider_id = s.provider_id;
```

The CTE is not automatically faster than an equivalent nested query. Its first benefit is clarity: each name should describe a meaningful intermediate relation, and each step should have a known grain. Avoid creating a CTE for every line; use one when it makes the logic easier to inspect or reuse within the statement.

## 8. Window functions compare without collapsing rows

An aggregate with `GROUP BY` reduces many rows to one row per group. A **window function** calculates over related rows while retaining the original row detail.

To keep the latest observation for each provider and symbol:

```sql
WITH ranked_observations AS (
  SELECT
    provider_id,
    symbol,
    observed_at,
    price,
    row_number() OVER (
      PARTITION BY provider_id, symbol
      ORDER BY observed_at DESC
    ) AS recency_rank
  FROM analytics.price_observation
)
SELECT provider_id, symbol, observed_at, price
FROM ranked_observations
WHERE recency_rank = 1;
```

`PARTITION BY` makes a separate ordered group for each provider and symbol. `row_number()` labels the most recent row in each group as 1. The final filter gives us the intended output grain: one row per provider-market pair.

Other useful window functions include `lag()` and `lead()` for comparing a row with the previous or next row, and running aggregates such as `sum(...) OVER (...)`. They are powerful because they preserve the event-level table while adding context.

## 9. Investigate a query with its plan before optimising it

When a query is slow, the database is already making decisions for you: which table to read first, whether to scan or use an index, how to join data, when to sort, and whether to aggregate before or after a join. A **query plan** is its explanation of those decisions.

Start with `EXPLAIN`:

```sql
EXPLAIN
SELECT
  provider_id,
  symbol,
  max(observed_at) AS latest_observation
FROM analytics.price_observation
WHERE observed_at >= now() - interval '1 day'
GROUP BY provider_id, symbol;
```

`EXPLAIN` plans the query without running it. This is safe to use while investigating a production-shaped query. It shows plan nodes and estimated costs, row counts, and widths.

Use `EXPLAIN ANALYZE` only when it is safe for the query to execute:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  provider_id,
  symbol,
  max(observed_at) AS latest_observation
FROM analytics.price_observation
WHERE observed_at >= now() - interval '1 day'
GROUP BY provider_id, symbol;
```

`ANALYZE` runs the statement and adds actual time, actual rows, loops, and buffer activity. For a `SELECT`, that usually means a real read workload. For an `INSERT`, `UPDATE`, `DELETE`, or DDL statement, it performs the change. Never point `EXPLAIN ANALYZE` at a write in production merely to see the plan.

### Read a plan from the leaves upward

A simplified plan may look like this:

```text
HashAggregate
  Group Key: provider_id, symbol
  ->  Seq Scan on price_observation
        Filter: observed_at >= now() - '1 day'::interval
```

Read it as a pipeline of work:

1. The database reads `price_observation` with a sequential scan.
2. It discards rows older than one day.
3. It groups the remaining rows and calculates the maximum timestamp.

A sequential scan is not automatically bad. If the table is small, or the query needs a large fraction of its rows, reading it once can be cheaper than jumping through an index. An index is useful when it eliminates enough work to repay the cost of using it.

The following nodes appear often:

| Plan node | What it means | Question to ask |
| --- | --- | --- |
| `Seq Scan` | Read the relation from start to finish. | Is the table small, or is the filter selecting most rows? |
| `Index Scan` | Use an index to find qualifying rows, then visit table rows. | Does the filter match the leading columns of a useful index? |
| `Index Only Scan` | Read needed values directly from an index when visibility permits. | Does the query need only indexed columns, and is the table well vacuumed? |
| `Nested Loop` | For each row from one input, find matching rows in the other. | Is the outer input truly small, or is this repeating expensive work? |
| `Hash Join` | Build an in-memory hash table for one input, then probe it with the other. | Is the hash input appropriately sized, and are row estimates accurate? |
| `Merge Join` | Join two inputs that are ordered on the join key. | Are sorts or existing indexes providing useful order? |
| `Sort` | Order rows for `ORDER BY`, a merge join, or an aggregate. | How many rows are sorted, and did it spill to disk? |
| `HashAggregate` or `GroupAggregate` | Produce aggregate values per group. | Did grouping happen after an unexpected row multiplication? |

### Estimates are often the real clue

Compare **estimated rows** with **actual rows** in an `EXPLAIN ANALYZE` plan. The planner selects a strategy from estimates based on table statistics. If it estimates 10 rows and receives 10 million, a nested loop or memory allocation that looked cheap on paper can become disastrous.

Common causes of a large mismatch include stale statistics, highly uneven values, correlated columns, a predicate hidden inside a function, or a query parameter whose value is unusual. Before adding an index, check the basics:

```sql
ANALYZE analytics.price_observation;
```

Then rerun the same read-only plan against representative data. An index may still be appropriate, but accurate statistics are cheaper than guessing.

### A disciplined investigation loop

Use this sequence when a data job slows down:

1. Capture the exact SQL, parameter values, timing, and expected result grain.
2. Run `EXPLAIN` first; use `EXPLAIN (ANALYZE, BUFFERS)` only in a safe environment or on a safe read query.
3. Find the node with the most actual time, rows, loops, or disk spill. Do not optimise a visually unfamiliar node just because its name sounds expensive.
4. Compare estimated and actual row counts at that node and its inputs.
5. Form one hypothesis: stale statistics, an unnecessary join, a non-selective filter, missing partition pruning, or a useful index.
6. Change one thing, rerun the same query and plan, and verify that the result is identical.

For example, a daily mart might filter a large history by `observed_at` and group by provider and symbol. A time-oriented index could be worth testing:

```sql
CREATE INDEX price_observation_observed_at_idx
ON analytics.price_observation (observed_at);
```

That is a hypothesis, not a default. If a daily report reads 80% of the table, the index may not help. If the query always filters by provider and time, a composite index beginning with `provider_id` may fit better. The plan and measured workload decide.

Query-plan literacy is not only about speed. It also exposes correctness problems. A plan with an unexpectedly large join output can reveal duplicate keys. A filter applied after a left join can reveal why “missing” providers disappeared from a report. Learn to ask both questions: “why is this slow?” and “why does this plan produce this many rows?”

## A small exercise for day 7

Use a local PostgreSQL or DuckDB database and create a small `price_observation` table. Insert 10–20 rows for two providers and two symbols. Then answer these questions:

```text
1. How many observations did each provider send?
2. Which provider-symbol pair has the newest observation?
3. Which configured provider sent no rows today?
4. What was the previous price before each observation?
5. Which query changes the grain, and what is the new grain?
```

For each query, write the expected row count before running it. When the result disagrees, inspect the join or grouping before changing the data. This is one of the quickest ways to learn SQL.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| SQL | A language for defining, querying, and changing relational data. | `Teach SQL to a data-engineering beginner using a table of exchange price observations. Give one task at a time and wait for my answer.` |
| Database | A managed collection of related data and database objects. | `Explain a PostgreSQL server, database, schema, and table using a small market-data system. Draw the hierarchy in text.` |
| Schema | A namespace and structure for database objects; also an agreement about data fields. | `Explain the two meanings of schema in SQL. Show why both matter for a raw and analytics layer.` |
| DDL | Statements that define or change database structure. | `Explain CREATE, ALTER, DROP, and TRUNCATE with safe PostgreSQL examples. Rank their production risk and explain why.` |
| DML | Statements that read or change table rows. | `Teach SELECT, INSERT, UPDATE, DELETE, and MERGE using price observations. Explain the risk of each command.` |
| Constraint | A database-enforced data rule. | `Explain NOT NULL, UNIQUE, PRIMARY KEY, FOREIGN KEY, and CHECK using a provider and price-observation schema.` |
| Transaction | A group of changes that commits together or rolls back together. | `Show a safe transaction for correcting a wrongly mapped market symbol. Include a preview query and a rollback example.` |
| Logical SQL order | The conceptual sequence in which clauses produce a result. | `Walk me through FROM, JOIN, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, and LIMIT using one price-observation query. Explain why a SELECT alias is unavailable in WHERE.` |
| Join | A way to combine related rows from two sources. | `Teach INNER JOIN and LEFT JOIN with providers and price observations. Show how a WHERE clause can accidentally break a left join.` |
| Aggregate | A function that combines multiple rows into one value. | `Explain count, sum, avg, min, and max. Show how GROUP BY changes table grain with a market-data example.` |
| CTE | A named temporary result inside one SQL statement. | `Refactor a hard-to-read SQL query into two CTEs. Explain the grain of each CTE.` |
| Window function | A calculation over related rows that keeps row-level detail. | `Teach row_number, lag, and running sum with exchange price observations. Contrast each with GROUP BY.` |
| Query plan | The database's chosen strategy for executing a query. | `Explain a SQL query plan for a beginner. Use a large price-observation table and show why an index may or may not help.` |
| EXPLAIN ANALYZE | A PostgreSQL command that runs a statement and reports actual plan behaviour. | `Teach me to read EXPLAIN ANALYZE from the bottom up. Include estimated versus actual rows, loops, buffers, and the safety risk of analysing a write query.` |
| Cardinality estimate | The planner's prediction of how many rows a plan node will produce. | `Explain cardinality estimation with a bad nested-loop example. Show how stale statistics can lead to a slow query plan.` |

Give an LLM your schema and expected output grain when asking for SQL. Then inspect every `JOIN`, `GROUP BY`, and filter it produces. A syntactically valid answer can still duplicate rows, drop missing records, or answer a subtly different question.

## What comes next

Days 8–10 add enough Python and database interaction to collect data from an API, retain the raw response, and load a first typed table. SQL will remain the centre of the model; Python will become the controlled glue around it.

## References

- [PostgreSQL documentation: SQL syntax](https://www.postgresql.org/docs/current/sql-syntax.html)
- [PostgreSQL documentation: data definition](https://www.postgresql.org/docs/current/ddl.html)
- [PostgreSQL documentation: queries](https://www.postgresql.org/docs/current/queries.html)
- [PostgreSQL documentation: window functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [DuckDB documentation: SQL introduction](https://duckdb.org/docs/stable/sql/introduction.html)
