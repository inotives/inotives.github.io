var e=`---
title: "The Data Quality Review Queue"
date: 2026-07-23
tags: [data-quality, crypto, data-engineering, quarantine, ai-agents, pipelines]
series: data-engineering
summary: "Quarantined rows and repeated warnings should not sit in logs forever. A data quality review queue turns unmapped assets, stale sources, contract failures, and recurring warnings into small tasks humans and agents can inspect, fix, and close."
---

# The Data Quality Review Queue

Quarantine tables catch bad rows.

Severity rules decide whether the pipeline should fail or warn.

That still leaves the real question: who fixes the mess?

If quarantined rows sit in a table nobody reads, they become a slower version of dropping data. If warnings repeat for weeks, they become background noise. If unmapped crypto assets pile up, the next report either blocks forever or quietly excludes exposure.

Bad data needs a queue.

Not a ticketing empire. A small review queue that turns pipeline evidence into work.

## The queue is the bridge

A data quality review queue sits between detection and repair.

It takes evidence from:

- quarantine tables
- run logs
- dbt test failures
- freshness checks
- asset mapping gaps
- repeated warnings

Then it groups that evidence into tasks:

\`\`\`text
review unmapped asset from CoinGecko
investigate repeated stale price source
fix negative price rows from exchange feed
add chain ID for token contract
decide whether warning should become blocking
\`\`\`

The goal is to stop treating every bad row as a separate crisis.

## Rows are not tasks

One quarantined row is evidence. It is not always a task.

If 500 rows fail with the same \`unmapped_asset\` reason for the same provider ID, that should be one review item:

\`\`\`text
provider: coingecko
external_id: new-token
failure_reason: unmapped_asset
affected_rows: 500
first_seen_at: 2026-07-23T02:10:00Z
latest_run_id: 2026-07-23T021500Z
\`\`\`

The reviewer does not need 500 tickets. They need one task with enough evidence to decide the mapping.

That grouping rule is the core of the queue.

## The minimum schema

Start with one table:

\`\`\`text
data_quality_review_items
\`\`\`

Fields:

\`\`\`text
review_item_id
issue_type
status
severity
source_name
entity
group_key
failure_reason
affected_rows
first_seen_at
last_seen_at
latest_run_id
sample_payload_json
suggested_action
assigned_to
resolved_at
resolution_note
\`\`\`

\`group_key\` is the important field. It should represent the thing that needs a decision.

Examples:

\`\`\`text
unmapped_asset:coingecko:new-token
stale_source:coingecko.prices
contract_violation:mart__asset_prices:price_usd
missing_chain_id:token-list:0xa0b8...
\`\`\`

That lets new evidence update an existing review item instead of creating duplicates.

## Status should be boring

Use a small workflow:

\`\`\`text
open
in_review
fix_ready
fixed
ignored
blocked
\`\`\`

\`open\` means the pipeline found an issue.

\`in_review\` means someone or some agent is investigating.

\`fix_ready\` means there is a proposed mapping, contract change, parser fix, or severity change.

\`fixed\` means the repair landed and the affected rows were replayed or validated.

\`ignored\` means the issue is accepted noise, with a reason.

\`blocked\` means the issue cannot be resolved without outside information.

Do not add twelve states. The queue should explain work, not become work.

## Repeated warnings should escalate

Warnings need memory.

A warning that happens once may be fine. A warning that happens every run is not fine.

Track:

\`\`\`text
first_seen_at
last_seen_at
seen_count
latest_run_id
\`\`\`

Then define escalation rules:

\`\`\`text
same warning seen 3 runs in a row -> create review item
same unmapped asset seen for 24 hours -> raise severity
same stale source seen for 2 days -> block dependent agent views
ignored warning reappears after contract change -> reopen
\`\`\`

This prevents the classic data quality failure: every check technically works, but nobody acts on the output.

## Unmapped assets are the perfect use case

Crypto asset mapping is not always automatic.

An unmapped token needs judgment:

- Is this a new asset?
- Is it a duplicate provider record?
- Is it a wrapped version of an existing asset?
- Which chain does it belong to?
- Is the contract address valid?
- Should it map to an existing canonical asset or create a new one?

That is review work.

The queue item should carry a sample:

\`\`\`json
{
  "issue_type": "unmapped_asset",
  "source_name": "coingecko",
  "external_id": "new-token",
  "external_symbol": "NTK",
  "chain_id": 1,
  "contract_address": "0x...",
  "affected_rows": 128,
  "suggested_action": "review asset_provider_mappings"
}
\`\`\`

An agent can prepare a proposed mapping. A human should approve it before the mart changes.

## Agents should prepare, not auto-decide

Agents are useful in the review queue because the task is bounded.

Good agent tasks:

\`\`\`text
summarize unresolved review items by severity
inspect sample payloads for unmapped assets
compare external IDs against existing mappings
draft a mapping patch
find repeated freshness warnings
explain why a report is blocked
\`\`\`

Bad agent task:

\`\`\`text
automatically map every unknown token and publish the report
\`\`\`

Crypto identity mistakes are expensive. Let agents gather evidence and prepare changes. Keep approval for mappings, severity policy changes, and report republishing.

That is the practical split.

## Closing the loop

A review item is not fixed when someone writes a note.

It is fixed when the pipeline proves it:

\`\`\`text
mapping added
quarantined rows replayed
dbt tests passed
report block cleared
agent-facing dataset marked usable
review item closed with run_id
\`\`\`

The close event should include evidence:

\`\`\`json
{
  "review_item_id": "dq_00142",
  "status": "fixed",
  "fix_run_id": "backfill_2026-07-23T031000Z",
  "rows_replayed": 128,
  "blocking_checks": 0
}
\`\`\`

That keeps the queue connected to the pipeline instead of the conversation alone.

## The practical rule

Every recurring warning or quarantined pattern should become a review item.

Group by the decision that needs to be made. Track severity, affected rows, sample payload, latest run ID, and suggested action. Let agents prepare evidence. Require proof before closing.

Data quality does not improve because checks exist.

It improves when someone works the queue.

## References

- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [When to Fail the Pipeline vs Warn](/posts/2026-07-22-when-to-fail-pipeline-vs-warn)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [The Crypto Asset Mapping Table](/posts/2026-07-21-crypto-asset-mapping-table)
- [Backfills Without Breaking Crypto Reports](/posts/2026-07-23-backfills-without-breaking-crypto-reports)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
`;export{e as default};