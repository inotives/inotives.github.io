---
title: "OpenTelemetry before production: redact, count, then sample"
date: 2026-11-14
tags: [opentelemetry, observability, ai-agents, llm-ops, tracing, tail-sampling, otel-collector, grafana]
summary: "Part three of the OpenTelemetry series. I put a gateway Collector in front of the agent stack from the last note and replayed 1,000 agent runs through it to test the three things the explainer said to add before production: redaction, tail sampling and alerting. Redaction worked first time. Tail sampling quietly dropped every slow and expensive run until decision_wait was longer than the longest run. And metrics computed after sampling were badly wrong: Tempo reported a 33% tool error rate when the truth was 13.4%, and with a longer wait it threw almost all spans away. The fix is a fixed order inside the Collector: redact, count, then sample."
---

The [OpenTelemetry explainer](/notes/2026-11-10-what-is-opentelemetry) ended with a to-do list for going beyond a laptop: add a redaction processor before turning on content capture, and add tail sampling once volume grows. The [walkthrough](/notes/2026-11-12-tracing-one-agent-run-opentelemetry) did the laptop part, one agent and one Grafana container, and got as far as metrics and a cost query.

This note does the to-do list. I put a **gateway Collector** between the agent and the backend, configured redaction and tail sampling, and pushed 1,000 agent runs through it to check what actually comes out the other end.

The short version: redaction was easy. Sampling had two traps, and both of them failed silently.

## The setup

![A replay of the crypto-desk agent sends 1,000 runs to a gateway Collector. Inside, a transform processor redacts emails and API keys first. The spans then split: the spanmetrics connector counts every span, and a forward connector passes them to tail_sampling, which keeps errors, slow runs, costly runs and 10% of the rest. Metrics from 100% of spans go to Prometheus; Tempo receives traces for 275 of 1,000 runs.](/assets/images/otel-gateway-pipeline.svg)

**The traffic.** A thousand real model calls would have cost money and taken hours, so this time the agent is a **replay**. A small Python script produces runs with the same shape as crypto-desk from the last note: an `invoke_agent` root span, `chat` spans with `gen_ai.*` token attributes and the user prompt in `gen_ai.input.messages`, and `execute_tool get_price` / `calculate` spans. The failure mix is modelled on what I saw before. About 12% of price lookups are rate-limited with one retry, 2% hang and time out, and 3% of runs get stuck re-checking prices until they hit the eight-turn cap. To test redaction, 4% of prompts include an email address and 3% include a fake `sk-ant-…` key.

The runs happen in **real time**, 100 at a time, with each span exported as it ends, just like a live agent. I tried a quicker version first that backdated all the timestamps, and it hid both of the problems below. That's a lesson in itself: sampling bugs depend on timing, so test with real timing.

**The stack.** The same `grafana/otel-lgtm` container as last time, with `otel/opentelemetry-collector-contrib` 0.140.1 in front of it as the gateway. The generator also writes down the ground truth for every run, so I can compare what was sent with what got stored.

The gateway config is short. The important part is the order:

```yaml
processors:
  transform/redact:                       # 1. redact first
    trace_statements:
      - context: span
        statements:
          - replace_all_patterns(attributes, "value", "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", "[email]")
          - replace_all_patterns(attributes, "value", "sk-ant-[A-Za-z0-9_-]{20,}", "[api-key]")
  tail_sampling:                          # 3. sample last
    decision_wait: 45s
    policies:
      - { name: errors,    type: status_code,       status_code: { status_codes: [ERROR] } }
      - { name: slow,      type: latency,           latency: { threshold_ms: 20000 } }
      - { name: expensive, type: numeric_attribute, numeric_attribute: { key: crypto_desk.run.input_tokens, min_value: 15000 } }
      - { name: baseline,  type: probabilistic,     probabilistic: { sampling_percentage: 10 } }

connectors:
  spanmetrics: { namespace: gateway }     # 2. count every span
  forward:

service:
  pipelines:
    traces/in:     { receivers: [otlp],        processors: [transform/redact],      exporters: [spanmetrics, forward] }
    traces/out:    { receivers: [forward],     processors: [tail_sampling, batch],  exporters: [otlphttp/lgtm] }
    metrics/spans: { receivers: [spanmetrics], processors: [batch],                 exporters: [otlphttp/lgtm] }
```

Tail-sampling policies are OR-ed together, so a trace is kept if any one of them matches. The `expensive` policy reads `crypto_desk.run.input_tokens`, the run total the last note put on the root span. That pays off here: a token threshold becomes a single attribute check.

## 1. Redaction: the easy part

`replace_all_patterns` runs the regex over **every** string attribute on every span, so it catches the prompt in `gen_ai.input.messages`, the tool arguments and anything else, without listing attribute names.

Across the runs, 71 prompts contained an email address or a key. Of the traces Tempo kept, 26 had one of those prompts. All 26 show `[email]` or `[api-key]`, and a search of every stored trace found **zero** raw addresses or keys.

Two caveats:

- **A regex only catches shapes you thought of.** It's a safety net. The real decision is still whether to capture message content at all, and as the last note found, the defaults differ by library.
- **Put it first.** Redacting before the connectors means nothing downstream ever sees the raw value. That includes the spanmetrics dimensions and any future exporter someone adds.

## 2. Tail sampling: decision_wait has to outlast your longest run

Tail sampling holds every span of a trace in memory, waits, then decides whether to keep the whole trace. The catch is what it waits *for*. `decision_wait` starts counting when the trace's **first** span arrives, not when the trace finishes. The Collector has no way of knowing when a trace is finished.

An agent's root span ends last. So for any run longer than `decision_wait`, the decision is made before the root arrives, which means before the run's total duration and token count exist:

![Timeline of a 26-second run. Chat and tool spans export in batches as they end; the root span with the token totals arrives last. With a 10-second wait the Collector decides at about 12.5 seconds, before the root exists, so the slow and expensive policies see nothing and the run is dropped. With a 45-second wait it decides after the root and keeps the run. On the same workload: failed runs 19/19 both times; runs with an error span 160/162 vs 162/162; slow runs 20/34 vs 34/34; expensive runs 25/39 vs 39/39.](/assets/images/otel-tail-sampling-decision-wait.svg)

With a 10-second wait (the value in the processor's README example; the default is 30 seconds), the Collector's own counters showed the `slow` and `expensive` policies sampling **zero** traces. The slow and expensive runs that did reach Tempo got there by luck, through the 10% baseline or because they also had an error. Two runs with error spans were dropped as well, most likely because their errors came after the decision. Nothing logged a warning, and the "late spans" counter stayed at zero.

All 1,000 runs finished within 30 seconds, and 68 of them took longer than 10. A 45-second wait kept **every** failed, slow and expensive run, plus 97 of the 822 boring ones (about the expected 10%). That's 275 of 1,000 traces stored.

The price is memory. The Collector holds roughly *traces per second × decision_wait* traces at once, so check `num_traces` against your peak rate. At this volume the gateway sat at about 70 MB, but a busy agent fleet would need sizing. If you run more than one gateway, every span of a trace has to land on the same one, which is what the `loadbalancing` exporter (routing by trace ID) is for.

## 3. Count before you sample

The trap that surprised me most was in the metrics. The LGTM stack's Tempo has a **metrics generator** that turns stored spans into `traces_spanmetrics_*` series. The last note used it for the tool error rate. Behind a sampler, it only sees what the sampler kept:

![Two bar groups for the same 1,000 runs. get_price error rate: truth 13.4%; gateway metrics computed before sampling 13.4%; Tempo span metrics with a 10-second wait 33.0%; with a 45-second wait 8.3% from just 24 spans, because 2,064 spans were discarded. Run failure rate: truth 1.9%; gateway 1.9%; Tempo 7.8% with a 10-second wait; 0.0% of 29 counted runs with a 45-second wait.](/assets/images/otel-sampled-metrics-bias.svg)

With a 10-second wait, Tempo reported a **33% tool error rate** and **7.8% failed runs**. The truth was 13.4% and 1.9%. That isn't noise. The sampler keeps every error and a tenth of the successes, so any ratio computed afterwards is skewed towards errors by design. An alert on that metric would fire constantly.

Raising the wait to 45 seconds made it worse in a different way. Tempo's generator ignores spans that ended more than 30 seconds before they arrive (`metrics_ingestion_time_range_slack`). Every span now waited at least 45 seconds in the gateway, and Tempo's own counter showed **2,064 of 2,163 spans discarded** with reason `outside_metrics_ingestion_slack`. Its "metrics" covered 29 runs.

The `spanmetrics` connector in the gateway avoids both problems, because it sits **before** the sampler. It counted all 1,000 runs and all 1,408 price lookups, and matched the ground truth exactly: 189 errors, 13.4%, and 19 failed runs. The token and cost metrics from the last note are safe for a similar reason: the agent records them directly with the metrics API, so they never pass through trace sampling at all.

So in practice:

- **Build dashboards and alerts on metrics counted before sampling**: the gateway's spanmetrics, or metrics the SDK records.
- **Treat the trace store as a sample.** It's for opening interesting runs, not for counting.
- **If Tempo sits behind a sampler, turn its span-metrics generator off**, or at least don't put anything on a dashboard from it.

## 4. Alerting on the right numbers

With honest metrics in Prometheus, the alerts are ordinary PromQL over the gateway's span counts. The tool error rate, for example:

```promql
sum(rate(gateway_duration_milliseconds_count{span_name="execute_tool get_price", status_code="STATUS_CODE_ERROR"}[5m]))
  / sum(rate(gateway_duration_milliseconds_count{span_name="execute_tool get_price"}[5m]))
  > 0.10
```

Pair it with the run failure rate on `invoke_agent` spans, and with the cost query from the last note on a longer window. I didn't wire these into Alertmanager for this note; the point is which series they read. One detail: the spanmetrics connector flushes on an interval, and its numbers lagged the runs by about a minute here. Alert windows should be several times that interval.

## What I'd check before turning this on

- **Order inside the Collector**: redact → count → sample. Each step protects the next one.
- **`decision_wait` longer than your slowest normal run**, measured rather than guessed. The gateway's duration histogram for the root span tells you.
- **Policy counters, not just the trace count.** `otelcol_processor_tail_sampling_count_traces_sampled` per policy is the only thing that showed `slow` and `expensive` sitting at zero.
- **Never compute a rate from sampled traces**, including the backend's helpful span metrics.
- **Test with real timing.** My first, backdated run made everything look fine.

## Closing thought

The walkthrough's conclusion was that the boring part was easy. Going toward production adds a caveat: the boring part is easy to get **quietly** wrong. Redaction either works or visibly doesn't. Sampling fails silently, by dropping exactly the runs you wanted, or by turning a 13% error rate into 33% on a dashboard that looks perfectly healthy. The fix wasn't clever: count everything before you throw anything away, and set `decision_wait` from measured run times.

## Sources

- OpenTelemetry Collector contrib: [tail sampling processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor), [transform processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor) and [OTTL functions](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/pkg/ottl/ottlfuncs), [spanmetrics connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/spanmetricsconnector), [loadbalancing exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter)
- OpenTelemetry, [Sampling](https://opentelemetry.io/docs/concepts/sampling/) and [Semantic conventions for generative AI systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- Grafana, [Tempo metrics generator](https://grafana.com/docs/tempo/latest/metrics-generator/) (including `metrics_ingestion_time_range_slack`) and [docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- Previous notes: [What is OpenTelemetry?](/notes/2026-11-10-what-is-opentelemetry), [Tracing one agent run end to end](/notes/2026-11-12-tracing-one-agent-run-opentelemetry)
