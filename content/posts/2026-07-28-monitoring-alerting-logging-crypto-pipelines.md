---
title: "Monitoring, Alerting, and Logging for Crypto Data Pipelines"
date: 2026-07-28
tags: [data-engineering, monitoring, alerting, logging, cloudwatch, prometheus, grafana, slack, crypto]
series: data-engineering
summary: "Crypto data pipelines need proactive monitoring before bad data reaches reports. CloudWatch, Prometheus, Grafana, and Slack webhooks can cover infrastructure metrics, pipeline metrics, dashboards, alert routing, and operator-friendly incident messages."
---

# Monitoring, Alerting, and Logging for Crypto Data Pipelines

A crypto pipeline should not wait for an analyst to notice a wrong number.

By then the damage is already in the report, dashboard, or agent answer.

Good operations work starts earlier:

```text
logs tell you what happened
metrics tell you whether it is normal
alerts tell the right person before the failure spreads
dashboards show the current state without digging through terminals
```

CloudWatch, Prometheus, Grafana, and Slack can work together here. They do not replace data quality tests or dbt checks. They make pipeline failures visible fast enough to act.

For crypto data, that means alerts for:

```text
CoinGecko freshness lag
exchange API failure rate
missing wallet balance snapshots
CDC lag from production replicas
dbt model failures
quarantine row spikes
asset mapping gaps
report publication delays
warehouse cost spikes
```

The goal is proactive issue resolution: catch the problem while it is still a failed partition, not after it becomes a bad financial report.

## Separate logs, metrics, and alerts

These three get mixed together too often.

Logs are event records:

```json
{"run_id":"run_2026_07_28_090000","source":"coingecko","event":"page_loaded","page":4,"row_count":250,"duration_ms":823}
```

Metrics are numeric time series:

```text
crypto_pipeline_rows_loaded_total{source="coingecko"} 250
crypto_pipeline_freshness_lag_seconds{source="coingecko"} 180
crypto_pipeline_quarantine_rows_total{reason="missing_asset_mapping"} 12
```

Alerts are decisions:

```text
CoinGecko freshness lag is above 30 minutes for 10 minutes.
Daily NAV report has not published by 09:30.
Quarantine rows for missing mappings increased above threshold.
```

Keep that split. Logs are for debugging. Metrics are for trend and threshold detection. Alerts are for action.

## What CloudWatch should own on AWS

CloudWatch fits AWS infrastructure and managed service monitoring.

Use it for:

```text
Lambda errors and duration
ECS or EC2 CPU and memory
container restarts
SQS queue depth
RDS CPU, storage, connections, and replication lag
CloudWatch Logs for ingestion workers
CloudWatch alarms for infrastructure thresholds
```

For a crypto ingestion stack on AWS:

```text
ECS task runs Prefect worker
RDS Postgres stores raw and staging tables
SQS queues exchange ingestion jobs
S3 stores raw payload archives
CloudWatch collects worker logs and infrastructure metrics
```

Useful CloudWatch alarms:

```text
SQS queue age > 10 minutes
RDS replica lag > 60 seconds
ECS task restart count > 3 in 15 minutes
Lambda error rate > 5 percent
disk free storage below threshold
```

These alerts do not know whether BTC price is correct. They tell you the platform carrying the data is under stress.

Example alarm idea:

```text
Alarm: crypto-ingest-queue-lag-high
Metric: ApproximateAgeOfOldestMessage
Threshold: greater than 600 seconds for 2 periods
Action: notify SNS topic or webhook bridge
Slack: #data-alerts
```

CloudWatch is the right first layer when the problem is infrastructure.

## The GCP equivalent: Cloud Logging and Cloud Monitoring

On Google Cloud, the CloudWatch equivalent is split across Cloud Logging and Cloud Monitoring.

Use Cloud Logging for:

```text
GKE workload logs
Cloud Run job logs
Compute Engine worker logs
Dataflow logs
BigQuery audit logs
application JSON logs
log routing to BigQuery, Cloud Storage, or Pub/Sub
```

Use Cloud Monitoring for:

```text
metrics dashboards
alerting policies
uptime checks
custom metrics
log-based metrics
incident notifications
```

For a crypto ingestion stack on GCP:

```text
Cloud Run job runs exchange ingestion
GKE runs Prefect or Dagster workers
Cloud SQL Postgres stores raw and staging tables
Pub/Sub queues provider ingestion tasks
Cloud Storage stores raw payload archives
Cloud Logging collects worker and platform logs
Cloud Monitoring watches metrics and alert policies
```

Useful GCP alerts:

```text
Pub/Sub oldest unacked message age > 10 minutes
Cloud SQL replica lag > 60 seconds
Cloud Run error rate > 5 percent
GKE pod restarts > threshold
BigQuery slot usage or query cost spike
log-based metric for missing_asset_mapping > 0
```

The pattern is the same as AWS. The cloud-native layer watches infrastructure and platform services. Prometheus still watches pipeline-specific behavior when your code emits metrics.

For example, a structured log from a Cloud Run ingestion job can become a log-based metric:

```json
{"severity":"WARNING","run_id":"run_2026_07_28_090000","pipeline":"binance_balances","event":"quarantine_rows","reason":"missing_asset_mapping","row_count":12}
```

Cloud Logging stores and queries the event. Cloud Monitoring can alert when the matching count crosses a threshold. The Slack notification should still point back to the run ID, dashboard, and review action.

## What Prometheus should own

Prometheus fits application and pipeline metrics.

Use it for metrics your own code emits:

```text
rows loaded
records quarantined
source freshness lag
provider request latency
provider error rate
dbt model duration
pipeline run status
backfill progress
agent query refusal count
```

Example Prometheus metrics:

```text
crypto_provider_request_total{provider="coingecko",status="success"} 1280
crypto_provider_request_total{provider="coingecko",status="error"} 31
crypto_source_freshness_lag_seconds{source="coingecko_prices"} 420
crypto_quarantine_rows_total{reason="missing_asset_mapping"} 7
crypto_dbt_model_duration_seconds{model="mart__daily_nav"} 34.2
crypto_report_publish_status{report="daily_nav",status="success"} 1
```

Prometheus alert rules can turn those metrics into actionable conditions.

Example rules:

```yaml
groups:
  - name: crypto_pipeline_alerts
    rules:
      - alert: CoinGeckoFreshnessLagHigh
        expr: crypto_source_freshness_lag_seconds{source="coingecko_prices"} > 1800
        for: 10m
        labels:
          severity: warning
          team: data
        annotations:
          summary: "CoinGecko prices are stale"
          description: "Freshness lag is above 30 minutes for run {{ $labels.run_id }}."

      - alert: MissingAssetMappingsBlockingReport
        expr: crypto_quarantine_rows_total{reason="missing_asset_mapping"} > 0
        for: 5m
        labels:
          severity: critical
          team: data
        annotations:
          summary: "Missing asset mappings are blocking crypto marts"
          description: "Rows are quarantined because provider assets are unmapped."
```

Prometheus should not send every alert directly to Slack by itself. Alertmanager handles grouping, routing, silencing, and deduplication.

## Where dbt fits

dbt belongs in this system too.

It is the best place to express data-quality rules that live close to the models:

```text
canonical_asset_id is not null
one row per asset and report date
daily NAV reconciles to balances
quarantined rows do not enter marts
source freshness is within the reporting window
```

dbt tests can produce three useful operational outcomes:

```text
pass      build can continue
warn      build can continue, but the issue should be visible
fail      build should stop or block report publication
```

For example, a non-critical stale reference table might warn:

```yaml
models:
  - name: dim_platforms
    columns:
      - name: platform_id
        data_tests:
          - not_null:
              config:
                severity: warn
```

A report-critical mart should fail:

```yaml
models:
  - name: mart__daily_nav
    columns:
      - name: canonical_asset_id
        data_tests:
          - not_null:
              config:
                severity: error
```

The alert should not come from dbt alone. dbt produces the result. The orchestrator and monitoring layer should capture it.

The practical flow:

```text
dbt build runs
-> dbt writes run_results.json and logs
-> Prefect, Dagster, Airflow, or CI reads the result
-> failed and warned tests become metrics or structured logs
-> Prometheus, Cloud Monitoring, or Grafana evaluates alert rules
-> Slack webhook posts the action message
```

For crypto reports, dbt test results can become metrics like:

```text
crypto_dbt_test_failures_total{model="mart__daily_nav",severity="error"} 1
crypto_dbt_test_warnings_total{model="dim_platforms",severity="warn"} 1
crypto_dbt_model_status{model="mart__portfolio_exposure",status="success"} 1
```

This gives the team alerting without hiding the source of truth. The failed rule stays in dbt. The incident routing stays in monitoring.

Slack message:

```text
[critical] dbt test failed for mart__daily_nav
Test: not_null canonical_asset_id
Run: run_2026_07_28_090000
dbt invocation: 3ad6...
Impact: daily NAV report blocked
Action: review quarantined rows and asset mappings
```

That is the right split. dbt says whether the data passed the contract. The monitoring stack decides who needs to know.

## What Grafana should own

Grafana is where operators and engineers see the system.

Use dashboards for:

```text
pipeline run status
source freshness by provider
API request success rate
quarantine rows by reason
dbt model duration
warehouse query cost
report publish status
backfill progress
```

A useful crypto pipeline dashboard can have these panels:

```text
Latest successful run by pipeline
Freshness lag by source
Provider API error rate
Rows loaded by source
Rows quarantined by reason
dbt failures by model
Daily report publish status
Cloud cost by warehouse or dataset
```

Keep dashboards boring. The operator should answer the first question in five seconds:

```text
is ingestion working?
is transformation working?
are reports blocked?
what changed since the last good run?
```

Grafana Alerting can also send notifications. If Prometheus is already central, use Prometheus rules and Alertmanager. If Grafana is the team's alerting surface, define alert rules there and use contact points for Slack.

The important part is to avoid duplicate paging paths. One alert should have one owner and one route.

## Slack webhook alerting

Slack is the notification surface, not the monitoring system.

The clean pattern:

```text
CloudWatch alarm or Prometheus alert
-> Alertmanager, SNS, Lambda bridge, or Grafana contact point
-> Slack incoming webhook
-> #data-alerts or #data-incidents
```

Slack incoming webhooks accept JSON payloads. A simple alert payload can look like this:

```json
{
  "text": ":warning: CoinGecko freshness lag is high\nSource: coingecko_prices\nLag: 42 minutes\nRun: run_2026_07_28_090000\nDashboard: https://grafana.example.com/d/crypto-pipelines"
}
```

Do not put secrets, payload samples, account balances, wallet owner names, or customer data in Slack alerts.

Send pointers:

```text
run_id
pipeline
source
severity
failure reason
dashboard link
log query link
owner
next action
```

Bad Slack alert:

```text
Pipeline failed.
```

Good Slack alert:

```text
[critical] daily_nav report blocked
Reason: missing canonical asset mapping
Rows quarantined: 12
Run: run_2026_07_28_090000
Source: binance_balances
Owner: data-platform
Action: review asset mappings before rerun
```

An alert should tell the operator what to do next.

## Alert severity for crypto data

Severity should match business impact.

Example:

```text
info       backfill completed, no action
warning    CoinGecko prices stale but report not due yet
critical   daily NAV report blocked
page       production ingestion stopped for all exchanges
```

Useful crypto alert examples:

```text
Warning: source freshness lag > 30 minutes
Critical: report-critical source freshness lag > SLA
Critical: mart reconciliation failed
Warning: quarantine rows increased by more than 20 percent
Critical: canonical asset mapping missing for held asset
Warning: exchange API 429 rate increased
Page: no successful production run in 1 hour
Page: CDC lag exceeds report cutoff window
```

Do not page on every warning. Alert fatigue is an operations bug.

Warnings should create visibility. Critical alerts should block reports. Pages should wake someone only when human action is urgent.

## Logging for traceability

Logs should be structured.

Use JSONL for workers and orchestrators where possible:

```json
{"ts":"2026-07-28T09:00:01Z","level":"info","run_id":"run_2026_07_28_090000","pipeline":"coingecko_prices","event":"started"}
{"ts":"2026-07-28T09:00:11Z","level":"info","run_id":"run_2026_07_28_090000","pipeline":"coingecko_prices","event":"raw_loaded","row_count":5000}
{"ts":"2026-07-28T09:00:18Z","level":"warn","run_id":"run_2026_07_28_090000","pipeline":"coingecko_prices","event":"quarantine_rows","reason":"missing_asset_mapping","row_count":3}
```

Every log line should include:

```text
timestamp
level
run_id
pipeline name
source
event name
status
row counts when relevant
duration when relevant
error code when relevant
```

For debugging, the `run_id` is the most important field. It lets you connect:

```text
orchestrator run
raw rows
dbt invocation
quarantine rows
Grafana dashboard
Slack alert
published report
```

Without a shared run ID, each tool tells a separate story.

## A practical architecture

For a crypto pipeline on AWS:

```text
Prefect or Dagster runs ingestion and dbt jobs.
Application metrics are exposed in Prometheus format.
Prometheus scrapes worker metrics.
CloudWatch collects AWS service metrics and logs.
Grafana reads Prometheus and CloudWatch.
Alertmanager or Grafana routes alerts.
Slack incoming webhook posts to #data-alerts.
```

The same shape works with other clouds. Replace CloudWatch with the cloud's native monitoring layer, but keep the split:

```text
AWS infrastructure          CloudWatch
GCP infrastructure          Cloud Logging and Cloud Monitoring
pipeline metrics           Prometheus
visual dashboards          Grafana
alert delivery             Slack webhook
traceability               structured logs and run IDs
```

## Example workflow: stale prices

CoinGecko returns old data or the ingestion job falls behind.

Detection:

```text
crypto_source_freshness_lag_seconds{source="coingecko_prices"} > 1800
```

Alert path:

```text
Prometheus alert rule
-> Alertmanager groups by source and severity
-> Slack webhook posts to #data-alerts
-> Grafana dashboard link included
```

Slack message:

```text
[warning] CoinGecko price freshness lag high
Source: coingecko_prices
Lag: 42 minutes
Run: run_2026_07_28_090000
Impact: daily report not blocked yet
Action: check provider latency and retry queue
```

If the report cutoff is approaching, the severity can move from warning to critical.

## Example workflow: missing asset mapping

An exchange balance includes a token that has no canonical asset ID.

Detection:

```text
quarantine row reason = missing_asset_mapping
held asset appears in report-critical account
```

Alert path:

```text
dbt test or asset check fails
metric increments quarantine count
Grafana alert fires critical condition
Slack webhook notifies #data-alerts
```

Slack message:

```text
[critical] Missing asset mapping blocks portfolio mart
Source: binance_balances
Reason: missing_asset_mapping
Rows: 12
Run: run_2026_07_28_090000
Action: approve canonical asset mapping, then rerun affected mart
```

The alert should not ask someone to inspect raw logs first. It should point to the failed rule and the review action.

## Example workflow: CDC lag

If production data is replicated before ingestion, CDC lag matters. A report may be technically successful but built from stale replicated data.

Metric:

```text
crypto_cdc_replication_lag_seconds{source="prod_replica"} 900
```

Alert:

```yaml
- alert: CryptoCdcLagAboveReportWindow
  expr: crypto_cdc_replication_lag_seconds{source="prod_replica"} > 600
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "CDC lag exceeds crypto report window"
    description: "Replica lag is above 10 minutes. Block report publication until fresh."
```

Slack action:

```text
pause report publication
check replication health
rerun freshness gate after lag clears
```

This is a good alert because it protects the report before a stale number is published.

## What not to alert on

Do not alert on everything.

Skip alerts for:

```text
one transient retry that succeeds
expected backfill duration
non-critical stale sandbox source
debug logs
known maintenance window
raw provider revision that is already quarantined
```

Track them as metrics or logs instead.

A small team cannot respond to noisy alerts. The alert set should protect the important surfaces:

```text
source freshness
report publication
reconciliation
provider failure rate
quarantine spikes
infrastructure saturation
CDC lag
cost spikes
```

## The rule

Monitoring is not a dashboard collection.

Alerting is not Slack spam.

Logging is not a pile of strings.

For crypto data pipelines, the operating model should be:

```text
CloudWatch watches AWS infrastructure.
Cloud Logging and Cloud Monitoring cover the same cloud-native layer on GCP.
Prometheus watches pipeline behavior.
Grafana shows status and routes alerts.
Slack receives concise action messages.
Structured logs preserve the run trail.
```

The best alert is the one that reaches the right channel before a bad crypto report is published, with enough context to fix the problem without guessing.

## References

- [Amazon CloudWatch alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Alarms.html)
- [Amazon CloudWatch Logs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html)
- [Google Cloud Logging overview](https://docs.cloud.google.com/logging/docs/overview)
- [Google Cloud log-based metrics](https://docs.cloud.google.com/logging/docs/logs-based-metrics)
- [Google Cloud log-based alerting policies](https://docs.cloud.google.com/logging/docs/alerting/monitoring-logs)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt test severity](https://docs.getdbt.com/reference/resource-configs/severity)
- [dbt run results artifact](https://docs.getdbt.com/reference/artifacts/run-results-json)
- [Prometheus alerting overview](https://prometheus.io/docs/alerting/latest/overview/)
- [Prometheus alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Grafana Alerting contact points](https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/contact-points/)
- [Grafana Slack alerting integration](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-slack/)
- [Slack incoming webhooks](https://api.slack.com/messaging/webhooks)
- [Run Logs Are Data Too](/posts/2026-07-22-run-logs-are-data-too)
- [When to Fail the Pipeline vs Warn](/posts/2026-07-22-when-to-fail-pipeline-vs-warn)
- [Self-Healing, Auto-Scaling Crypto Data Pipelines](/posts/2026-07-28-self-healing-auto-scaling-crypto-pipelines)
