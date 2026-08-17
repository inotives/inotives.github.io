var e=`---
title: "Data Engineering in 30 Days, Days 23–24: Data Observability, Quality, and Schema Drift"
date: 2026-08-17
tags: [data-engineering, learning-path, data-observability, data-quality]
summary: "Learn to observe data as a product: freshness, completeness, validity, plausibility, schema drift, and source disagreement—using a concrete market-data incident from raw payload to policy decision."
series: data-engineering-in-30-days
---

Software observability asks whether a service is up. Data observability asks whether the data is fresh, complete, valid, and plausible enough to use.

Both matter. An ingestion service can have 100% successful requests while a provider quietly returns an empty page. A dbt job can be green while every price has become \`NULL\` after a field rename. A dashboard can render in milliseconds while it reports a 100× price because a source changed a numeric convention.

Days 23–24 turn these risks into observable signals and response policies. The goal is not to alert on every strange value. It is to define what trustworthy data means for each important model, notice when the promise is broken, and retain enough evidence to investigate without guessing.

## The outcome for these two days

By the end, you should be able to:

1. Separate software health from data health.
2. Track freshness, volume, completeness, validity, and plausibility for a dataset.
3. Detect schema drift and decide whether to accept, quarantine, or block changed records.
4. Preserve and expose conflicting source values rather than silently selecting one.
5. Design an investigation path from an alert to a policy decision and a repair.

## 1. A green service can produce red data

The same system needs two distinct observation layers:

| Question | Software observability | Data observability |
| --- | --- | --- |
| Is work running? | Process health, CPU, memory, task state, HTTP errors. | Did the expected records arrive and become usable? |
| Is it on time? | Scheduler started the job. | The latest record covers the expected source interval. |
| Is output valid? | The job did not throw an exception. | Keys, types, relationships, and business rules hold. |
| Is output believable? | Not usually visible. | Values and distributions remain within an expected range. |
| Can we explain an issue? | Logs and traces show a failed request. | Raw payloads, run records, lineage, and quality results show what data changed. |

An effective incident response needs both. A 429 rate-limit error is a software signal that might cause a future freshness failure. A sudden 90% drop in row count is a data signal that may occur even when every request returned 200.

Do not use one vague “pipeline healthy” badge for all of this. Publish the specific promise that matters to a consumer.

## 2. The five signals to track first

Start with a small set of measurements that map to real failure modes.

| Signal | Question | Market-data example |
| --- | --- | --- |
| Freshness | How old is the newest usable record? | Has each active provider supplied an observation in the last 10 minutes? |
| Volume | How many records arrived compared with expectation? | Did a provider send roughly its usual number of market observations? |
| Completeness | Is the required coverage present? | Did every expected page and active market appear for the run interval? |
| Validity | Do values satisfy structural and business rules? | Are \`symbol\`, \`observed_at\`, and positive \`price\` present and valid? |
| Plausibility | Does the distribution look materially different from history? | Did median price, null rate, or distinct symbols shift sharply? |

These signals complement dbt tests. A \`not_null\` test checks validity. It does not say whether 30 expected markets disappeared. A source freshness check says the latest record is recent. It does not say whether that one record is enough coverage for the entire market universe.

### Freshness is about the dataset's promise

Freshness needs an agreed clock and threshold. For an intraday price mart, a useful query could be:

\`\`\`sql
SELECT
  provider,
  max(received_at) AS latest_received_at,
  now() - max(received_at) AS lag
FROM analytics.fct_price_observation
GROUP BY provider;
\`\`\`

The alert threshold should follow the business use. Five-minute lag may be unacceptable for execution monitoring and perfectly acceptable for a daily research report. State the service-level expectation in words: “The research mart is complete by 09:30 UTC for the prior UTC day.”

Do not call an arriving raw payload “fresh” if its transformed mart is still stale. Measure freshness at the layer the consumer actually uses.

### Volume and completeness catch different failures

Volume compares a count with a baseline. A sharp fall often indicates a broken filter, missing page, source outage, or schema change:

\`\`\`sql
SELECT
  provider,
  count(*) AS observations_last_hour
FROM analytics.fct_price_observation
WHERE received_at >= now() - interval '1 hour'
GROUP BY provider;
\`\`\`

Completeness compares the received set with the expected set. If the system knows the active provider-market pairs, it can find missing coverage directly:

\`\`\`sql
SELECT
  m.provider_id,
  m.market_id
FROM analytics.dim_market AS m
LEFT JOIN analytics.fct_price_observation AS f
  ON f.market_id = m.market_id
 AND f.received_at >= now() - interval '10 minutes'
WHERE m.is_active
GROUP BY m.provider_id, m.market_id
HAVING count(f.market_id) = 0;
\`\`\`

The count can be normal while one high-value market is missing. The expected set can be complete while every record has a wrong price. Use both checks.

### Plausibility needs context, not a universal threshold

A price of 150,000 may be absurd for one asset and normal for another. A 30% daily move may be a data error, a market event, or a currency redenomination. Plausibility checks should compare a value with the right peer group and history:

\`\`\`sql
WITH latest AS (
  SELECT market_id, observed_at, price,
         lag(price) OVER (
           PARTITION BY market_id
           ORDER BY observed_at
         ) AS previous_price
  FROM analytics.fct_price_observation
)
SELECT market_id, observed_at, price, previous_price
FROM latest
WHERE previous_price IS NOT NULL
  AND abs(price / previous_price - 1) > 0.30;
\`\`\`

This query returns candidates for investigation. It should not automatically delete records or overwrite them with yesterday's value. A valid market shock and a bad decimal conversion can look similar until source evidence is checked.

## 3. Schema drift is a normal production event

**Schema drift** is a change in the fields, types, or meaning a source sends. It is not necessarily a provider bug. APIs evolve, vendors improve naming, optional fields become required, and a source may add richer values over time.

The common forms are:

| Drift type | Example | Safe default response |
| --- | --- | --- |
| Added field | \`markPrice\` appears beside \`lastPrice\`. | Retain it in raw data; decide later whether a model needs it. |
| Removed or renamed field | \`lastPrice\` becomes \`price\`. | Quarantine or fail the affected transform until the contract is updated. |
| Type change | \`price\` changes from numeric string to nested object. | Block unsafe parsing; retain the raw payload and alert. |
| Unit or semantic change | \`volume\` changes from base units to quote currency. | Treat as a contract change, rebuild affected history if needed. |
| Nullability change | A formerly required market ID becomes absent. | Reject or quarantine affected records; measure the new null rate. |
| Cardinality change | A source suddenly returns many new symbols. | Investigate listing change, duplicate expansion, or a parsing defect. |

The dangerous response is to coalesce every possible field into one convenient column and claim nothing changed. A parser such as \`coalesce(last_price, price)\` can be acceptable only after a documented compatibility decision confirms the two fields have identical semantics for the intended period. Otherwise it hides evidence that consumers need to understand.

## 4. Concrete incident: the provider returns conflicting prices

Suppose a market-data provider sends this familiar-looking payload after an API upgrade:

\`\`\`json
{
  "symbol": "BTCUSDT",
  "eventTime": "2026-08-17T10:00:00Z",
  "lastPrice": "118450.25",
  "price": "11845.025",
  "priceScale": 2
}
\`\`\`

The ingestion service returns 200. JSON parsing succeeds. A simplistic loader sees two candidate fields and chooses the new \`price\` field because it sounds canonical. The dashboard immediately shows BTC down by 90%.

This is not a hypothetical class of failure. Financial and operational APIs routinely carry similarly named fields with different meanings, scales, or migration states. The example does **not** assume which field is correct. It shows why a pipeline needs a policy before it makes that choice.

### Step 1: retain the source evidence

The raw record should capture the complete payload and context:

\`\`\`text
raw_provider_payload
├── provider: example_provider
├── received_at: 2026-08-17T10:00:02Z
├── endpoint_version: v2
├── request_id: 7b4d...
└── payload: original JSON bytes
\`\`\`

Without this, the team cannot later distinguish a provider response from a transformation error.

### Step 2: extract without erasing the disagreement

The staging model should preserve both values and add explicit quality metadata:

\`\`\`text
stg_provider__price_observation
┌──────────┬──────────┬──────────────┬────────────┬────────────┬─────────────────────┐
│ symbol   │ event_at │ last_price   │ price      │ price_scale│ quality_status      │
├──────────┼──────────┼──────────────┼────────────┼────────────┼─────────────────────┤
│ BTC/USDT │ 10:00:00│ 118450.25    │ 11845.025  │ 2          │ conflicting_values  │
└──────────┴──────────┴──────────────┴────────────┴────────────┴─────────────────────┘
\`\`\`

One SQL expression can make the discrepancy visible:

\`\`\`sql
CASE
  WHEN last_price IS NOT NULL
   AND price IS NOT NULL
   AND last_price <> price
  THEN 'conflicting_values'
  WHEN last_price IS NULL AND price IS NULL
  THEN 'missing_price'
  ELSE 'accepted'
END AS quality_status
\`\`\`

This does not prove the comparison is semantically valid. It creates a reviewable signal instead of a silent data loss.

### Step 3: choose a policy, then encode it

The response depends on the consumer and evidence:

| Policy | When it fits | What the pipeline does |
| --- | --- | --- |
| Quarantine and block publication | Price drives a risk-sensitive dashboard or trading decision. | Preserve raw/staging rows, fail the quality gate, and keep the prior certified mart visible. |
| Use documented legacy field temporarily | The provider confirms \`lastPrice\` remains the unchanged contract during a migration. | Map \`lastPrice\` to the canonical field, record the compatibility version and alert on disagreement. |
| Use new field after verified conversion | Documentation and provider confirmation define scale and semantics. | Apply the conversion in a versioned staging model and backfill or label affected history. |
| Publish both measures | They represent different useful concepts, such as last trade and mark price. | Create two named canonical measures; do not force them into one \`price\` column. |

For this incident, a sensible default is to quarantine the conflicting records and prevent the affected daily mart from advancing until the provider contract is confirmed. The team may choose to keep serving the prior complete daily mart with a freshness warning rather than publish a fast, wrong value.

### Step 4: repair and prevent recurrence

After confirming the provider changed \`price\` to a scaled integer-like representation, the team could add a versioned conversion:

\`\`\`sql
CASE
  WHEN endpoint_version = 'v2'
  THEN price / power(10, price_scale)
  ELSE last_price
END AS canonical_last_price
\`\`\`

The exact SQL is less important than the process:

1. Document the field meaning and conversion source.
2. Test known raw payloads from before and after the change.
3. Backfill only the affected interval with an explicit run record.
4. Compare revised values with the retained source evidence and any independent provider.
5. Keep a drift monitor so the next unexpected field or scale change is visible.

The production pipeline does not need to guess correctly on every new response. It needs to fail in a way that preserves evidence and gives a human or policy engine a safe decision point.

## 5. Quality checks belong at several layers

No single test catches every defect. Place checks where the relevant information still exists.

| Layer | What it knows | Useful checks |
| --- | --- | --- |
| Source request | HTTP status, page token, headers, latency. | Request failures, pagination completion, rate-limit events. |
| Raw landing | Original fields and payload shape. | Schema fingerprint, new/missing fields, payload count, parseability. |
| Staging | Source-specific types and fields. | Required fields, type conversion, conflicting values, source-specific ranges. |
| Core fact | Canonical keys and shared semantics. | Uniqueness, relationships, accepted values, duplicate coverage. |
| Mart | Consumer-facing business meaning. | Freshness, completeness, aggregate reconciliation, plausibility. |

Tools such as dbt tests, warehouse SQL checks, Great Expectations, Soda, and commercial observability platforms can run or display these checks. The tool choice is secondary. Every check still needs an owner, threshold, severity, response policy, and a clear statement of the model it protects.

## 6. Alert for action, not for every anomaly

An alert should tell someone what decision they need to make. Start with a small severity model:

| Severity | Example | Response |
| --- | --- | --- |
| Informational | A new optional raw field appeared. | Record it; review during normal source-contract maintenance. |
| Warning | Null rate rose from 0% to 2%; daily mart is still complete. | Investigate in a defined window and monitor trend. |
| Critical | Expected provider coverage is missing or canonical prices conflict. | Block affected publication or label it stale; page the owner. |

Attach context to the alert: model, data interval, source, observed metric, expected baseline, run ID, raw payload location, and an investigation link. “Data quality failed” is not actionable. “Provider X returned 0 of 312 expected active markets for 10:00–10:10 UTC; raw run 1234 completed with two pages” is.

## A small exercise for day 24

Pick one model from your project and write a data-health contract:

\`\`\`text
Consumer and decision supported:
Model grain:
Freshness expectation:
Expected coverage or source count:
Required keys and validity rules:
Plausibility baseline:
Schema-change policy:
Conflict policy:
Alert severity and owner:
Raw evidence and run record location:
Backfill or repair procedure:
\`\`\`

Then simulate the incident above. Add a second price field with a conflicting value to a fixture. Confirm that your staging logic marks it, your mart does not silently publish it, and the run record tells an operator where to find the raw payload.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Data observability | Measuring whether data is usable, not merely whether code ran. | \`Compare software observability and data observability for a market-price pipeline. Give metrics for freshness, volume, completeness, validity, and plausibility.\` |
| Freshness | How recently a consumer-facing model received usable data. | \`Design a freshness check for a five-minute price mart. Explain event time, receipt time, transformation lag, and an alert threshold.\` |
| Completeness | Whether the expected records or coverage arrived. | \`Show how to test completeness for a paginated provider API with an expected active-market list. Why is row count alone insufficient?\` |
| Validity | Whether fields satisfy defined structural and business rules. | \`Give validity tests for provider, market, price, observed_at, and received_at in a price observation model.\` |
| Plausibility | Whether values remain credible compared with relevant context or history. | \`Design a plausibility check for sudden price changes. Explain why an anomaly should trigger investigation rather than automatic deletion.\` |
| Schema drift | A change in source fields, types, units, or meaning. | \`Teach schema drift using a provider that renames lastPrice to price and later changes price scale. Give safe responses for each change.\` |
| Schema fingerprint | A stored representation of expected field names and types. | \`Explain how a schema fingerprint can detect added, removed, and type-changed JSON fields without blocking harmless optional additions.\` |
| Quarantine | Retaining suspicious data outside a trusted consumer path. | \`Design a quarantine table for conflicting price records. Include raw payload location, reason, run ID, and release policy.\` |
| Reconciliation | Comparing systems or layers to find divergence. | \`Show daily reconciliation between source page counts, raw rows, fact rows, and a consumer mart. Which mismatches are expected?\` |
| Distribution shift | A material change in data statistics such as null rate, count, or value range. | \`Explain distribution-shift monitoring for provider price observations. How can it catch a unit change that passes type checks?\` |
| Data incident | A managed response to a breach of a data contract. | \`Write a runbook for a data incident where two provider price fields conflict. Include containment, evidence, decision, repair, and post-incident prevention.\` |

When asking an LLM to design a quality check, provide the model grain, intended consumer, source contract, historical baseline, and what action the check should trigger. A generic threshold is rarely safe; a quality check is useful when it leads to a clear decision.

## What comes next

Days 25–26 move to governance and delivery: lineage, access control, retention, personally identifiable information, version control, continuous integration, and how to change a pipeline without making its history untrustworthy.

## References

- [dbt documentation: data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt documentation: source freshness](https://docs.getdbt.com/docs/build/sources#source-freshness)
- [Great Expectations documentation](https://docs.greatexpectations.io/)
- [Soda documentation](https://docs.soda.io/)
- [OpenLineage documentation](https://openlineage.io/docs/)
`;export{e as default};