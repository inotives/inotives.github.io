---
title: "When to Fail the Pipeline vs Warn"
date: 2026-07-22
tags: [data-quality, crypto, data-engineering, freshness, pipelines, ai-agents]
series: data-engineering
summary: "Not every data quality failure should stop a pipeline, and not every warning should be allowed through. Crypto pipelines need clear severity levels, report-blocking rules, stale-data policies, and agent-facing refusal behavior."
---

# When to Fail the Pipeline vs Warn

Data quality checks are easy to write and hard to classify.

The check says a row is missing. A source is stale. A mapping failed. A price looks wrong. A reference table did not refresh.

Now what?

If every failure stops the pipeline, the system becomes fragile. If every failure becomes a warning, the marts rot quietly. The hard part is not detecting the problem. The hard part is deciding what the pipeline should do next.

Crypto pipelines need a severity model.

## Warnings are not small failures

A warning should mean:

```text
The pipeline can continue, and consumers can still use the output safely for this use case.
```

It should not mean:

```text
The pipeline failed, but we did not want to deal with it.
```

That difference matters. If an unmapped long-tail token appears in an asset discovery table, a warning might be fine. If an unmapped token appears in a customer portfolio report, a warning is probably a lie. The report may exclude exposure without saying so.

The same failure reason can have different severity depending on the output.

## A small severity model

You do not need a large incident taxonomy.

Start with four levels:

```text
info
warning
blocking
fatal
```

`info` records something useful but does not require action. A source loaded the expected number of rows. A freshness check passed. A known delisted asset stayed inactive.

`warning` means action is needed, but the current output remains safe enough. A reference table is late but still within tolerance for today's report. A new unmapped asset appeared in discovery data. A non-critical provider returned fewer optional metadata fields.

`blocking` means this output must not publish. A portfolio mart has unmapped balances. BTC or ETH prices are stale. A public mart violates its data contract.

`fatal` means the run itself cannot continue. The raw payload cannot be parsed. The database write failed. The source credentials are invalid. The pipeline cannot produce trustworthy intermediate data.

That is enough for most solo projects.

## Classify by consumer, not emotion

Severity should come from consumer risk.

Ask:

```text
Who uses this dataset?
What decision will they make from it?
Can stale or missing data change the decision?
Will the output label the problem clearly?
Can the agent or report refuse safely?
```

A stale coin list may be a warning. A stale price mart may be blocking. A stale compliance event feed may be fatal for the reporting job that depends on it.

Same freshness problem. Different consumer risk.

## Crypto examples

Reference data can often warn.

If `coingecko.stg__coins_list` is 28 hours old instead of 24, most internal analytics can probably continue. The run should record the warning and make the age visible.

Price data should be stricter.

If `mart__asset_prices` is older than its freshness contract, current-value reports should block. An agent should not answer "what is my BTC exposure now?" using old prices.

Asset mappings are stricter still when money is involved.

If a portfolio balance cannot map to `canonical_asset_id`, the portfolio exposure mart should block. Excluding the row would make the report look cleaner and less true.

Quarantine rows depend on the table.

Three quarantined rows in broad token discovery may warn. Three quarantined rows in customer balances should block.

## Blocking reports without killing ingestion

One mistake is tying every blocking output to a failed ingestion run.

These are different questions:

```text
Did ingestion complete?
Can staging continue?
Can marts publish?
Can agents use the result?
```

A source can ingest successfully while a report is blocked.

That distinction is useful. Keep the raw payload. Write staging rows where safe. Quarantine bad records. Then block the consumer-facing mart or report that cannot tolerate the issue.

The run status can say:

```json
{
  "run_id": "2026-07-22T021500Z",
  "ingestion_status": "completed",
  "transform_status": "completed_with_warnings",
  "publish_status": "blocked",
  "blocked_outputs": ["mart__portfolio_exposure"],
  "reason": "unmapped_asset"
}
```

That is more useful than one giant red or green status.

## Agent-facing refusal rules

Agents need machine-readable severity.

If a dataset is stale, incomplete, or blocked, the agent should see that before it answers.

For an agent-facing tool, return status with data:

```json
{
  "dataset": "mart__portfolio_exposure",
  "freshness_status": "stale",
  "severity": "blocking",
  "allowed_for_agent_use": false,
  "refusal_reason": "price data is older than 15 minutes"
}
```

The agent should refuse the current answer:

```text
I cannot answer current BTC exposure because the price mart is stale. Latest observed price is 42 minutes old.
```

That is better than a polished wrong answer.

Do not hide severity in a Slack alert. The agent will not read it at query time. Put it in the tool response, catalog metadata, or agent-facing view.

## When warnings should expire

Warnings should not live forever.

Some warnings should become blocking if they repeat.

Example:

```text
coin list late by 4 hours: warning
coin list late by 2 days: blocking for new asset mapping work
same unmapped asset seen for 7 runs: blocking review queue
freshness warning repeats 3 runs in a row: blocking
```

This prevents warning piles from becoming background noise.

You do not need an alert platform to start. Store `first_seen_at`, `last_seen_at`, and `seen_count` in the quarantine or run-log data. That is enough to escalate repeated issues.

## A simple policy table

For a small project, write the policy down:

```text
check                          discovery   internal mart   client report   agent tool
missing optional metadata      warning     warning         warning         warning
missing provider id            warning     blocking        blocking        blocking
unmapped asset                 warning     blocking        blocking        blocking
stale coin list < 48h          warning     warning         warning         warning
stale price > 15m              warning     blocking        blocking        blocking
negative price                 blocking    blocking        blocking        blocking
raw parse failure              fatal       fatal           fatal           fatal
```

The table does not need to be perfect. It needs to exist.

Once severity is explicit, agents and humans stop re-litigating the same failure every run.

## The practical rule

Fail when the output would mislead its consumer.

Warn when the issue is visible, bounded, and safe for the current use case.

Block reports and agent tools when freshness, identity, or contract failures make the answer untrustworthy. Let ingestion continue when preserving raw evidence is still useful.

The goal is not a green pipeline. The goal is honest output.

## References

- [Data Quality Checks: The Boring Layer That Saves Pipelines](/posts/2026-07-18-data-quality-checks-save-pipelines)
- [Freshness Is a Data Quality Dimension](/posts/2026-07-19-freshness-data-quality-dimension)
- [Quarantine Tables: Where Bad Crypto Data Should Go](/posts/2026-07-22-quarantine-tables-bad-crypto-data)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [The Minimum Viable Data Catalog for a Solo Crypto Project](/posts/2026-07-22-minimum-viable-data-catalog-solo-crypto-project)
- [When Agents Should Not Touch Your Database](/posts/2026-07-20-when-agents-should-not-touch-your-database)
