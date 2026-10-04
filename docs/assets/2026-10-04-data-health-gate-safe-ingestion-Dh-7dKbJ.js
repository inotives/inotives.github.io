var e=`---
title: "Before Bronze: Designing a Reusable Data Health Gate for Safe Ingestion"
date: 2026-10-04
tags: [data-engineering, data-quality, data-contracts, data-ingestion, schema-drift, data-lakehouse]
summary: "A general design for validating incoming data before it reaches a trusted landing zone: contracts, schema and type checks, content rules, anomaly detection, quarantine, audit records, replay, and idempotent promotion."
series: data-engineering
---

An ingestion job can finish successfully while the data it delivered is unusable. The file may be present but empty. A producer may rename a key, change a timestamp into a string, or add a field containing sensitive data. The scheduler sees a green task. The next layer sees a broken contract.

The missing piece is a data health gate: a repeatable set of checks between an incoming batch and the first trusted landing zone. The gate should work with Mage, Prefect, Airflow, Dagster, a Spark job, or a small custom service. It belongs to the ingestion design, not to one orchestrator.

![Reusable data health gate architecture](/assets/images/data-health-gate-architecture.svg)

This article describes the common checks and controls I would put around that gate. It is a design pattern, not a claim that one validation tool covers every case.

## Raw is not trusted

The first useful boundary is an immutable landing area. Keep the source files, arrival metadata, and batch identifier before transforming them. Raw data gives the team something to inspect and replay when a rule changes.

That does not make Raw clean. It only makes it durable.

The health gate reads from Raw and decides whether a batch can move into Bronze, a warehouse staging table, or another trusted landing zone. The name of the destination changes between platforms. The control boundary does not.

## Start with a batch manifest

Every batch needs a control record. A manifest can be a table, a small JSON document, or metadata in an ingestion system, but it should answer the same questions:

\`\`\`text
batch_id
source_system
source_uri
arrival_time
source_event_time_range
file_count
byte_count
row_count
schema_fingerprint
contract_version
validation_attempt
status
\`\`\`

The status should be explicit. \`pending\`, \`validating\`, \`accepted\`, \`quarantined\`, and \`closed\` are more useful than inferring state from task logs. Record the validator version and rule results with the manifest so a later investigation can tell which logic made the decision.

The manifest also gives retries an identity. If the same file is delivered twice, the pipeline can recognize the batch instead of quietly appending duplicate records.

## Validate in a useful order

Run cheap structural checks before expensive content and history checks. There is no reason to calculate a distribution profile for a file that cannot be opened.

![Data health validation funnel](/assets/images/data-health-gate-validation-funnel.svg)

### 1. File and transport checks

Confirm that the expected object arrived and can be read.

Check for:

- missing files or incomplete multipart uploads;
- zero-byte or suspiciously small files;
- unreadable Parquet, CSV, JSON, or Avro content;
- invalid encoding or compression;
- checksum or object-version mismatches;
- unexpected file counts in a batch;
- a source object already processed under another batch ID.

These checks catch delivery problems before they become data problems. Keep the original object and the error details when they fail.

### 2. Schema and contract checks

A schema contract defines the shape the consumer expects. At minimum, it should describe column names, physical types, nullability, nested fields, and a contract version.

Compare the incoming schema with the expected one and classify the difference:

- a missing required column is usually a hard failure;
- an added nullable column may be compatible;
- a renamed column is not the same as an added column;
- a nested-field change needs its own compatibility rule;
- column order may be irrelevant for a named schema but important for positional formats;
- a contract-version change may require an explicit migration.

Do not reduce schema drift to “the column list changed.” A field can keep its name while changing from cents to dollars, UTC to local time, or a short identifier to a free-form string.

### 3. Type and coercion checks

Types are where permissive ingestion causes expensive surprises. Decide which conversions are safe before the pipeline sees them.

Examples include:

- integer to decimal with enough precision;
- string to timestamp only when the format and timezone are known;
- numeric text with invalid values such as \`N/A\` or \`unknown\`;
- boolean fields containing several spellings;
- decimal scale or currency changes;
- a nested object arriving where a scalar was expected.

Silent coercion should not be the default. Count failed casts and record sample values. If the target table accepts a nullable value after coercion, that should be a documented rule rather than an accidental side effect of a parser.

### 4. Content and business-rule checks

Once the file is structurally valid, inspect the values.

Common rules cover required fields, allowed values, regular-expression formats, numeric ranges, and relationships between columns. A start time after an end time is invalid even when both columns have the correct type. A percentage outside its expected range is a content failure, not a schema failure.

Separate hard rules from warnings. A missing primary identifier should block promotion. A small increase in an optional field's null rate may create a warning that needs an owner and an expiry date.

### 5. Volume and distribution checks

A batch with the right columns can still be wrong at scale. Compare the batch with recent history where a baseline exists.

Useful signals include:

- row-count changes beyond an agreed threshold;
- sudden changes in distinct-key counts;
- a large shift in null rates;
- a new dominant category;
- a file-size or partition-size anomaly;
- an unexpected number of partitions;
- a source that has stopped producing data.

These are anomaly signals, not universal truths. A holiday spike may be valid. The system should record the comparison and route the decision to a human or a policy rather than rejecting every unusual batch.

### 6. Keys and relationships

Check the identifiers that make the dataset usable.

Within a batch, test uniqueness where a key is supposed to be unique. Across batches, detect repeated batch IDs or duplicate source records. Between datasets, look for orphaned foreign keys, missing reference data, and incompatible key formats.

Referential checks need a freshness rule. A late reference record may be a temporary warning in one pipeline and a hard failure in another. The choice belongs in the contract.

### 7. Time and freshness

Validate both the time the data describes and the time it arrived.

Look for future timestamps, impossible dates, gaps in expected intervals, late-arriving records, and batches that have exceeded their freshness objective. A current object with yesterday's event time may be acceptable for a backfill and unacceptable for a dashboard.

Keep event time, source update time, arrival time, and processing time separate. Combining them into one \`updated_at\` field hides the exact problem the health gate is meant to expose.

### 8. Security and privacy checks

Schema validation should include an unexpected-data check. A producer can add an email address, access token, or other sensitive field without changing the file format.

Compare incoming columns and sampled values against the dataset's classification. Route unexpected sensitive data to quarantine and alert the data owner. This is a useful control even when the pipeline has no formal data catalog yet.

## Choose an explicit outcome

Every rule needs an outcome policy. A practical set is:

\`\`\`text
pass       → promote to trusted landing
warn       → promote with an exception and owner
quarantine → retain the batch and block promotion
reject     → stop processing and alert
\`\`\`

Warnings need limits. Store the rule ID, observed value, threshold, owner, and expiry date. Otherwise “warning” becomes a quiet second path for bad data.

Quarantine should preserve the batch, validation report, manifest, and relevant logs. Do not copy only the error message into a ticket and delete the evidence. The files are often what reveals whether the producer or the validator is wrong.

## Failure needs a recovery path

The health gate is incomplete if its failure path ends at an alert.

![Data health rejection and replay loop](/assets/images/data-health-gate-recovery.svg)

An operator needs to identify the failing rule, inspect the source, choose a correction, and replay the same batch. The replay must be safe if the first attempt partially wrote data. Use a batch ID, a manifest state, and an idempotent write strategy so a successful retry does not duplicate trusted records.

There are two different corrections:

- fix the source and replay the original batch;
- fix the validator or contract and re-run the unchanged source.

Record which one happened. It affects lineage, audit history, and confidence in the downstream data.

## Keep the gate independent from the runner

The orchestrator should schedule work, handle retries, and report task state. The health gate should evaluate data and produce a durable decision. A useful interface might return a validation report containing:

\`\`\`text
batch_id
status
contract_version
validator_version
hard_failures[]
warnings[]
metrics{}
schema_diff{}
\`\`\`

That interface can be implemented by SQL tests, a Python package, a validation service, or a framework such as Great Expectations or Soda. The important part is the separation of the decision from the scheduler.

## The minimum control set

If the first version needs to stay small, start with these controls:

1. An immutable Raw landing area.
2. A batch manifest with explicit state.
3. A versioned schema contract.
4. File, schema, type, null, key, and freshness checks.
5. A quarantine path that retains evidence.
6. Idempotent promotion into trusted storage.
7. Alerts that identify the rule and owner.
8. A replay procedure that can be tested.

Add distribution profiling, privacy classification, and advanced anomaly detection when the basic path is reliable. A dashboard full of scores does not replace a clear promotion decision.

## What good looks like

A good health gate makes the next layer boring. Accepted data has a known contract, an identifiable batch, recorded checks, and a safe promotion path. Rejected data is still available, explainable, and replayable.

The orchestrator can change. The storage format can change. The validation rules will evolve. The control boundary should remain: no batch reaches trusted data until the system has recorded why it was allowed in.

## References

- [Apache Parquet](https://parquet.apache.org/docs/)
- [Apache Iceberg](https://iceberg.apache.org/docs/latest/)
- [Great Expectations](https://docs.greatexpectations.io/docs/)
- [Soda data quality](https://docs.soda.io/)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [OpenLineage](https://openlineage.io/docs/)
- [Mage AI](https://mage.ai/)
- [Prefect](https://www.prefect.io/)
`;export{e as default};