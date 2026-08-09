---
title: "PostgreSQL 19 Adds Property Graphs Without Leaving SQL Behind"
date: 2026-08-09
tags: [postgresql, sql, graph-databases, data-engineering]
summary: "PostgreSQL 19 Beta brings SQL/PGQ property graphs to ordinary relational tables. Here is what the syntax looks like, where it makes connected-data queries clearer than joins, and which other v19 changes matter in production."
series: data-engineering
---

PostgreSQL 19 is still in beta as I write this, so this is a feature to evaluate, not a reason to schedule an upgrade. Its most interesting addition is easy to misname: it is **SQL/PGQ**, the SQL standard's property-graph query language, not GraphQL.

That distinction matters. GraphQL is an API query language. SQL/PGQ lets a database describe and query relationships as a graph. PostgreSQL remains a relational database: rows stay in tables, foreign keys still enforce integrity, and the regular planner still executes the work. A property graph is a read-only graph-shaped view over those tables.

That is a much more useful design than moving connected data into a second database merely to ask a relationship question.

## The relational model stays in charge

Consider a market-data platform. It keeps assets, providers, and markets in conventional tables:

```sql
CREATE TABLE providers (
  provider_id bigint PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE assets (
  asset_id bigint PRIMARY KEY,
  symbol text NOT NULL UNIQUE
);

CREATE TABLE markets (
  market_id bigint PRIMARY KEY,
  provider_id bigint NOT NULL REFERENCES providers,
  base_asset_id bigint NOT NULL REFERENCES assets,
  quote_asset_id bigint NOT NULL REFERENCES assets,
  symbol text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
```

This is still the right storage model. It gives us keys, constraints, ordinary indexes, backups, replication, and tools the team already knows. The graph is an additional query surface, defined from those relationships:

```sql
CREATE PROPERTY GRAPH market_graph
  VERTEX TABLES (
    providers LABEL provider,
    assets LABEL asset,
    markets LABEL market
  )
  EDGE TABLES (
    markets AS listed_on
      SOURCE KEY (market_id) REFERENCES markets (market_id)
      DESTINATION KEY (provider_id) REFERENCES providers (provider_id)
      LABEL listed_on,
    markets AS has_base_asset
      SOURCE KEY (market_id) REFERENCES markets (market_id)
      DESTINATION KEY (base_asset_id) REFERENCES assets (asset_id)
      LABEL has_base_asset,
    markets AS has_quote_asset
      SOURCE KEY (market_id) REFERENCES markets (market_id)
      DESTINATION KEY (quote_asset_id) REFERENCES assets (asset_id)
      LABEL has_quote_asset
  );
```

That definition is deliberately a view, not a copy. There is no graph ETL job to keep current, no duplicate source of truth, and no new write path. `CREATE PROPERTY GRAPH` maps vertex and edge tables to the same relational data. In a production schema, PostgreSQL can infer keys and edge endpoints from primary and foreign keys; explicit `KEY`, `SOURCE KEY`, and `DESTINATION KEY` clauses are available when that metadata is absent or too ambiguous.

One practical caveat: a graph edge needs a direction. A market row has three relationships, so the example exposes the same underlying table as three labelled edge tables. That makes the query vocabulary explicit: a market is `listed_on` a provider and has a base and quote asset.

## Asking the relationship question

Suppose an analyst wants every active Binance market and its base asset. In ordinary SQL, this is a simple and perfectly good join:

```sql
SELECT m.symbol, a.symbol AS base_asset
FROM markets AS m
JOIN providers AS p ON p.provider_id = m.provider_id
JOIN assets AS a ON a.asset_id = m.base_asset_id
WHERE p.name = 'Binance'
  AND m.active;
```

The SQL/PGQ form names the path instead:

```sql
SELECT market_symbol, base_symbol
FROM GRAPH_TABLE (
  market_graph
  MATCH (a IS asset)<-[IS has_base_asset]-(m IS market WHERE m.active)
        -[IS listed_on]->(p IS provider WHERE p.name = 'Binance')
  COLUMNS (
    m.symbol AS market_symbol,
    a.symbol AS base_symbol
  )
);
```

`GRAPH_TABLE` produces ordinary rows, so its result can be joined, filtered, aggregated, and ordered by regular SQL. The parenthesised expressions describe vertices, brackets describe edges, and `IS` matches the labels defined in `CREATE PROPERTY GRAPH`.

For this two-join report, the graph version is not automatically better. The regular query is shorter for many SQL practitioners and should remain the default for simple relational work.

The value appears once the question is about a topology rather than a table. For example: find base assets that reach a USD market through a listed market, while retaining the provider and both market symbols. A join version needs aliases for the two market roles and careful foreign-key wiring:

```sql
SELECT p.name,
       base.symbol AS base_asset,
       base_market.symbol AS base_market,
       usd_market.symbol AS usd_market
FROM providers AS p
JOIN markets AS base_market ON base_market.provider_id = p.provider_id
JOIN assets AS base ON base.asset_id = base_market.base_asset_id
JOIN markets AS usd_market ON usd_market.base_asset_id = base.asset_id
JOIN assets AS usd ON usd.asset_id = usd_market.quote_asset_id
WHERE p.name = 'Binance'
  AND base_market.active
  AND usd_market.active
  AND usd.symbol = 'USD';
```

The graph form keeps the same trail visible from left to right:

```sql
SELECT provider_name, base_asset, base_market, usd_market
FROM GRAPH_TABLE (
  market_graph
  MATCH (p IS provider WHERE p.name = 'Binance')
        <-[IS listed_on]-(m1 IS market WHERE m1.active)
        -[IS has_base_asset]->(a IS asset)
        <-[IS has_base_asset]-(m2 IS market WHERE m2.active)
        -[IS has_quote_asset]->(usd IS asset WHERE usd.symbol = 'USD')
  COLUMNS (
    p.name AS provider_name,
    a.symbol AS base_asset,
    m1.symbol AS base_market,
    m2.symbol AS usd_market
  )
);
```

The graph query did not remove the need to understand the data model. It removed the translation from a relationship trail in the analyst's head into a collection of aliases and join predicates. That gap becomes expensive when paths get longer, patterns branch, or the question changes every week.

## Where SQL/PGQ is genuinely useful

Property graphs fit data that is relational in storage but relationship-heavy in use: identity resolution, entitlement chains, fraud rings, lineage, dependency graphs, supply routes, and market connectivity. In an agent workflow, a graph can expose which tool, dataset, policy, and approval led to a decision without maintaining a separate Neo4j-style projection just for inspection.

It is not a universal improvement over joins. Use regular SQL for facts, aggregates, and straightforward dimensions. Use SQL/PGQ when the path is the question. The two styles compose in one statement, which is the point: teams can adopt graph patterns where they help instead of turning every table into a graph problem.

There are also operational limits to keep in view. This is a beta feature, property graphs are read-only definitions rather than a new storage engine, and graph syntax does not create missing indexes or repair weak keys. Start with one reporting or investigation workflow, compare plans and latency with the existing SQL, and keep the relational query as the baseline.

## The other PostgreSQL 19 changes worth knowing

The release has several less glamorous changes that will affect everyday database work more quickly than graph queries.

### `ON CONFLICT DO SELECT` makes get-or-create atomic

Before v19, an idempotent insert often needed `ON CONFLICT DO NOTHING` followed by another query, or an update that touched a row merely to return it. PostgreSQL 19 adds `DO SELECT`, which returns the conflicting row without pretending to change it:

```sql
INSERT INTO assets (asset_id, symbol)
VALUES (42, 'BTC')
ON CONFLICT (symbol) DO SELECT
RETURNING asset_id, symbol;
```

It is a small syntax addition with an important concurrency property: the caller gets an insert-or-select outcome in one atomic statement. `DO SELECT` requires a `RETURNING` clause and the relevant `SELECT` privilege; it can also take a locking clause when the caller needs to protect the returned row.

### `REPACK` replaces a painful maintenance choice

`VACUUM FULL` reclaims disk space, but it takes an `ACCESS EXCLUSIVE` lock. v19's new `REPACK` command rewrites a table to reclaim dead-tuple space and adds `CONCURRENTLY` for an online-style operation:

```sql
REPACK (CONCURRENTLY, ANALYZE) markets USING INDEX;
```

The concurrent mode captures changes through logical decoding and applies them before the final file swap, so the blocking lock is usually brief. It still needs disk headroom, can be delayed by active write churn, and may fail if another transaction changes the table definition. Treat it as a well-tested maintenance procedure, not a casual replacement for routine vacuuming.

### Planner control becomes more precise

`pg_plan_advice` is a new contrib module for recording and constraining planner choices. It can show the planner's selected join order, join method, scan method, and parallelism as an advice string through `EXPLAIN (PLAN_ADVICE)`.

That is valuable during a regression investigation, especially where a stable query must stay predictable while statistics or data shape are being fixed. It is not a license to hard-code plans forever: the module constrains choices the core planner would consider; it does not replace the planner or force semantically invalid paths.

### Less surprise from maintenance and analytics defaults

JIT is now off by default. JIT can help very expensive queries, but its compilation time can hurt ordinary OLTP and short analytical queries. Turn it on after measurement, rather than paying for it by default.

Autovacuum can now use parallel workers for index vacuuming and cleanup. The default `autovacuum_max_parallel_workers` is zero, so enabling it is an operational decision that should account for CPU, I/O pressure, and the number of indexes on the tables that bloat.

`GROUP BY ALL` removes a common source of reporting boilerplate:

```sql
SELECT provider_id, active, count(*) AS market_count
FROM markets
GROUP BY ALL;
```

It groups by each select-list expression that is neither an aggregate nor a window function. That is convenient for exploratory reports, though explicit grouping is still clearer when a query is meant to be a durable business definition.

Finally, `COPY TO` can output JSON directly:

```sql
COPY (
  SELECT symbol, active
  FROM markets
  WHERE active
) TO STDOUT WITH (FORMAT json, FORCE_ARRAY);
```

This makes a lightweight export or tool handoff simpler. It is export-only: `COPY FROM` does not accept JSON in v19. Be mindful that SQL `NULL` and a JSON column containing the JSON literal `null` are indistinguishable in this output format.

## A sensible adoption order

Start with the boring wins: evaluate JIT's new default, use `ON CONFLICT DO SELECT` in genuine get-or-create paths, and test `REPACK` and parallel autovacuum in a production-like environment. Try `COPY TO JSON` and `GROUP BY ALL` where they remove glue code without obscuring a durable query.

Then choose one relationship-heavy problem for SQL/PGQ. Define the graph over well-keyed existing tables, write the old join query beside the new `GRAPH_TABLE` version, and benchmark both on representative data. PostgreSQL 19's graph support is compelling precisely because it does not demand a rewrite. It lets relational data answer graph-shaped questions in the database where the data already lives.

## References

- [PostgreSQL 19 release notes](https://www.postgresql.org/docs/19/release-19.html)
- [PostgreSQL 19 Beta 2 announcement](https://www.postgresql.org/about/news/postgresql-19-beta-2-released-3350/)
- [Property Graphs](https://www.postgresql.org/docs/19/ddl-property-graphs.html)
- [CREATE PROPERTY GRAPH](https://www.postgresql.org/docs/19/sql-create-property-graph.html)
- [Graph Queries](https://www.postgresql.org/docs/19/queries-graph.html)
- [INSERT and ON CONFLICT DO SELECT](https://www.postgresql.org/docs/19/sql-insert.html)
- [REPACK](https://www.postgresql.org/docs/19/sql-repack.html)
- [pg_plan_advice](https://www.postgresql.org/docs/19/pgplanadvice.html)
- [COPY JSON format](https://www.postgresql.org/docs/19/sql-copy.html)
