---
title: "Data Engineering in 30 Days, Days 1–2: How Data Systems Actually Work"
date: 2026-08-10
tags: [data-engineering, learning-path, data-systems, databases]
summary: "The first two days of data engineering: understand what the job owns, distinguish operational from analytical systems, and describe data with schemas, keys, and time before building a pipeline."
series: data-engineering-in-30-days
---

Before learning an orchestration tool or a warehouse, learn to recognise the system in front of you. Most painful data incidents begin with a misunderstanding that happened earlier: a team used an operational table as an analytics source, treated a mutable value as history, or copied a field without deciding what it meant.

Days 1 and 2 are about the vocabulary that prevents those mistakes. We will use a small crypto-market product throughout. It collects prices from exchanges, lets users inspect market history, and later feeds a research dashboard and an AI analyst.

## The outcome for these two days

By the end, you should be able to look at a product request and answer four questions:

1. Where is the source of truth?
2. Is this system trying to operate the product or analyse what has happened?
3. What does each record represent?
4. What must be true for another person or system to trust the data?

That is already data engineering. Code comes after those answers.

## 1. What a data engineer actually owns

A data engineer makes data usable beyond the system that first produced it. The work usually spans four responsibilities:

| Responsibility | Meaning | Market-data example |
| --- | --- | --- |
| Capture | Collect data from a source without losing the useful evidence. | Save the exchange API response and when it was received. |
| Shape | Convert source-specific records into a common, documented model. | Turn `BTCUSDT` and `BTC/USDT` into one standard symbol representation. |
| Deliver | Make reliable tables, files, or APIs available to downstream users. | Publish a daily price mart for a dashboard or research agent. |
| Operate | Detect failures, repair them safely, and explain the data's history. | Alert when an exchange has not sent a price for an hour. |

The job is not “move data from A to B.” Moving data is the visible part. The real job is creating a reliable agreement between a producer and a consumer.

For example, an analyst asks: “Which assets gained more than 10% yesterday?” The question sounds like a query. The data engineer has to establish which exchanges count, what “yesterday” means in a time zone, whether a price is a trade or a quote, what happens when a provider is late, and which currency is used to calculate the percentage. A query without those decisions can be perfectly valid SQL and still be wrong.

## 2. Operational data and analytical data solve different problems

The most important early distinction is between an operational system and an analytical system.

An **operational system** supports the product right now. It is optimised for small, frequent reads and writes: create a user, place an order, update a subscription, or return the latest price. Its tables often store the current state.

An **analytical system** helps people understand what happened over time. It is optimised for scanning, joining, aggregating, and keeping history: daily volume by provider, price movement over a month, or the number of failed ingestion runs.

Imagine the product has this operational table:

```text
latest_price
┌──────────┬────────┬────────┬──────────────┐
│ provider │ symbol │ price  │ updated_at   │
├──────────┼────────┼────────┼──────────────┤
│ Binance  │ BTC/USD│ 118450 │ 10:05:00 UTC │
└──────────┴────────┴────────┴──────────────┘
```

It is great for a product page that needs the current BTC price. It cannot answer “what was the highest price yesterday?” because each update overwrites the previous value.

An analytical table preserves observations instead:

```text
price_observation
┌─────────────────────┬──────────┬─────────┬────────┬───────────┐
│ observed_at         │ provider │ symbol  │ price  │ received_at│
├─────────────────────┼──────────┼─────────┼────────┼───────────┤
│ 2026-08-10 10:00:00 │ Binance  │ BTC/USD │ 118300 │ 10:00:02  │
│ 2026-08-10 10:05:00 │ Binance  │ BTC/USD │ 118450 │ 10:05:03  │
└─────────────────────┴──────────┴─────────┴────────┴───────────┘
```

Both tables can be correct. They support different work. Do not turn the application database into a warehouse by running large daily reports against live product tables. Do not try to serve every user request from a historical fact table. Good systems separate the responsibilities and move data between them deliberately.

### A quick test

Ask what happens when a value changes.

- If the old value can disappear because only the current state matters, it is probably operational data.
- If the old value must remain so someone can compare, audit, or aggregate it later, it belongs in an analytical history.

This is not an absolute rule. Operational databases can retain history, and warehouses can contain current snapshots. It is a useful way to start asking the right design question.

## 3. A record needs a grain

The **grain** of a table is the real-world thing represented by one row. It is the most important sentence to write before modelling a table.

For `price_observation`, the grain might be:

> One row is one price reported by one provider for one market at one observation time.

That sentence tells us why these columns matter:

```sql
CREATE TABLE price_observation (
  provider text NOT NULL,
  symbol text NOT NULL,
  observed_at timestamptz NOT NULL,
  price numeric NOT NULL,
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider, symbol, observed_at)
);
```

It also exposes questions we have not decided yet. Can the same provider send two different prices for the same symbol and timestamp? Is the timestamp supplied by the exchange or assigned by our collector? Is `price` a last trade, best bid, best ask, or a midpoint? The schema forces a conversation that an unstructured JSON file postpones.

Grain prevents a common reporting error: joining two tables that represent different things and accidentally multiplying rows. If one table has one row per market per minute and another has many trades per market per minute, joining on the market alone repeats the minute-level price for every trade. The numbers may look plausible until an aggregate becomes much larger than reality.

## 4. Keys connect data to reality

A **key** identifies a record or links it to another record. Start with three kinds:

| Key | Purpose | Example |
| --- | --- | --- |
| Primary key | Identifies one row in its own table. | `provider_id` identifies one provider. |
| Foreign key | Links a row to a valid row elsewhere. | `market.provider_id` points to `provider.provider_id`. |
| Natural key | A meaningful business identifier. | The pair `Binance` and `BTC/USDT` identifies a market in a source system. |

Use a stable internal ID when a source identifier can change. Exchanges rename markets, merge products, or use their own symbol grammar. A model with an internal `market_id` and a provider-specific symbol map can preserve history even when an external label changes.

```text
market                         provider_market_symbol
┌───────────┬──────────────┐    ┌───────────┬──────────┬───────────┐
│ market_id │ canonical_id │    │ market_id │ provider │ symbol    │
├───────────┼──────────────┤    ├───────────┼──────────┼───────────┤
│ 101       │ BTC/USD      │    │ 101       │ Binance  │ BTCUSDT   │
└───────────┴──────────────┘    └───────────┴──────────┴───────────┘
                                 │ 101       │ Kraken   │ XBT/USD   │
                                 └───────────┴──────────┴───────────┘
```

The point is not to memorise terminology. It is to make joins and history safe. A dashboard should not quietly treat `BTCUSDT` and `XBT/USD` as two unrelated assets because no one designed the mapping.

## 5. A schema is an agreement, not a list of columns

A **schema** describes the structure and meaning of data. Types are only the first layer. This table is syntactically complete but semantically weak:

```text
symbol: text
price: number
timestamp: timestamp
```

The same fields become useful when their contract is clear:

```text
symbol: canonical market identifier such as BTC/USD
price: last-traded price in the quote currency, decimal, never rounded for storage
observed_at: event time supplied by the provider, stored in UTC
received_at: time our collector received the payload, stored in UTC
```

The distinction between `observed_at` and `received_at` is a small example of a large idea. A provider may publish a price at 10:00 and our collector may receive it at 10:04 because of a network failure. Both times are true. They answer different questions:

- `observed_at` helps analyse the market.
- `received_at` helps operate the pipeline.

Store both when the source permits it. Otherwise, an incident can make yesterday's data look as if it happened four minutes later than it did.

## 6. Follow one datum through its lifecycle

Data engineering becomes easier to understand when you trace one record from creation to use:

```text
Exchange API → raw payload → cleaned observation → analytics mart → dashboard or agent
```

At each step, ask a different question:

| Step | Question | Example decision |
| --- | --- | --- |
| Source | What did the provider actually send? | Retain the full JSON response and request metadata. |
| Raw | Can we replay or investigate this input? | Store the payload unchanged with a receipt time. |
| Cleaned | Can records from many providers be compared? | Normalise symbols, types, and timestamps. |
| Mart | Can a consumer answer a business question safely? | Publish daily open, high, low, close, and volume. |
| Consumer | Who uses it and under which constraints? | Give an AI analyst read-only access to the documented mart. |

The raw layer is particularly important in the AI era. An agent that receives a surprising result needs evidence it can trace back to a source response, not a polished number with unknown ancestry. Keep raw data private and access-controlled when it contains sensitive information, but do not throw it away just because a transformation succeeded today.

## A small exercise for day 2

Choose a data source you can explain: a weather API, a bank transaction export, a fitness tracker, or an exchange ticker endpoint. Write a one-page data note with these headings:

```text
Source of truth:
Consumer question:
Operational or analytical use:
Grain of one record:
Primary or natural key:
Event time and receipt time:
Fields that need a definition:
What could change or arrive late:
```

Do not build the pipeline yet. If you cannot fill in these lines, you are not blocked; you have found the questions the next conversation with the source owner must answer.

## Terminology to learn with an LLM

These terms will appear throughout the series. Do not try to memorise them as a glossary. Pick one, ask an LLM for an example from the data source you chose, then check whether you can identify it in your own note.

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Source of truth | The system or record considered authoritative for a fact. | `Explain source of truth in data engineering using an exchange price API. Show what goes wrong when two systems both claim to be authoritative.` |
| Operational database (OLTP) | A database designed to run the application’s current transactions. | `Teach me OLTP with a simple order-placement example. Contrast it with an analytics database and give me a small table for each.` |
| Analytical database (OLAP) | A system designed to scan, aggregate, and compare historical data. | `Explain OLAP for a beginner using daily crypto price analysis. Show one query that an OLTP table cannot answer well.` |
| Schema | The structure and agreed meaning of a dataset’s fields. | `Help me write a schema for price observations from multiple exchanges. Explain types, units, nullability, and field definitions.` |
| Grain | The real-world event or entity represented by one row. | `Explain table grain using a price-observation table. Give three possible grains that people often confuse and show how each changes the primary key.` |
| Primary key | A value, or set of values, that uniquely identifies one row. | `Teach primary keys with examples from providers, markets, and price observations. Explain how to test whether a proposed key is truly unique.` |
| Foreign key | A field that links a row to a valid row in another table. | `Explain foreign keys using assets, markets, and providers. Show a SQL example and one data-quality failure it prevents.` |
| Natural key | A meaningful business identifier supplied by the domain or source. | `Compare natural keys and surrogate keys using BTC/USDT symbols from different exchanges. When should I keep both?` |
| Event time | The time the real-world event occurred. | `Explain event time and processing time with a provider that publishes a price late. Show why they create different charts.` |
| Receipt time | The time your system received a record. | `Explain receipt time versus event time for debugging a delayed ingestion pipeline. Give a table with two example records.` |
| Raw data | The captured input kept close to what the source supplied. | `Explain why a data pipeline should retain raw API payloads. Include privacy, storage cost, replay, and debugging trade-offs.` |
| Data lineage | The trace from a displayed value back through transformations to its source. | `Show data lineage for a daily BTC closing-price metric, from exchange API response to dashboard. What metadata should be recorded at each step?` |

When using an LLM, add your own source and assumptions to the prompt. “Explain this using my provider’s `lastPrice` field, which is updated every minute” will teach you more than a generic request. Then verify technical claims against the source documentation before putting them into a production pipeline.

## What comes next

The next article moves from concepts to data in motion: files, CSV, JSON, Parquet, and the first checks to run before trusting a dataset. For now, take the operational-versus-analytical distinction, define the grain, and make time and keys explicit. Those habits will make every tool introduced later easier to use well.

## References

- [PostgreSQL documentation: data types](https://www.postgresql.org/docs/current/datatype.html)
- [PostgreSQL documentation: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [dbt guide: data modeling](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview)
