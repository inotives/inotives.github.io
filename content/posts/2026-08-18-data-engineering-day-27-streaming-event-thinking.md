---
title: "Data Engineering in 30 Days, Day 27: Streaming and Event Thinking"
date: 2026-08-18
tags: [data-engineering, learning-path, streaming, event-driven]
summary: "Understand streaming before choosing Kafka: batches versus unbounded events, topics, consumers, offsets, event and processing time, late and duplicate events, out-of-order delivery, and the real limits of exactly-once claims."
series: data-engineering-in-30-days
---

“Real time” does not mean data arrives perfectly and instantly. It means the pipeline must make useful decisions while events keep arriving, sometimes late, twice, or out of order.

You do not need Kafka on day 27. You do need event thinking. Once a system produces an unbounded flow of trades, payments, clicks, device readings, or status changes, a daily batch mental model is not enough. The question stops being “did we load the file?” and becomes “which events have we processed, which may still arrive, and what result are we willing to publish now?”

## The outcome for day 27

By the end, you should be able to:

1. Explain the difference between a bounded batch and an unbounded event stream.
2. Use the vocabulary of topics, producers, consumers, partitions, offsets, and consumer groups.
3. Distinguish event time, ingestion time, and processing time.
4. Design for late, duplicate, and out-of-order events.
5. Question an “exactly once” claim until its end-to-end boundary is clear.

## 1. Batch and streaming are different ways to bound work

**Batch processing** works on a bounded collection. The input has a clear start and end: yesterday's CSV, a completed month, or every row in a source table at a chosen snapshot.

```text
Input: all price observations for 2026-08-17
Start: 2026-08-18 00:00 UTC
End: source interval is complete
Output: one daily market-price mart
```

**Streaming processing** works on an unbounded sequence. New events may arrive indefinitely, so the system creates temporary boundaries through windows, checkpoints, offsets, or watermarks.

```text
Input: price and trade events continuously arriving from providers
Start: consumer resumes at its saved offset
End: no natural end; emit an updated result per window or event
Output: a rolling five-minute price summary and a live freshness signal
```

Streaming is not automatically better. Batch is simpler, easier to replay, and often sufficient. Choose streaming when the decision needs lower latency than a batch interval can provide and the team can support the added state, ordering, and recovery complexity.

For example, a daily research report should remain batch. A circuit-breaker or intraday monitoring alert may need a streaming path. The underlying event model can serve both.

## 2. An event is a fact that happened

An **event** records something that happened at a point in time. It should carry a stable identity, a time, and enough context to interpret the fact.

```json
{
  "event_id": "provider-a:trade:928381",
  "event_type": "trade_executed",
  "provider": "provider_a",
  "market": "BTC/USD",
  "event_time": "2026-08-18T10:00:01.120Z",
  "price": "118450.25",
  "quantity": "0.12"
}
```

The event says a trade executed. It is different from a mutable current-state record such as “the latest BTC price is 118450.25.” Current state can be derived from events, but it can change as new events arrive. Retaining the event and its identity makes replay, audit, deduplication, and late-data repair possible.

Not every source provides a perfect `event_id`. When it does not, create a documented idempotency key from source fields, while accepting that the key may be less reliable than a source-assigned immutable ID.

## 3. The basic stream vocabulary

Most streaming platforms use different names for similar ideas.

| Term | Meaning | Market-data example |
| --- | --- | --- |
| Producer | Writes events to a stream. | An exchange gateway publishes trade events. |
| Topic or stream | A named, append-oriented category of events. | `market.trades.v1`. |
| Partition | An ordered shard of a topic used for scale. | Events are distributed by market key. |
| Consumer | Reads events and performs work. | A price-summary service reads trades. |
| Consumer group | Consumers cooperating so each partition is handled once by the group. | Four workers share market partitions. |
| Offset | A consumer's position in an ordered partition. | “This worker safely processed through event 83,912 in partition 4.” |
| Checkpoint | Saved processing state, often including offsets and window state. | The aggregation job can restart without rereading an unknown range. |
| Retention | How long the platform keeps events available for replay. | Seven days of trade events remain readable after publication. |

An offset is not a universal event time. It is usually an ordering position within one partition. Two partitions can advance independently, so there may be no total global ordering across an entire topic.

### Partitions trade ordering for scale

Within a partition, platforms commonly preserve producer order. Across partitions, events can be processed in parallel and appear interleaved. The partition key is therefore a business decision.

```text
Key by market:
  all BTC/USD events stay ordered together
  different markets can process in parallel

Key randomly:
  load may balance evenly
  order for one market can no longer be assumed
```

Choose a key from the unit that requires order: account, order, device, market, or customer. A poor key can create **hot partitions**, where one popular asset or customer receives most traffic and defeats parallelism.

## 4. One event carries several clocks

Time is the core streaming problem. An event can have several meaningful times:

| Clock | Meaning | Example |
| --- | --- | --- |
| Event time | When the business event happened at the source. | Trade executed at 10:00:01.120 UTC. |
| Ingestion time | When the broker or landing system accepted it. | Gateway wrote it at 10:00:01.400 UTC. |
| Processing time | When a particular consumer handled it. | Aggregator processed it at 10:00:08 UTC. |
| Receipt time | When your service received it from the provider. | Collector received the provider message at 10:00:01.350 UTC. |

For business analytics, event time is usually the right basis for hourly or daily windows. For operating the pipeline, receipt and processing time reveal lag, outages, and backlog.

If a provider reconnects after an outage, it may deliver a 10:00 trade at 10:07. A processing-time window puts that trade in the 10:05–10:10 bucket. An event-time window correctly belongs it in 10:00–10:05. The choice changes the published result.

## 5. Late, duplicate, and out-of-order is normal

These cases are often presented as edge cases. They are routine distributed-systems behaviour.

```text
10:00:01 event A occurs
10:00:02 event B occurs
10:00:08 event B arrives
10:00:09 event A arrives
10:00:10 event B is delivered again after a retry
```

If a consumer assumes arrival order equals event order and every delivery is unique, it produces the wrong rolling result.

### Late events

A late event has an event time earlier than the current processing time or already-published window. A **watermark** is the system's estimate of how complete event-time processing is. It gives a policy boundary, such as:

```text
Close a five-minute window when event-time watermark passes its end.
Accept corrections for 30 minutes after close.
After 30 minutes, retain late events and route them to a backfill or review process.
```

There is no perfect watermark in an unreliable network. A longer allowed-lateness period improves completeness but delays finality. A shorter period improves latency but produces more later corrections. State the trade-off for the consumer instead of hiding it.

### Duplicate events

Duplicates occur when a producer retries, a consumer restarts before committing its offset, or a network acknowledgement is lost. The safe response is idempotent processing:

```sql
INSERT INTO raw.trade_event (event_id, market, event_time, price, quantity)
VALUES (...)
ON CONFLICT (event_id) DO NOTHING;
```

If the source lacks an immutable ID, a deduplication key may combine provider, market, source trade ID, event time, price, and quantity. Document its collision risk. A guessed key that merges two real trades is as dangerous as a duplicate.

### Out-of-order events

Out-of-order arrival means a later event arrives before an earlier one. Keep event-time order for calculations that require it, such as a price change or balance state. A windowed aggregate can update when an older event arrives within its allowed lateness. A stateful consumer may need to buffer, reorder, or issue a correction rather than publish a final answer immediately.

## 6. “Exactly once” needs an end-to-end definition

Streaming systems often promise at-most-once, at-least-once, or exactly-once delivery or processing. These words are useful only when the boundary is named.

| Claim | Practical meaning | Risk |
| --- | --- | --- |
| At-most-once | An event is processed zero or one time. | Failures can lose events. |
| At-least-once | An event is eventually retried until processed. | Duplicates are possible. |
| Exactly-once within a platform boundary | The platform coordinates reads, state, and writes to a supported sink transactionally. | External side effects may still repeat or fail separately. |
| Effectively once | The application uses idempotent keys and reconciliation so duplicate delivery has one intended result. | Requires careful business keys and repair paths. |

For example, a stream processor might atomically checkpoint its offset and write to a supported internal state store. That does not prove that an email, payment API request, or external database call happened exactly once. The consumer must make the external action idempotent too, often with an idempotency key or an outbox-style record.

For data engineering, **effectively once** is often the honest goal: preserve source IDs, make sinks idempotent, track checkpoints, and reconcile expected versus received events. It is more valuable than a broad “exactly once” label with no failure story.

## 7. Windows turn an infinite stream into useful results

Because a stream has no end, aggregation needs a boundary.

| Window type | Meaning | Example |
| --- | --- | --- |
| Tumbling window | Fixed, non-overlapping intervals. | One OHLC summary per market every five minutes. |
| Sliding window | Fixed-size windows that overlap. | Rolling 30-minute trade volume updated every five minutes. |
| Session window | Groups activity separated by idle gaps. | One user session after 30 minutes of inactivity. |
| Global state | One continuously updated value per key. | Latest trade price per market. |

For a five-minute OHLC result, state the contract clearly:

```text
Grain: one provider market per event-time five-minute window.
Allowed lateness: 30 minutes.
Revision policy: update the window while lateness is allowed; then emit a correction
                 through a controlled backfill path.
Duplicate policy: ignore repeated source event IDs.
```

The result is a data product with freshness and revision semantics, not merely a table that updates often.

## 8. Batch and streaming should agree where they overlap

The same business metric may have a low-latency stream path and a more complete batch path:

```text
streaming five-minute price summary → fast but revisable
daily batch reconciliation          → slower but certified complete
```

This is a healthy pattern. The batch job replays or queries the full bounded day, applies the final late-data policy, and reconciles the daily aggregate with the stream result. Consumers can then distinguish a provisional intraday metric from a certified end-of-day value.

Do not require the streaming path to be permanently perfect before publishing anything. Make its uncertainty visible and give batch reconciliation ownership of final correctness.

## A small exercise for day 27

Design a streaming contract for one source. You can use trades, application clicks, payment status changes, or sensor readings.

```text
Event type and grain:
Stable event ID or deduplication key:
Topic and partition key:
Consumer and consumer-group purpose:
Event, receipt, and processing time fields:
Window or current-state output:
Allowed lateness and revision policy:
Duplicate policy:
Offset and checkpoint rule:
Exactly-once boundary or effectively-once strategy:
Batch reconciliation path:
```

Then simulate three events: one late, one duplicate, and one out of order. Explain what the consumer publishes immediately, what it revises, and what waits for batch reconciliation.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Stream | An unbounded sequence of events. | `Compare a daily batch and a trade-event stream. Explain how each decides when its input is complete.` |
| Event | An immutable record that something happened. | `Design a trade_executed event with stable ID, event time, market, price, quantity, and schema version. Explain why each field exists.` |
| Producer | A system that publishes events. | `Explain producers, consumers, topics, and brokers using a market-data gateway and price-summary service.` |
| Topic | A named append-oriented category of related events. | `Design topics for trades, market metadata changes, and ingestion failures. When should separate event types use different topics?` |
| Partition | An ordered shard used to scale a topic. | `Teach partition keys using trade events. Compare keying by market, customer, and random value for ordering, parallelism, and hot partitions.` |
| Consumer group | Consumers cooperating to read partitions without duplicate work inside the group. | `Explain consumer groups with four workers reading eight market partitions. What happens when a worker fails?` |
| Offset | A read position within a partition. | `Explain offsets and checkpoints. Show why committing an offset before an idempotent database write can lose an event.` |
| Event time | The time the source says an event occurred. | `Explain event time, ingestion time, receipt time, and processing time using a trade that arrives seven minutes late.` |
| Watermark | A policy estimate of how complete event-time processing is. | `Design a watermark and allowed-lateness policy for five-minute price windows. Explain latency versus finality.` |
| Out-of-order event | An event that arrives in a different order from its business time. | `Show how out-of-order trades affect latest-price and OHLC calculations. Which state or correction strategy is needed?` |
| At-least-once | Delivery or processing that may repeat after failures. | `Explain at-most-once, at-least-once, exactly-once, and effectively-once with a database sink and an external notification.` |
| Tumbling window | A fixed non-overlapping event-time interval. | `Build a five-minute tumbling window contract for market prices, including grain, late-data rule, and correction policy.` |

When asking an LLM to design a stream, include the event identity, ordering key, source replay behaviour, maximum expected lateness, sink transaction boundary, and consumer decision deadline. A design that is correct for click analytics can be unsafe for payments or market-risk controls.

## What comes next

Days 28–30 finish the path with data products, contracts, AI-ready data systems, and a capstone that joins the month’s concepts into one small but dependable pipeline.

## References

- [Apache Kafka documentation](https://kafka.apache.org/documentation/)
- [Apache Flink documentation: event time and watermarks](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)
- [Apache Spark Structured Streaming documentation](https://spark.apache.org/docs/latest/streaming/index.html)
- [Apache Beam programming guide: event time](https://beam.apache.org/documentation/programming-guide/#event-time)
