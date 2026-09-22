var e=`---
title: "Slowly changing dimensions: SCD types, Bronze-to-Gold placement, and production rules"
date: 2026-09-22
tags: [data-engineering, data-modeling, slowly-changing-dimensions, dimensional-modeling, cdc]
series: data-engineering
summary: "A practical guide to slowly changing dimensions: Types 0 through 7, why Type 1 and Type 2 dominate real warehouses, where SCD belongs in Bronze, Silver, and Gold, and the rules that keep historical reporting correct."
---

Customer address, product category, employee manager, sales territory, credit band: these attributes change. The fact rows that refer to them usually do not.

That creates a deceptively important question. When a customer moves from Singapore to Tokyo, should a revenue report for last year show Singapore because that was true at the time? Or Tokyo because that is the customer’s current location? Neither answer is automatically correct. It is a business rule, and the dimensional model needs to preserve it.

Slowly changing dimensions (SCDs) are the set of patterns used to make that rule explicit. They are not just a historical data technique. They determine how facts join to dimensions, what a dashboard means, how corrections are handled, and whether an auditor can reconstruct a prior report.

## SCD is a modeling choice, not a CDC feature

Change data capture (CDC) tells the warehouse that something changed: an insert, update, delete, or a newer source version. An SCD policy decides what the analytical table should do with that signal.

The same change feed can drive either of these outcomes:

- Type 1: overwrite the customer row so every report uses the latest segment.
- Type 2: close the old customer version and create a new version so reports can use the segment that was valid at the time.

Databricks AUTO CDC, dbt snapshots, and low-code warehouse tools can automate pieces of the work. They cannot decide whether the business wants current-state or historical reporting. That decision belongs in the data contract.

## The core types: 0, 1, 2, and 3

![SCD Types 0 to 3 illustrated with a customer moving from Standard to Premium](/assets/images/scd-types-0-to-3.png)

### Type 0: retain the original value

Type 0 never changes an attribute after the first load. It is useful for genuinely original or durable facts: original acquisition channel, date of birth, first credit score, or most attributes of a date dimension.

Do not use Type 0 merely because an update is awkward. Use it only when “original” is the intended business meaning.

### Type 1: overwrite the old value

Type 1 updates the existing dimension row. It holds only the current state. A corrected customer email, a phone number, or a spelling error usually belongs here. The business wants the latest value and does not need to reproduce its prior state.

\`\`\`sql
MERGE INTO silver.dim_customer AS target
USING staged_customer_changes AS source
ON target.customer_id = source.customer_id
WHEN MATCHED AND target.attribute_hash <> source.attribute_hash THEN
  UPDATE SET
    customer_name = source.customer_name,
    email = source.email,
    segment = source.segment,
    attribute_hash = source.attribute_hash,
    updated_at = source.updated_at
WHEN NOT MATCHED THEN
  INSERT (customer_id, customer_name, email, segment, attribute_hash, updated_at)
  VALUES (source.customer_id, source.customer_name, source.email,
          source.segment, source.attribute_hash, source.updated_at);
\`\`\`

Type 1 is simple and cheap, but it rewrites history from the dimension’s perspective. If facts from 2024 join to the current customer row, an old transaction can be grouped by the customer’s 2026 territory. That may be exactly what a customer-success dashboard wants. It is rarely what a historical sales-territory report wants.

### Type 2: add a new row for every tracked change

Type 2 preserves complete history for selected attributes. When a tracked attribute changes, the old row is expired and a new row is inserted. Each version receives a surrogate key. Facts use that surrogate key, or resolve it from the business key and the fact timestamp during loading.

The usual columns are:

| Column | Purpose |
| --- | --- |
| \`customer_key\` | Surrogate key for one version of a customer |
| \`customer_id\` | Durable business key from the source system |
| \`valid_from\`, \`valid_to\` | Effective-time range for the version |
| \`is_current\` | Fast filter for the latest version |
| \`attribute_hash\` | Change-detection value for tracked attributes |
| \`recorded_at\` | When the warehouse learned of the change |

\`\`\`sql
-- Close the current version at the business-effective timestamp.
UPDATE silver.dim_customer
SET valid_to = :changed_at,
    is_current = false
WHERE customer_id = :customer_id
  AND is_current = true;

-- Insert the new version with a new surrogate key.
INSERT INTO silver.dim_customer (
  customer_key, customer_id, segment, valid_from, valid_to, is_current
)
VALUES (
  :new_customer_key, :customer_id, :new_segment,
  :changed_at, timestamp '9999-12-31 00:00:00', true
);
\`\`\`

The fact load must then apply the point-in-time join:

\`\`\`sql
SELECT f.*, d.customer_key
FROM silver.orders AS f
JOIN silver.dim_customer AS d
  ON f.customer_id = d.customer_id
 AND f.order_timestamp >= d.valid_from
 AND f.order_timestamp < d.valid_to;
\`\`\`

Type 2 is the default when historical classification matters: product ownership at the time of sale, employee manager at the time of approval, customer regulatory risk at the time of an action, or sales territory when revenue was booked.

It costs more storage and more care. A Type 2 dimension with overlapping validity windows or an incorrect change order is worse than a clear Type 1 table because it looks historically authoritative while returning the wrong row.

### Type 3: add a previous-value column

Type 3 stores a limited alternate view in the same row, such as \`current_segment\` and \`previous_segment\`. It is useful when a report needs exactly one prior state, for example comparing the current product category with the category before a planned reorganisation.

It does not scale to an unbounded history. Type 3 is uncommon now because a Type 2 history table plus a view is often easier to extend, but it remains useful for a tightly bounded reporting requirement.

## Advanced types: 4 through 7

![Advanced SCD types 4 to 7 illustrated as specialised modelling patterns](/assets/images/scd-types-4-to-7.png)

The advanced types are valid Kimball patterns. They are also easy to overbuild. Types 1 and 2, sometimes mixed by attribute, solve most current warehouse problems.

| Type | Pattern | When it earns its complexity |
| --- | --- | --- |
| 4 | Mini-dimension | A group of attributes changes rapidly or is heavily used, so it is split from a very large base dimension. A profile band or behavioural segment is a common example. |
| 5 | Mini-dimension plus Type 1 outrigger | Facts retain the historical mini-dimension while the base dimension exposes a current profile reference for current-state reporting. |
| 6 | Hybrid Type 1 + 2 + 3 | Type 2 rows preserve history while a current attribute is overwritten onto all versions, allowing both historic and current views in one dimension. |
| 7 | Dual Type 1 and Type 2 dimensions | Facts can access a current dimension and a historical Type 2 dimension, normally through separate key paths. |

Type 4 is the pattern worth knowing for “rapidly changing monster dimensions.” If a customer’s behavioural attributes change frequently, putting every change in a wide Type 2 customer dimension can explode row counts and make joins expensive. A smaller profile mini-dimension gives facts a compact way to record the segment without versioning every stable customer attribute.

Types 5, 6, and 7 help when the same fact needs both “what was true then?” and “what is true now?” reporting. Do not add them as a default. Start with a Type 2 historical dimension and a separate current-state view; introduce a hybrid only when users repeatedly need both perspectives in the same semantic model.

## Where SCD belongs: Bronze, Silver, and Gold

![Where SCD work normally belongs in Bronze, Silver, and Gold layers](/assets/images/scd-medallion-layer-placement.png)

### Bronze: retain evidence, not the final interpretation

Bronze should preserve raw CDC events or source snapshots, including source operation, ordering or sequence field, business-effective timestamp if available, and ingestion metadata. If the source sends an update twice or out of order, Bronze needs enough evidence to diagnose it.

Do not make the final SCD choice here. A raw database \`UPDATE\` is not automatically a Type 2 event. It may be a correction that should overwrite history, a late-arriving change, or an update to an attribute the business does not track historically.

### Silver: canonical dimensions and change policy

Silver is the usual home for SCD logic. It contains conformed dimensions shared by several downstream facts and marts. This is where the team chooses tracked attributes, calculates change hashes, applies Type 1 merges or Type 2 versioning, and ensures validity windows do not overlap.

It is normal for one dimension to mix policies by attribute. For example:

- Customer legal name and postal address: Type 2 when historic contracts or tax reporting require it.
- Customer email and support phone: Type 1, because users generally want the reachable current value.
- Original acquisition channel: Type 0.

Document the policy at attribute level. “\`dim_customer\` is Type 2” is not enough.

### Gold: choose the reporting perspective

Gold marts should make the chosen perspective easy for business users. A sales fact can retain the historical \`customer_key\` from a Type 2 join, while a customer-health mart exposes a current customer view. Both can be correct; they answer different questions.

Some teams place dimensional stars physically in Gold rather than Silver. That is fine. The important boundary is logical: raw input in Bronze, canonical SCD policy before repeated consumption, and explicit reporting semantics in Gold.

## Production rules for Type 2

### Track business time and warehouse time separately

\`valid_from\` should normally reflect when the change was effective in the business, not merely when the warehouse received it. Keep a separate \`recorded_at\` or \`ingested_at\` when auditability matters.

If an HR system reports today that a manager change was effective last month, a simple close-and-insert at today’s timestamp will corrupt point-in-time reports. This is a late-arriving dimension change. It may require splitting an old validity interval and repairing affected fact foreign keys.

### Define the ordering column before ingesting CDC

CDC updates need a stable ordering sequence: database log sequence number, source commit timestamp plus tie-breaker, or a version number. Do not use warehouse ingestion time as the only ordering rule when events can arrive late or be replayed.

### Compare only tracked attributes

An attribute hash helps detect change, but it should include only attributes with the same SCD policy. If a Type 1 email address is included in a Type 2 hash, a simple contact update will create unnecessary historical versions.

### Test temporal invariants

For every business key, test that:

- there is at most one \`is_current = true\` row;
- validity windows do not overlap;
- every Type 2 change creates exactly one new version;
- each fact resolves to one dimension version for its event time;
- reprocessing the same source batch does not create duplicate versions.

These tests matter more than the particular SCD framework. They are the difference between a history table and a trustworthy temporal model.

## Choosing the type

| Business question | Usually choose | Example |
| --- | --- | --- |
| What is the customer’s contact detail now? | Type 1 | Send a renewal email to the latest address. |
| What sales territory owned this order when it was booked? | Type 2 | Historical commission and territory reporting. |
| What was the customer’s immediately prior loyalty tier? | Type 3 | A narrowly scoped before-and-after campaign analysis. |
| Which behavioural band applied when this event occurred? | Type 4 | A high-cardinality customer profile or risk band. |
| Do users need both today’s classification and the historical classification? | Type 2 plus a current view first; consider Types 5–7 only if needed | Customer portfolio reporting with current and as-was views. |

The safest default is straightforward: use Type 1 for corrections and current-only attributes, Type 2 for explicitly historical attributes, and keep the raw source changes long enough to repair mistakes. Build the advanced types only after a real reporting question proves that the extra keys and joins are worth carrying.

## References

- [Kimball Group: Slowly Changing Dimension Techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [Kimball Group: Slowly Changing Dimensions](https://www.kimballgroup.com/2008/08/slowly-changing-dimensions/)
- [Microsoft Fabric: Slowly changing dimensions](https://learn.microsoft.com/en-us/fabric/iq/plan/powertable-concept-slowly-changing-dimensions)
- [Microsoft Fabric: load tables in a dimensional model](https://learn.microsoft.com/en-us/fabric/data-warehouse/dimensional-modeling-load-tables)
- [Databricks: change data capture and snapshots](https://learn.microsoft.com/en-us/azure/databricks/ldp/what-is-change-data-capture)
- [Databricks: AUTO CDC APIs](https://docs.databricks.com/gcp/en/ldp/cdc)
`;export{e as default};