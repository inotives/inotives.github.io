---
title: "Why dbt Makes Sense Even for Small Crypto Projects"
date: 2026-07-20
tags: [dbt, crypto, data-engineering, data-quality, market-data]
series: data-engineering
summary: "Small crypto projects still need repeatable transforms, tested joins, freshness checks, and clear model boundaries. dbt is useful long before the warehouse is big because crypto data gets messy before it gets large."
---

# Why dbt Makes Sense Even for Small Crypto Projects

dbt can look too heavy for a small crypto project.

You have a few API pulls, some JSON files, a local database, maybe a dashboard. Writing SQL models, YAML tests, source definitions, and docs feels like ceremony.

That feeling is reasonable. Then the project grows by one more source.

CoinGecko gives you asset ids. An exchange gives you symbols. A wallet feed gives you chain-specific contract addresses. A report wants daily prices. An agent wants to explain portfolio movement. Suddenly the small project has the same problem as a larger one: nobody knows which table is safe to trust.

dbt helps before scale because the first hard problem is not volume. It is meaning.

## Crypto data gets messy early

A small equities dataset can stay simple for a while. Tickers are not perfect, but the basic shape is familiar.

Crypto gets weird almost immediately.

Symbols collide. Tokens migrate. Wrapped assets share display labels with native assets. Chains matter. Contract addresses matter. Providers disagree. Daily reference tables and fast-moving price tables have different freshness needs.

If the project only has scripts, every assumption gets buried in code:

```text
this join treats symbol as identity
this timestamp means ingestion time
this price is the latest provider value
this table is safe for reporting
```

Those assumptions might be fine. Hidden assumptions are the problem.

dbt gives them a place to live: models, tests, source freshness, docs, and lineage.

## Scripts are fine until they become memory

I still like scripts.

For ingestion, a small script is often the right tool. Pull the API, store the raw payload, record the run, move on. Do not turn a three-endpoint collector into an orchestration platform.

The line changes when scripts start encoding business meaning.

If a script maps CoinGecko IDs into canonical assets, joins balances to prices, filters stale rows, calculates portfolio exposure, and exports a report table, it is no longer "just a script." It is the transform layer.

That layer deserves tests and names.

dbt is good at boring transform work:

- raw source becomes staging
- staging becomes marts
- marts get tested
- dependencies are visible
- docs live beside the SQL

That is enough. You do not need a grand platform story.

## The shape I would use

For a small crypto project, I would keep the dbt project tiny:

```text
models/
  staging/
    coingecko/
      stg_coingecko__coins.sql
      stg_coingecko__prices.sql
  marts/
    mart__assets.sql
    mart__asset_prices.sql
    mart__portfolio_exposure.sql
```

The staging layer preserves source meaning. Use names like `coingecko_id`, `coingecko_symbol`, `asset_platform_id`, `contract_address`, and `ingested_at`.

The mart layer exposes consumer meaning. Use names like `canonical_asset_id`, `display_symbol`, `price_usd`, `observed_at`, and `as_of`.

That split keeps raw provider details from leaking into every report.

## Tests are the main reason

The first payoff is not documentation. It is tests.

For crypto, the minimum useful dbt tests are small:

```yaml
models:
  - name: mart__assets
    columns:
      - name: canonical_asset_id
        data_tests:
          - not_null
          - unique
      - name: display_symbol
        data_tests:
          - not_null

  - name: mart__asset_prices
    columns:
      - name: canonical_asset_id
        data_tests:
          - not_null
          - relationships:
              arguments:
                to: ref('mart__assets')
                field: canonical_asset_id
      - name: price_usd
        data_tests:
          - not_null
```

Then add a few singular SQL tests for the domain rules generic tests cannot know:

```sql
select *
from {{ ref('mart__asset_prices') }}
where price_usd < 0
```

```sql
select *
from {{ ref('mart__portfolio_exposure') }}
where freshness_status = 'stale'
  and allowed_for_agent_use = true
```

That is the real value. dbt lets a small project say "this table is wrong" before an agent or dashboard turns it into an answer.

## Freshness belongs in the model contract

Crypto users ask time-sensitive questions.

What is my exposure now? Why did BTC value move today? Which assets are stale? What prices did this report use?

If the table cannot answer "as of when?", it is not ready.

dbt source freshness is useful at the ingestion boundary. Mart-level freshness checks are useful at the consumer boundary. They are different checks.

A raw CoinGecko source might need to load once per day. A price mart might need a max `observed_at` age of 15 minutes. A portfolio exposure mart might need to block agent use when its price input is stale.

The small project version is simple:

```text
every mart exposes as_of
every agent-facing mart exposes freshness_status
every stale public mart fails or blocks publish
```

This connects directly to the freshness problem: stale data is a data quality failure, not a dashboard footnote.

## Lineage saves debugging time

Lineage sounds like enterprise jargon until a number is wrong.

If `mart__portfolio_exposure` is off, I want to know which models feed it. Did the bad value come from balances, prices, asset mappings, or a stale source? In a pile of scripts, that answer lives in the developer's head. In dbt, the dependency graph gives you the first map.

That matters for agent workflows too.

An agent asked to debug a report should not have to guess where `value_usd` came from. It should be able to inspect the model chain: balances joined to canonical assets, prices joined by `canonical_asset_id`, freshness derived from `observed_at`.

Good lineage does not fix bugs. It shortens the hunt.

## dbt docs are useful because agents read them

I used to think dbt docs were mostly for humans browsing a catalog.

Now I think they are also agent context.

Column descriptions like these are cheap and valuable:

```yaml
- name: display_symbol
  description: "Human-readable label. Do not use for joins."

- name: canonical_asset_id
  description: "Stable internal asset identifier. Use this for joins across marts."

- name: as_of
  description: "Timestamp the mart represents for consumer-facing answers."
```

That is not decoration. It changes how an agent reasons over the schema. It tells the agent which columns are identity, which are display metadata, and which timestamp controls freshness.

If agents are going to query your analytics layer, the schema needs to speak clearly.

## Start smaller than the docs suggest

The way to make dbt too heavy is to copy an enterprise folder structure into a tiny repo.

Do not do that.

Start with:

```text
sources.yml
three staging models
two marts
one schema.yml
a handful of tests
```

Add folders only when the project earns them. Add exposures when reports exist. Add contracts when a model has real consumers. Add more packages when plain SQL and built-in tests stop being enough.

The small version should feel almost boring.

## Where I would draw the line

I would not use dbt for everything.

Do not use it to call APIs. Do not use it as a queue. Do not use it to manage long-running agents. Do not force Python application logic into SQL because the project already has dbt.

Use dbt where it is strongest: transforming stored data into trusted tables.

For a crypto project, that means:

- normalize raw provider data into staging models
- map provider IDs into canonical assets
- build price, balance, and exposure marts
- test identity, freshness, and relationships
- document the fields agents and reports can trust

That is enough work to justify dbt without making it the center of the universe.

## The practical rule

If the project has one raw source and no consumers, a script is fine.

Once two sources need to agree, once a dashboard depends on the output, or once an agent can query the data, add dbt.

Not because the project is big. Because the assumptions are now expensive.

## References

- [dbt documentation](https://docs.getdbt.com/docs/introduction)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt source freshness](https://docs.getdbt.com/docs/deploy/source-freshness)
- [dbt model contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts)
- [dbt Fusion and Core v2.0](/posts/2026-07-04-dbt-fusion-core-v2-rust-rewrite)
- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-20-freshness-data-quality-dimension)
- [Crypto Symbols Are Not IDs](/posts/2026-07-20-crypto-symbols-are-not-ids)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
