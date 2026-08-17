---
title: "Data Engineering in 30 Days, Days 25–26: Governance, Lineage, and Safe Delivery"
date: 2026-08-17
tags: [data-engineering, learning-path, data-governance, ci-cd]
summary: "Make data work dependable by tracing lineage, applying least-privilege access, retaining data deliberately, handling PII safely, and delivering pipeline changes through version control and repeatable checks."
series: data-engineering-in-30-days
---

Governance is often described as a set of restrictions added after the pipeline works. In practice, it is what makes a useful number defensible: can you show where it came from, who may see it, how long it should exist, and what changed when the number changed?

Days 25–26 connect that responsibility to everyday engineering. Lineage answers where a number came from. Access control answers who can see or change it. Retention answers how long it should remain. Version control and continuous integration make changes to all three routine and reversible.

The examples use a fictional regulated trading platform that collects market prices, customer onboarding records, and transaction events. The scenario is deliberately realistic, but retention periods, access rules, and legal obligations must come from the organisation's policy, contracts, and applicable regulation—not copied from a tutorial.

## The outcome for these two days

By the end, you should be able to:

1. Explain lineage as evidence for a value, not a diagram for its own sake.
2. Apply least-privilege access to raw, transformed, and consumer-facing data.
3. Distinguish PII from ordinary operational metadata and treat both deliberately.
4. Define retention and deletion behaviour before data accumulates without an owner.
5. Put models, tests, configuration, and deployment checks into a reviewable delivery path.

## 1. Governance begins with a consumer question

Imagine a compliance analyst sees an alert: a customer appears to have moved funds through several accounts in a way that needs review. The analyst opens a `mart_customer_activity_risk` row with a risk score and transaction total.

Four questions follow immediately:

```text
Where did this score and total come from?
Who is allowed to view the customer's identity and underlying transactions?
How long may the source records and derived result be retained?
Which code and policy version created this number?
```

Those are governance questions, but each has an engineering answer. A dashboard without lineage forces an investigator to reconstruct SQL from memory. A broad warehouse role makes every analyst a potential PII viewer. An undefined retention policy turns a cheap raw-data bucket into an unbounded privacy and security liability. A manual production edit makes the result impossible to reproduce.

The goal is not to make data unusable. It is to give each consumer the smallest safe interface that still lets them do their work.

## 2. Lineage is the evidence behind a number

**Data lineage** describes how data moved and changed from source to consumer. At minimum, it connects a consumer model to its upstream tables, transformations, and runs.

For the fictional risk mart, the path might be:

```text
KYC provider response + transaction event stream
  → raw.kyc_payloads + raw.transaction_events
  → stg_kyc__customers + stg_transactions__events
  → int_customer_activity_window
  → mart_customer_activity_risk
  → compliance dashboard
```

That graph answers a broad “where did it come from?” question. A real investigation needs more precise evidence:

| Evidence | Why it matters |
| --- | --- |
| Source identifier and raw payload location | Shows what the source actually sent. |
| Ingestion run ID and receipt time | Identifies the collection attempt and timing. |
| Transformation model and code revision | Shows the rule that interpreted the source. |
| Model run ID, data interval, and test result | Proves which build created the downstream relation. |
| Input and output row counts | Helps find a dropped or multiplied record set. |
| Consumer model version and refresh time | Explains which published result the user saw. |

For an important metric, record enough metadata to move from a row in the mart back to the raw event without an archaeological expedition through logs. dbt lineage, orchestration metadata, run records, source IDs, and warehouse query history can work together; no single tool automatically captures every link.

### Lineage must include meaning changes

Lineage is more than table names. If a model changes `transaction_amount` from source currency to a USD-normalised amount, that conversion is part of the number's lineage. If a source fixes an old KYC status, the revision policy is part of its lineage.

Document the grain and business meaning at each published layer:

```text
stg_transactions__events:
  One row per received source transaction event.

int_customer_activity_window:
  One row per customer and trailing 30-day evaluation window.

mart_customer_activity_risk:
  One row per customer evaluation, including the policy version used.
```

This makes it possible to answer why a number changed without pretending the old and new models were identical.

## 3. Access control should match the data layer and the job

**Least privilege** means giving a person, service, or agent only the permissions required for its task, for the shortest practical scope. It is safer than a broad “analyst” role that can read every raw table because someone might need it someday.

For the example platform:

| Role | Can read | Can write | Should not access |
| --- | --- | --- | --- |
| Ingestion service | Its source credentials and landing target. | Raw landing tables and run records. | Consumer marts, unrelated sources, broad warehouse administration. |
| Transformation service | Required raw/staging inputs. | Its designated staging and mart schemas. | Source API secrets and identity documents. |
| Data engineer | Metadata, non-production samples, and scoped production investigation paths. | Version-controlled project changes through deployment roles. | Broad mutable production access by default. |
| Analyst | Curated marts and approved dimensions. | Usually none. | Raw payloads and direct identity fields. |
| Compliance investigator | Approved identity and transaction views for an assigned case. | Case annotations, if required. | Unrelated customers and infrastructure credentials. |
| AI agent | Read-only, schema-documented aggregate marts or bounded tools. | Usually none. | Raw PII, secrets, and unrestricted production tables. |

These are examples, not a universal permission matrix. The pattern is stable: separate human roles from service identities, make writes narrower than reads, and expose curated views rather than forcing every consumer to understand raw schemas.

### Row, column, and environment boundaries

Access control can be applied at several levels:

| Boundary | Example |
| --- | --- |
| Environment | Development credentials cannot write to production. |
| Schema or dataset | Analysts can read `analytics_marts` but not `raw`. |
| Table or view | Compliance can access a case view, not the full customer table. |
| Column | `email` and government ID are masked or omitted for most roles. |
| Row | A regional team can see customers in its assigned jurisdiction. |
| Operation | A service can `INSERT` into raw landing but cannot `DELETE` history. |

Permissions alone do not remove sensitive values from query results copied into a notebook, export, or chat prompt. Pair access rules with audit logs, approved export paths, secrets management, and a clear incident process.

## 4. PII needs a data design, not a warning label

**Personally identifiable information (PII)** is information that can identify a person directly or in combination with other data. Examples include name, email, phone number, address, government ID, account identifiers, and sometimes combinations of location, device, and transaction data.

The exact classification depends on context and policy. Treat uncertain fields as sensitive until the data owner or privacy function classifies them.

For the KYC source, separate what a risk model needs from what identifies a person:

```text
raw.kyc_payloads
  contains name, email, document image reference, address, and source response.

analytics.dim_customer_risk_features
  contains opaque customer_id, account_age_days, country_risk_band,
  verification_status, and no direct identity fields.
```

Pseudonymising an identifier reduces casual exposure, but it is not the same as making data anonymous. If a privileged system can map `customer_id` back to a person, access and retention controls still matter.

Practical design choices include:

- Keep direct identifiers in a restricted identity domain.
- Use stable opaque IDs in analytical facts and marts.
- Mask or tokenise values where full text is unnecessary.
- Avoid copying raw PII into logs, test fixtures, screenshots, and error messages.
- Use synthetic or approved de-identified data in local development.
- Give an AI workflow a narrow aggregate view or tool response, not a raw KYC table.

Do not use production PII as convenient test data. A small fixture with a real person's document number is still production-sensitive data, even when the database is running on a laptop.

## 5. Retention is a lifecycle decision

**Retention** defines how long data is kept, where it is kept, and what happens when its retention period ends. A useful policy distinguishes layers because the same business record can have different needs in raw, transformed, and aggregated forms.

| Data class | Example purpose | Possible lifecycle decision |
| --- | --- | --- |
| Raw source payload | Reproduce source interpretation and investigate incidents. | Retain for a documented evidence window, then delete or archive under policy. |
| Direct identity data | Complete a verification or support process. | Restrict strongly; retain only for the approved business and legal purpose. |
| Transaction event | Support customer, financial, and audit workflows. | Retain according to the applicable recordkeeping policy. |
| Aggregated mart | Trend analysis without direct identifiers. | Retain longer when justified, with reduced sensitivity. |
| Run logs and metadata | Prove pipeline operation and investigate failures. | Retain long enough for operational and audit needs; avoid embedding raw PII. |

The words “possible” and “documented” matter. Retention periods are driven by legal requirements, contracts, risk, and business purpose. Data engineers should implement an approved policy with the privacy, legal, security, and data-owning teams; they should not invent a compliance schedule from a blog post.

### Deletion is more than deleting one table

When a retention period expires or a valid deletion request must be handled, trace all copies:

```text
raw payload → staging table → identity dimension → mart → exports → backups → search indexes
```

Not every copy can or should be deleted identically. Backups may have a separate expiry process. An aggregate may be safe to retain if it no longer identifies a person. A legal hold may suspend an ordinary deletion schedule. The engineering responsibility is to know where copies exist, make the policy executable, and record what action was taken.

Use deletion jobs that are scoped, logged, and idempotent. A broad `DELETE` without a verified target is not a retention policy.

## 6. Version control turns a data change into a reviewable change

Pipeline code, SQL models, tests, configuration templates, infrastructure definitions, and documentation belong in version control. Git gives a team a visible history of what changed, who reviewed it, and how to return to a known code revision.

Keep these artefacts together where practical:

```text
ingestion/          Python loaders and parser tests
models/             dbt SQL models and YAML tests
orchestration/      DAGs, flows, or workflow definitions
config/             non-secret environment templates and selectors
docs/               model grain, runbooks, ownership, retention notes
migrations/         controlled schema changes
```

Do not commit secrets, access tokens, raw PII fixtures, production exports, or generated files that contain sensitive data. Use a secrets manager or the deployment platform's protected configuration mechanism. Commit the variable name and expected shape, not its value.

### Treat a pull request as a data-change proposal

A useful data pull request answers more than “does the SQL run?”

```text
What model, source, or contract changes?
Does the grain change?
Which downstream consumers or agents are affected?
Is a backfill or full refresh required?
What tests prove correctness, integrity, and completeness?
Does the access classification or retention policy change?
How can the deployment be rolled back or the data repaired?
```

This is especially important for a transformation that changes a published metric. Reverting the code after a bad deploy stops future changes; it does not automatically restore a table that was rebuilt with the wrong logic. The delivery plan must include the data repair or backfill path.

## 7. Continuous integration is the first delivery gate

Continuous integration, or **CI**, runs automated checks whenever a change is proposed. The smallest useful pipeline is better than no pipeline. Start with checks that fail quickly and catch the most common mistakes.

| Check | What it catches |
| --- | --- |
| Format, lint, and type checks | Broken Python style, imports, and obvious static mistakes. |
| Unit tests | Parser, cursor, and transformation behaviour on controlled fixtures. |
| Config and workflow parse | Invalid DAG, flow, deployment, or environment configuration. |
| `dbt parse` and `dbt compile` | Broken refs, YAML, Jinja, and warehouse SQL rendering. |
| Targeted `dbt build` | Model and data-test failures in an isolated database or staging schema. |
| Migration check | Schema changes that cannot apply or roll forward safely. |
| Policy check | Missing owner, description, classification, or prohibited broad permission. |

CI should not use production credentials or full production data. Run fast checks locally and in CI, then promote an approved artefact to staging for an integration run against bounded representative data. Production deployment follows only after staging proves the real interfaces, permissions, schedules, and quality gates work together.

```text
Local:       unit tests + parse/compile + fixture data
CI:          repeatable checks on a clean environment
Staging:     bounded real integration + integrity/completeness proof
Production:  monitored release + consumer-facing freshness and quality checks
```

That path makes a change routine. It is still possible to fail, but failure happens earlier, with a known code revision, a small data interval, and a clear way forward.

## 8. Concrete delivery example: add a risk-country field safely

The compliance team asks to add `country_risk_band` to the customer risk mart. The source KYC provider already sends country, but the current mart has no country-derived field.

An unsafe implementation is to add the raw country column to the mart and let every dashboard decide how to classify it. That exposes more data than needed and allows each consumer to create a different risk rule.

A governed delivery path is smaller and safer:

1. **Classify:** confirm that country is permitted for the intended risk purpose and define who may use the result.
2. **Model:** add a version-controlled mapping from approved country codes to a small set of risk bands; retain the mapping's version.
3. **Limit exposure:** publish `country_risk_band`, not the raw address or unnecessary identity fields, to the broad analyst mart.
4. **Test:** check valid codes, accepted bands, relationship coverage, and the absence of null bands for active customers.
5. **Review lineage:** document source field, mapping model, mart grain, and affected dashboards or agents.
6. **Stage:** run the changed path for a bounded data interval with de-identified or approved staging data; verify counts and access roles.
7. **Deploy and monitor:** promote the same revision, observe freshness and quality checks, and keep a backfill plan if historical classifications need recomputation.

The outcome is a useful risk feature whose source, policy version, access boundary, and repair path are visible. Governance did not slow down the feature; it prevented a broad, irreversible copy of customer data from becoming the default interface.

## A small exercise for day 26

Choose one existing mart and write a one-page governance and delivery contract:

```text
Consumer and permitted purpose:
Grain and business definition:
Upstream lineage and raw evidence location:
Data classification, including PII or sensitive fields:
Read and write roles:
Retention and deletion owner:
Code repository and deployment artefacts:
Local, CI, staging, and production checks:
Rollback and data-repair procedure:
Runbook link and incident owner:
```

Then propose one change to that mart. State whether it changes grain, access, retention, lineage, or historical results. If you cannot say how to reverse or repair it, the change is not ready for production.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Data lineage | Evidence of a dataset's sources, transformations, and delivery path. | `Draw lineage for a customer risk score from a KYC response and transaction events to a compliance dashboard. Include raw IDs, runs, dbt models, and policy versions.` |
| Provenance | The detailed origin and history of a particular value or record. | `Explain lineage versus provenance using one suspicious transaction total. What metadata lets an investigator reproduce it?` |
| Least privilege | Granting only the permissions necessary for a specific job. | `Design least-privilege roles for an ingestion service, dbt service, analyst, compliance investigator, and AI agent in a KYC analytics platform.` |
| PII | Information that identifies a person directly or in combination with other data. | `Classify likely PII in a KYC and transaction dataset. Explain direct identifiers, quasi-identifiers, pseudonymisation, and safe test data.` |
| Data masking | Hiding or replacing sensitive values for a consumer or environment. | `Compare masking, tokenisation, hashing, and encryption for customer email and government ID fields. What problems does each solve or not solve?` |
| Retention policy | An approved rule for how long data is kept and what happens next. | `Design a retention-policy template for raw KYC payloads, transaction events, aggregate marts, and pipeline logs. Include owners and deletion evidence.` |
| Legal hold | A requirement to preserve relevant records despite ordinary deletion. | `Explain how a legal hold changes an automated retention job. What metadata and safeguards should a data engineer implement?` |
| Version control | A history of reviewed changes to code and configuration. | `Show how to structure a repository for Python ingestion, dbt models, orchestration, migrations, tests, and non-secret config.` |
| Continuous integration | Automated checks run for every proposed change. | `Design a minimal CI pipeline for a Python ingestion plus dbt project. Separate local fixture checks, staging integration checks, and production monitoring.` |
| Rollback | Returning code or configuration to a known revision. | `Explain why rolling back dbt code does not automatically repair a table rebuilt with incorrect logic. Design a data repair and backfill plan.` |
| Data contract | A documented and testable agreement between a producer and consumer. | `Write a data contract for a customer risk mart with grain, freshness, access class, retention owner, and quality checks.` |

When asking an LLM for governance help, describe the data classes, consumer purpose, jurisdiction or policy constraints, existing roles, and deletion requirements. It can help design a control, but it cannot decide an organisation's legal obligations or approve a sensitive-data use.

## What comes next

Day 27 introduces streaming and event thinking: topics, consumers, offsets, event time, processing time, late events, and why “real time” has the same correctness problems as batch—only faster.

## References

- [dbt documentation: model documentation](https://docs.getdbt.com/docs/collaborate/documentation)
- [OpenLineage documentation](https://openlineage.io/docs/)
- [Open Policy Agent documentation](https://www.openpolicyagent.org/docs/latest/)
- [Git documentation](https://git-scm.com/doc)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
