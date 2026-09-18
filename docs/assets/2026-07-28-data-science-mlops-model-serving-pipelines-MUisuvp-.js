var e=`---
title: "Partnering with Data Scientists on MLOps Pipelines"
date: 2026-07-28
tags: [data-engineering, mlops, feature-store, model-registry, model-serving, crypto]
series: data-engineering
summary: "Data engineers and data scientists need a shared operating model for ML: stable features, reproducible training sets, versioned models, automated retraining, monitored serving, and clear ownership from experiment to production."
---

# Partnering with Data Scientists on MLOps Pipelines

Data scientists do not need data engineers to throw tables over the wall.

They need data foundations that make modeling repeatable:

\`\`\`text
stable feature definitions
point-in-time correct training data
clear entity IDs
freshness guarantees
model versioning
serving contracts
monitoring
rollback paths
\`\`\`

This matters in crypto because the modeling problems are tied to volatile, messy data:

\`\`\`text
forecasting token volume
segmenting wallets
predicting user retention
decomposing KPI movement
detecting exchange balance anomalies
scoring asset risk
\`\`\`

If the data foundation is weak, the model discussion becomes noise. The team argues about whether the forecast is wrong when the real problem is stale prices, duplicated balances, broken asset mappings, or training data that leaked future information.

The partnership works when data engineering owns the production data path and data science owns the modeling logic, with a shared contract between them.

## Start with model use cases

Do not start with "we need an MLOps platform."

Start with the models the business actually needs.

For a crypto product, common model families might be:

\`\`\`text
forecasting          trading volume, revenue, TVL, deposits, withdrawals
segmentation         wallet cohorts, exchange user behavior, asset holder groups
retention            user churn, repeat deposit behavior, wallet reactivation
KPI decomposition    why daily volume, revenue, or active wallets changed
anomaly detection    balance jumps, price gaps, missing provider updates
risk scoring         asset liquidity, counterparty exposure, wallet behavior
\`\`\`

Each model needs different features and serving patterns.

Forecasting usually needs historical time-series features:

\`\`\`text
daily volume
price volatility
active wallets
deposit count
market regime
calendar effects
promotion flags
\`\`\`

Segmentation usually needs entity-level aggregates:

\`\`\`text
wallet age
assets held
average balance
transaction frequency
chain mix
exchange activity
recent behavior windows
\`\`\`

Retention models need user or wallet timelines:

\`\`\`text
first deposit date
last activity date
days since last trade
number of active weeks
support ticket count
fee paid
portfolio drawdown
\`\`\`

KPI decomposition needs clean metric components:

\`\`\`text
new users
retained users
reactivated users
average balance
transaction count
fee rate
asset price effect
volume mix effect
\`\`\`

The data model should match these use cases, not the other way around.

## Define the handoff contract

The handoff between data engineering and data science should be explicit.

For every production model, define:

\`\`\`text
prediction target
entity key
prediction time
feature list
label definition
training window
serving latency
refresh frequency
owner
rollback rule
\`\`\`

Example:

\`\`\`text
Model: wallet_retention_30d
Entity: wallet_id
Prediction time: daily at 00:00 UTC
Target: active again within next 30 days
Training window: last 18 months
Feature freshness: all features complete by 02:00 UTC
Serving mode: batch scores into mart__wallet_retention_scores
Owner: data science for model, data engineering for feature pipeline
Rollback: keep previous champion model if validation fails
\`\`\`

This contract prevents a common failure: data science trains on one dataset, engineering serves another, and no one notices until the model behaves badly.

## Build feature foundations

A feature is a production contract, not a loose column name.

A production feature needs:

\`\`\`text
name
entity
type
definition
freshness
valid time
source lineage
null behavior
owner
tests
\`\`\`

For crypto:

\`\`\`text
wallet_7d_transfer_count
wallet_30d_volume_usd
asset_7d_realized_volatility
asset_liquidity_score
account_balance_usd
chain_activity_share
days_since_last_deposit
\`\`\`

Feature tables should be boring and inspectable:

\`\`\`sql
create table features_wallet_daily (
    feature_date date not null,
    wallet_id text not null,
    wallet_7d_transfer_count integer not null,
    wallet_30d_volume_usd numeric not null,
    days_since_last_deposit integer,
    asset_count integer not null,
    run_id text not null,
    built_at timestamptz not null,
    primary key (feature_date, wallet_id)
);
\`\`\`

The \`feature_date\` matters. Training data must know what was true at prediction time. A retention model trained with future balances is not a good model. It is leakage with a nice metric.

## Use a feature store when reuse becomes real

A feature store becomes useful when multiple models reuse the same features, or when online serving needs the same definitions as offline training.

Feast is one common open-source option. Its core idea is to define features as code, pull historical features from an offline store, and materialize fresh values into an online store for low-latency serving.

The basic shape:

\`\`\`text
offline store     BigQuery, Snowflake, warehouse, lakehouse
online store      Redis, DynamoDB, or another low-latency store
feature repo      version-controlled feature definitions
materialization   move latest features from offline to online
training          retrieve point-in-time historical features
serving           retrieve current online features by entity
\`\`\`

For a wallet retention model:

\`\`\`text
offline feature table: features_wallet_daily
online feature view: latest wallet features by wallet_id
training dataset: point-in-time joins over historical feature_date
serving request: wallet_id -> latest features -> retention model -> score
\`\`\`

Do not add a feature store on day one if there is one model and batch scoring is enough. Start with versioned feature tables and clean dbt models. Add Feast or a managed feature store when reuse, online serving, or point-in-time joins become painful.

## Model registry and experiment tracking

Data scientists need room to experiment. Production needs versioning.

MLflow is a common way to track experiments and manage model versions. It can record:

\`\`\`text
parameters
metrics
training data version
feature set version
code commit
model artifact
model signature
evaluation reports
registered model version
aliases such as champion or challenger
\`\`\`

For a crypto volume forecast:

\`\`\`text
experiment: volume_forecast_daily
run_id: mlflow_run_abc123
features: feature_set_volume_v8
training data cutoff: 2026-07-01
git sha: 91af12c
metric: validation_mape = 8.4 percent
registered model: volume_forecast
model version: 14
alias: challenger
\`\`\`

The model registry is where promotion should happen:

\`\`\`text
candidate trained
validation passed
backtest accepted
risk review approved if needed
model registered
alias moved from challenger to champion
serving job picks up champion
\`\`\`

Production code should not depend on "latest.pkl" in a bucket. That is not a versioning strategy.

## Automated retraining

Automated retraining should be triggered by reason, not habit.

Common triggers:

\`\`\`text
scheduled monthly retraining
new labeled data available
feature distribution drift
model performance degradation
market regime change
major product change
manual retraining request
\`\`\`

For crypto, drift is common:

\`\`\`text
volatility regime changes
new token listings
delisted assets
chain fee behavior shifts
market hours are 24/7
exchange outage changes user behavior
stablecoin depeg changes risk signals
\`\`\`

A retraining pipeline should do:

\`\`\`text
build training dataset
validate feature freshness and leakage rules
train candidate model
evaluate against baseline and champion
log run to tracking system
register candidate model
run shadow or backtest checks
promote only if criteria pass
keep champion if criteria fail
\`\`\`

Example promotion rule:

\`\`\`text
promote wallet_retention_30d only if:
validation AUC improves by at least 1 percent
calibration error does not worsen
feature freshness passed
no report-critical features are missing
backtest performance is stable across top wallet cohorts
\`\`\`

Automation should not remove review from high-impact models. It should remove manual glue from safe steps.

## Serving patterns

Model serving depends on latency and use case.

Batch serving:

\`\`\`text
daily forecast tables
wallet retention scores
asset risk scores
KPI decomposition outputs
\`\`\`

This can run through dbt plus Python jobs and write back to warehouse marts.

Near-real-time serving:

\`\`\`text
wallet action recommendation
risk scoring during transaction review
fresh anomaly score for exchange balance changes
\`\`\`

This may need an online feature store and a serving API.

Streaming serving:

\`\`\`text
chain event anomaly detection
real-time liquidation risk alerts
order book feature updates
\`\`\`

This needs stream processing, online features, and careful latency budgets.

KServe is one option for Kubernetes-based model serving. It uses declarative model serving resources and can support autoscaling, versioning, and traffic routing. Managed platforms like Vertex AI, SageMaker, or Databricks Model Serving can fill the same role if the team wants less platform ownership.

The important contract is the same:

\`\`\`text
model name
model version or alias
input schema
feature version
output schema
latency target
fallback behavior
monitoring metrics
\`\`\`

## The model output is data too

Model predictions should be stored with lineage.

Example:

\`\`\`sql
create table mart__wallet_retention_scores (
    score_date date not null,
    wallet_id text not null,
    model_name text not null,
    model_version text not null,
    feature_set_version text not null,
    score numeric not null,
    score_band text not null,
    run_id text not null,
    scored_at timestamptz not null,
    primary key (score_date, wallet_id, model_name, model_version)
);
\`\`\`

This lets analysts ask:

\`\`\`text
which model produced this score
which features went into it
which run generated it
which model was champion that day
whether the score changed after retraining
\`\`\`

For financial or customer-impacting decisions, prediction lineage is not optional.

## Monitoring the ML lifecycle

MLOps monitoring has more than uptime.

Track:

\`\`\`text
feature freshness
feature null rates
feature distribution drift
training run status
model validation metrics
serving latency
prediction volume
prediction distribution drift
business KPI impact
champion vs challenger performance
\`\`\`

For crypto:

\`\`\`text
asset volatility feature drift
wallet cohort distribution drift
daily volume forecast error
retention score calibration
missing chain activity features
new listed assets with no feature history
\`\`\`

Alerts should be tied to action:

\`\`\`text
feature freshness failed -> block scoring
validation metric regressed -> do not promote candidate
serving latency high -> scale serving layer or fall back to batch scores
prediction distribution shifted -> investigate drift
new asset has no feature history -> route to review
\`\`\`

## How data engineering and data science should split ownership

Data engineering should own:

\`\`\`text
raw and staging pipelines
feature tables
feature freshness
entity IDs
point-in-time joins
training dataset generation
serving infrastructure
monitoring plumbing
run logs and lineage
\`\`\`

Data science should own:

\`\`\`text
target definition
model approach
feature usefulness
training code
evaluation metrics
promotion criteria
model interpretation
business review of outputs
\`\`\`

Shared ownership:

\`\`\`text
feature definitions
label definitions
data leakage checks
model promotion rules
rollback criteria
incident review
\`\`\`

This split keeps production stable without turning data scientists into platform engineers.

## A practical crypto MLOps architecture

Start with this:

\`\`\`text
1. Raw crypto data lands immutably.
2. dbt builds staging, marts, and feature tables.
3. Feature tables include entity, feature date, run ID, and freshness metadata.
4. Training jobs read point-in-time correct datasets.
5. MLflow tracks experiments and registers model versions.
6. A retraining workflow trains candidate models on schedule or drift trigger.
7. Promotion moves a model alias from challenger to champion only after checks pass.
8. Batch or online serving writes versioned predictions.
9. Monitoring tracks features, models, serving, and business outcomes.
10. Rollback returns serving to the previous champion model.
\`\`\`

That is enough for a real first version.

Skip the full platform until there are multiple models, repeated features, or production serving pressure. Clean feature tables, run IDs, and model registry discipline will carry the early system further than a giant MLOps stack with unclear ownership.

## The rule

Data scientists build better models when the data path is boring.

The data engineering job is to make the boring parts dependable:

\`\`\`text
same entity IDs
same feature definitions
same training data rebuild
same model version lookup
same serving contract
same rollback path
\`\`\`

For crypto models, this is the difference between a model that works in a notebook and a model the business can trust during volatility.

## References

- [MLflow Tracking](https://mlflow.org/docs/latest/ml/tracking/)
- [MLflow Model Registry workflows](https://www.mlflow.org/docs/latest/ml/model-registry/workflow/)
- [Feast feature store overview](https://docs.feast.dev/getting-started/components/overview)
- [Feast feature repository](https://docs.feast.dev/master/reference/feature-repository)
- [KServe resources](https://kserve.github.io/website/docs/next/concepts/resources)
- [dbt documentation](https://docs.getdbt.com/docs/introduction)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [Point-in-Time Correctness in Crypto Analytics](/posts/2026-07-24-point-in-time-correctness-crypto-analytics)
- [Monitoring, Alerting, and Logging for Crypto Data Pipelines](/posts/2026-07-28-monitoring-alerting-logging-crypto-pipelines)
`;export{e as default};