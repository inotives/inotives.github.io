---
title: "9 Databricks Updates That Change How Data Teams Build on the Lakehouse"
date: 2026-09-16
tags: [data-engineering, databricks, ai, governance, spark, real-time-data]
series: data-engineering
summary: "Nine recent Databricks updates across pipelines, CDC, SQL AI, RAG, analytics agents, model serving, governance, Spark, and real-time ingestion, with the practical engineering decisions each one changes."
---

The recent Databricks platform updates are not nine unrelated product launches. Together, they move more of the work that normally spills into separate pipeline tools, RAG services, model gateways, and policy systems into the lakehouse.

That can reduce operational overhead. It can also hide important choices behind a friendlier interface. A visual pipeline still needs a source contract. An AI SQL function still needs evaluation. A tag-based policy is only as good as the tags. The useful question for a data team is not whether a feature exists. It is what decision it changes in production.

Here is how I would read the nine updates.

## 1. Lakeflow Designer: visual work that does not have to become notebook sprawl

Lakeflow Designer is a visual, no-code canvas for data preparation and basic automation. Users drag operators for filtering, joins, aggregation, and reshaping, then inspect the generated code behind each step. Databricks positions the output as production-ready code governed by Unity Catalog, rather than a disposable analyst workflow.

This matters when analysts understand a transformation but should not need to assemble a Spark project to try it. A finance analyst can shape an invoice feed, preview the result, and hand an engineer a versionable implementation rather than a screenshot of spreadsheet formulas.

The engineering control is familiar: generated code must enter source control, have an owner, and deploy through the same review path as any other Lakeflow job. A drag-and-drop canvas does not make a metric definition correct. It makes the change easier to express.

## 2. Automatic Change Data Feed: fewer write-time CDC decisions

Automatic Change Data Feed (Auto CDF) is generally available in Databricks Runtime 19. It computes row-level changes at query time rather than requiring change-data-feed configuration on every source table at write time. It works with Delta tables that have row tracking and with supported Apache Iceberg v3 tables registered in Unity Catalog.

For a lakehouse with customer records or exchange account balances, that means a downstream process can consume inserts, updates, and deletes without adding legacy CDF configuration table by table. Databricks says Auto CDF uses the same `table_changes()` and `readChangeFeed` APIs, so consumers do not need a new query pattern.

Do not read this as "CDC is solved." A CDC design still needs a stable key, an ordering rule, tombstone retention, retry behaviour, and a decision about what a schema rename means downstream. Auto CDF has limitations around non-additive schema changes and does not make an external consumer understand Iceberg's change semantics. It removes setup and write-time overhead; it does not remove data modelling.

## 3. `ai_extract`: structured extraction inside SQL

The `ai_extract()` function extracts structured data from text or parsed documents according to a schema you provide. The schema can describe nested objects, arrays, types, and field descriptions. It can be paired with document parsing, which makes it useful for invoices, contracts, filings, and operational PDFs.

An insurance operations team could extract policy number, insured entity, effective date, currency, and payment amount from incoming documents into a Silver table. A crypto compliance team could pull named entities, wallet addresses, and stated transaction references from a case attachment.

The advantage is that the extraction runs next to the table and can be expressed in a data pipeline. The risk is treating model output as a fact. Persist the original document reference, extraction schema version, model result, confidence or citation metadata where available, and a review status. A malformed invoice should become `review_required`, not a silent row in accounts payable.

## 4. AI Search: RAG is becoming less allergic to real data shapes

Databricks AI Search now supports structured types such as `STRUCT` and `MAP`, alongside metadata filtering and filter-only queries. That helps with a common RAG failure: turning every useful field into a blob of text because the vector index cannot otherwise use it.

Consider an internal incident assistant. The semantic question may be "why did funding ingestion stop?" The hard constraints are `venue = 'coinex'`, `environment = 'prod'`, and an incident date range. A useful retrieval system needs both. It should search incident narratives semantically while applying structured filters to the operational facts.

Keep a separate retrieval evaluation set. Measure whether the right document appears after filters, whether structured constraints are obeyed, and whether a no-result response stays a no-result response. Hybrid retrieval is better than pure similarity search for many enterprise questions, but it still fails if the metadata is missing or wrong.

## 5. Genie: current external context and recurring agent work

Two Genie changes affect different users. Genie One can search the public web when a question needs current information and show source links. Genie Code can run a prompt on a recurring schedule, creating a new chat for each run.

This makes a useful operational pattern possible: a morning task can summarise overnight Lakeflow failures, compare the run history to a public provider-status page, and prepare a triage brief. The person on call still reviews it before changing a production pipeline.

That last step matters. Scheduled Genie Code runs auto-approve tool actions because the creator is absent. The run uses the creator's permissions. Schedule read-oriented analysis first, set budgets, review a sample of outputs, and do not grant a recurring prompt authority to make irreversible changes merely because it produced good answers in a chat.

## 6. Expanded model choice: model routing is now a platform concern

Databricks Foundation Model APIs and external model serving bring more model providers, including OpenAI and Anthropic, behind platform-managed endpoints. The client experience is often OpenAI-compatible, while Unity Catalog permissions, usage tracking, and serving controls stay inside Databricks.

This reduces the need for every data product to keep its own provider key and bespoke proxy. It does not mean every model is interchangeable. Region availability, data processing geography, rate limits, model capability, latency, and unit cost differ by provider and model.

Build a small evaluation harness before routing production traffic. Test the actual document extraction, SQL generation, or support workflow against representative data. Record model, prompt version, latency, token usage, failure category, and human acceptance. "We can call several models" is a capability. A measured routing policy is the engineering work.

## 7. Unity Catalog ABAC: policy follows governed tags

Attribute-Based Access Control (ABAC) in Unity Catalog applies policies dynamically using governed tags. A policy can sit at a catalog, schema, or table level and apply row filters or column masks when an object carries matching attributes. It is a major improvement over copying a hand-written mask onto every new table.

A practical example is tagging columns with `classification=pii` and applying a central mask policy for users who lack an approved purpose or regional attribute. When a new customer table arrives in the governed schema, the policy can apply without a separate grant script for every column.

ABAC does not replace baseline permissions and ownership. It adds a scalable fine-grained layer. Start with a small tag taxonomy, assign data stewards for tag quality, and test policy behaviour with real principal types. A broad or incorrectly inherited tag can create a much larger access incident than a single incorrect table grant.

## 8. Databricks Runtime 19: Spark 4.2 needs a migration plan

Databricks Runtime 19 is generally available and is powered by Apache Spark 4.2.0. It brings new engine capabilities, including support for Auto CDF, but runtime upgrades are never only about new features.

Runtime 19 moves to JDK 21 and removes a large set of previously bundled Python packages. Standard-access mode also tightens some environment variable and Spark configuration behaviour. A pipeline that has quietly relied on a preinstalled package or a permissive cluster option can fail after an upgrade.

Treat the upgrade as a release: run unit and integration tests on representative volume, inspect dependency lock files, test checkpoints and schema evolution, compare key aggregates, then promote through development and staging. Avoid updating the daily production CDC pipeline on the same day you discover a new runtime feature.

## 9. Zerobus Ingest: a lower-latency path, not a replacement for every batch

Zerobus Ingest expands Databricks' real-time ingestion options with Apache Arrow Flight for columnar `RecordBatch` data, alongside JSON and Protocol Buffers SDK paths. It is aimed at high-throughput streaming ingestion with low latency and direct table writes.

That fits event streams where waiting for files in object storage is the bottleneck: clickstream events, fraud signals, operational telemetry, or rapidly changing market events. For a trading-data system, it can reduce the time between a venue event and a governed table that drives monitoring.

It does not replace Auto Loader for daily Parquet exports or S3-based CDC drops. Choose it when the latency objective and event rate justify a persistent streaming producer. Then design for backpressure, idempotency, schema evolution, producer retry, and cost. A faster ingest path can turn a producer bug into a faster data-quality incident.

## What to adopt first

For the AWS and Databricks lakehouse described in the earlier articles, I would not switch on all nine changes at once.

Start with the changes that remove clear friction:

1. Put Lakeflow Designer output and bundle definitions under the existing product repository and CI path.
2. Evaluate Auto CDF on one well-understood Delta source with row tracking.
3. Adopt ABAC for a narrow, stable tag taxonomy such as PII and environment.
4. Use `ai_extract` on a reviewable document workflow with a labelled evaluation set.
5. Pilot AI Search and Genie on read-only internal knowledge before giving agents operational tools.
6. Run Runtime 19 and Zerobus trials beside existing production paths until the compatibility and latency evidence is real.

The common thread is governance. Databricks is making data engineering, AI, and infrastructure feel closer to one platform. That only pays off when the team also keeps one deployment path, one ownership model, and enough evidence to explain how a result was produced.

## References

- [Lakeflow Designer documentation](https://docs.databricks.com/aws/en/designer/what-is-lakeflow-designer)
- [Databricks Runtime 19 release notes](https://docs.databricks.com/aws/en/release-notes/runtime/19)
- [`ai_extract` SQL function](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_extract)
- [Databricks AI Search](https://docs.databricks.com/aws/en/ai-search/ai-search)
- [Genie Code scheduled tasks](https://docs.databricks.com/aws/en/genie-code/scheduled-tasks)
- [Foundation Model APIs](https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis)
- [Unity Catalog ABAC](https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac)
- [Zerobus Ingest](https://docs.databricks.com/aws/en/ingestion/zerobus-ingest)
