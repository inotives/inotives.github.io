---
title: "From traces to answers: what an agent run cost, and whether it was any good"
date: 2026-11-15
tags: [opentelemetry, observability, ai-agents, llm-ops, tracing, llm-evaluation, langfuse, grafana, cost-attribution]
summary: "Part four of the OpenTelemetry series. With telemetry flowing, I asked it two questions: where does the money go, and do expensive runs give better answers? I replayed 1,000 crypto-desk runs through one gateway Collector into both Tempo and a self-hosted Langfuse, tagged every model call with why it happened, and put a deterministic answer check on every run. A quarter of the spend was retries and re-checks. Expensive runs were worse, not better, but mostly because hard questions cost more. Within a question type the gap nearly vanished. Tail sampling made both answers wrong: it put waste at 44% instead of 26%, and it threw away 28 of 35 wrong answers that had no error span. One extra sampling policy on the score fixed that."
---

The [explainer](/notes/2026-11-10-what-is-opentelemetry) said what OpenTelemetry is. The [walkthrough](/notes/2026-11-12-tracing-one-agent-run-opentelemetry) traced one agent end to end. [Part three](/notes/2026-11-14-otel-collector-redact-sample-count) put a gateway Collector in front of it to redact, count and sample.

So the telemetry works. But I still couldn't answer the two questions I actually care about: **which step makes runs expensive**, and **are the expensive runs any better**? This note asks the telemetry those two questions, in two backends, and checks the answers against ground truth.

Short version:

1. **A quarter of the spend was waste.** 26% of model-call cost went on calls that only happened because a tool failed or the agent re-checked a price it already had. To see that, I had to add one attribute to each model call saying *why* it happened. Span names alone can't tell you.
2. **Expensive runs were worse, not better, but mostly because hard questions cost more.** Across all runs, the cheapest fifth was 96% correct and the most expensive fifth 79%. Within one question type the gap almost vanished. The money spent on retries and loops bought nothing.
3. **Tail sampling distorted both answers.** Querying the sampled traces in Tempo put waste at 44% and the correct-answer rate at 75% (truth: 26% and 89%). It also dropped 28 of the 35 wrong answers that had no error span, because nothing marked them as worth keeping. A sampling policy on the score fixed that.
4. **Tempo and Langfuse are good at different questions.** Tempo plus Prometheus is better for ops and alerts. Langfuse is better for cost and quality per trace, once you tell it your model's price and send scores through its API. The Collector makes running both cheap: it's one extra exporter.

## The setup

![The crypto-desk replay sends 1,000 runs over OTLP to a gateway Collector. The Collector redacts, counts every span with spanmetrics, then splits: a tail-sampled copy (errors, slow, expensive, bad answers and a 10 percent baseline) goes to Tempo in the grafana/otel-lgtm container, where Prometheus also stores the token metrics labelled by turn reason. An unsampled copy goes to a self-hosted Langfuse. A separate evaluator job posts one answer_check score per trace to Langfuse's REST API.](/assets/images/otel-traces-answers-setup.svg)

**The traffic.** Same approach as part three: a replay of 1,000 runs shaped like crypto-desk, with Sonnet 5.5 token counts and its $2 / $10 per million list price. Three question types: a single price (35%), converting one coin into another (40%) and valuing a portfolio of three to five coins (25%). The failure mix is the same too: rate-limited price lookups with one retry, occasional 10-second timeouts, and about 3% of runs stuck re-checking prices until the eight-turn cap.

**One new attribute per model call: why it happened.** Every `chat` span gets `crypto_desk.turn.reason`:

| reason | the model call happened because… |
|---|---|
| `plan` | it's the first call of the run |
| `continue` | the previous tools succeeded and there's more to do (or it's time to answer) |
| `after_error` | a tool in the previous turn failed |
| `recheck` | the previous turn only re-fetched a price the agent already had |

The agent loop knows this when it makes the call, so it's one line of code. Without it, every model call is just `chat claude-sonnet-5-5`, and "where did the money go" has no answer.

**One new signal per run: was the answer right.** I used a deterministic check against the known right answer, not an LLM judge. It's free, it doesn't drift, and it can run inside the agent before the root span ends. That matters, because then the result can go on the root span as attributes (`crypto_desk.eval.score`, `crypto_desk.eval.label`) and as a `gen_ai.evaluation.result` span event. Each run ends up `correct`, `wrong` (a stale remembered price, or maths done without the calculator), `declined` (the agent said it couldn't get a price) or `no_answer` (it hit the turn cap).

One caveat up front. In a replay, the quality outcome comes from the failure mechanisms I modelled, not from a real model getting things wrong. I never set quality directly. A run is wrong only if it played out in a way that produces a wrong answer, such as falling back to a remembered price that has since moved. But the cost-against-quality relationship below shows what *this* failure mix produces, not a law about agents. The method carries over. The exact numbers won't.

**The backends.** The same gateway Collector as part three (contrib 0.140.1), with its traces split two ways:

```yaml
connectors:
  spanmetrics: { namespace: gateway }
  forward/sampled:
  forward/all:

exporters:
  otlphttp/lgtm:     { endpoint: http://otel4-lgtm:4318 }
  otlphttp/langfuse:
    endpoint: http://langfuse-web:3000/api/public/otel
    headers: { Authorization: "Basic ${env:LANGFUSE_AUTH}" }   # base64 of public:secret key

service:
  pipelines:
    traces/in:       { receivers: [otlp],            processors: [transform/redact],     exporters: [spanmetrics, forward/sampled, forward/all] }
    traces/tempo:    { receivers: [forward/sampled], processors: [tail_sampling, batch], exporters: [otlphttp/lgtm] }
    traces/langfuse: { receivers: [forward/all],     processors: [batch],                exporters: [otlphttp/langfuse] }
```

Tempo gets the tail-sampled copy. Langfuse gets everything, because it's where per-trace cost and quality questions get answered, and those need every run. That's a choice, not a default. With Langfuse Cloud you pay per event, so you might sample there too, and then everything in section 3 applies to it as well.

Langfuse is self-hosted from its official compose file: web, worker, Postgres, ClickHouse, Redis and MinIO. That's six containers, compared with one for `grafana/otel-lgtm`. Fine on a laptop, but worth knowing before you put it in production.

## 1. Where the cost actually goes

The 1,000 runs cost **$9.98** in total: a median of 0.80¢ a run and a mean of 1.00¢. That's in line with the 0.70¢ clean run in the walkthrough.

![Share of model-call spend by turn reason. Ground truth, the Prometheus token metric and Langfuse filtered by attribute all agree: continue 53 percent, plan 21 percent, recheck 14 percent, after_error 11 percent, so a quarter of spend is waste, 9.98 dollars in total. TraceQL over the 345 tail-sampled runs in Tempo says continue 40, plan 16, recheck 22, after_error 22, putting waste at 44 percent.](/assets/images/otel-cost-by-step.svg)

**About 26% of spend was waste.** `recheck` took 14% and `after_error` 11%. Those calls exist only because something went wrong or the agent was unsure. Breaking down by kind of run:

- The **30 looping runs** (3%) cost 4.18¢ each, five times the median, and took **12.6% of all spend**. Only 37% of them answered correctly: the price questions eventually answered, but any question that still needed the calculator hit the cap first.
- The **95 runs with a single redundant re-check** cost 1.17¢ against 0.80¢, and their answers were no better (92% correct, against 89% overall).
- **Retries are cheap per call but expensive per run.** Each model call re-sends the whole conversation, failed tool results included, so the call after an error is the most expensive one so far. That's the same pattern the walkthrough saw with one rate-limited run.

**Three places gave the same correct answer**, and one gave a wrong one.

The **Prometheus metric** was the easiest. The agent already records `gen_ai.client.token.usage` (from the walkthrough), so I added `crypto_desk.turn.reason` as a metric attribute. The cost split is then one query:

```promql
sum by (crypto_desk_turn_reason) (gen_ai_client_token_usage_sum{gen_ai_token_type="input"})  * 2e-6
+ sum by (crypto_desk_turn_reason) (gen_ai_client_token_usage_sum{gen_ai_token_type="output"}) * 10e-6
```

It came to $9.976, identical to the ground truth, because metrics are recorded before any sampling.

**Langfuse** turned the OpenTelemetry spans into its own model without any help. The root span became an `AGENT` observation, `chat` spans became `GENERATION`s with token usage, and tool spans became `TOOL`s. But the first thing I saw was **no cost at all**. Langfuse works out cost from its own model price table, and in 4.80.0 that table had nothing newer than Claude 3.5. A model it doesn't know gets tokens and no cost, and nothing warns you. One API call fixes it:

```python
post("/api/public/models", {"modelName": "claude-sonnet-5-5",
     "matchPattern": "(?i)^(claude-sonnet-5-5)$", "unit": "TOKENS",
     "inputPrice": 2e-6, "outputPrice": 10e-6})
```

I added the price before sending the real run, and didn't test whether it applies to traces already stored. After that, Langfuse's total was $9.9757. The other catch is that its metrics API **can't group by your own attributes**. Grouping only works on fixed fields (name, type, tags, environment and so on). It can *filter* on them, though, with an `attributes.` prefix on the metadata key. So the cost split took four queries, one per reason, and they matched the ground truth exactly. If you want to group by step in Langfuse, put the step somewhere it can group on, like a tag.

**Tempo** answers with TraceQL metrics:

```
{ span.gen_ai.operation.name = "chat" }
  | sum_over_time(span.gen_ai.usage.input_tokens) by (span.crypto_desk.turn.reason)
```

The query works. The answer is wrong, and the next section explains why.

## 2. Cost against quality

Overall, 887 of the 1,000 answers were correct, 67 wrong, 29 declined and 17 hit the turn cap.

![Correct-answer rate by cost quintile of 200 runs each. All 1,000 runs: 96, 92, 92, 85 and 79 percent from cheapest to most expensive. The 345 runs Tempo kept after tail sampling: 86, 75, 77, 77 and 62 percent. Within a single question type the gap almost disappears: price questions 98 percent correct in the cheaper half and 96 in the dearer half, conversions 87 and 84, portfolios 82 and 82.](/assets/images/otel-cost-vs-quality.svg)

On the full data, the answer to "do expensive runs give better answers" is **no, they're worse**. The cheapest fifth was 96% correct and the most expensive fifth 79%. Runs that failed cost 1.71¢ on average, against 0.91¢ for correct ones.

It's tempting to stop there and say "expensive means broken". But split by question type and most of the slope goes away:

| question | runs | mean cost | correct | cheaper half | dearer half |
|---|---|---|---|---|---|
| price | 354 | 0.56¢ | 97% | 98% | 96% |
| convert | 391 | 0.97¢ | 85% | 87% | 84% |
| portfolio | 255 | 1.64¢ | 82% | 82% | 82% |

Hard questions cost more *and* go wrong more often. That's a confounder, not a cause. What's left after you account for it is the useful part: **within a question type, spending more didn't buy any accuracy**. The extra spend was retries and loops, and it bought nothing. The wrong answers didn't come from spending too little either. They came from two specific behaviours: answering from a remembered price after a tool failed (28 wrong answers), and doing maths without the calculator (25).

So the plot is useful, but only once each run carries something that says what kind of question it was. I had `crypto_desk.question.kind` on the root span, and without it I'd have drawn the wrong conclusion.

## 3. Sampling distorts both answers, and drops the quiet failures

Part three showed that error *rates* computed after sampling are wrong. The same is true of cost and quality, and in the same direction.

Tempo kept 345 of the 1,000 runs: all 267 runs with an error span, plus the 10% baseline. On those 345:

- **Waste looked like 44%** of spend instead of 26%, and mean cost 1.46¢ instead of 1.00¢.
- **The correct-answer rate looked like 75%** instead of 89%, with every quintile 8–17 points too low.

Nothing is broken here. The sampler keeps errors by design, so anything computed from what it kept leans towards errors. For cost and quality numbers, use the unsampled metric, or a backend that receives every trace.

What surprised me more was **which runs went missing**:

| label | runs | kept by Tempo | with a `bad_answer` policy |
|---|---|---|---|
| wrong, with an error span | 32 | 32 | 32 |
| wrong, **no error span** | 35 | **7** | **35** |
| declined | 29 | 29 | 29 |
| no answer (turn cap) | 17 | 17 | 17 |
| correct | 887 | 260 | 259 |

Most wrong answers don't look like failures. In 35 runs every tool succeeded, the status was OK, the cost was normal, and the answer was still wrong, usually because the agent did the maths without the calculator. None of the sampling policies looked at quality, so those runs were kept only if they hit the 10% baseline. **Tempo kept 7 of 35.** These are exactly the traces you'd want when someone asks "why did it say that?". It's the [cognitive surrender](/notes/2026-11-06-cognitive-surrender) problem in another place: an answer that looks fine gets no attention.

Because the check runs before the root span ends, the score is already on the root span when the sampler decides. So the fix is one more policy:

```yaml
- { name: bad_answer, type: string_attribute,
    string_attribute: { key: crypto_desk.eval.label, values: [wrong, declined, no_answer] } }
```

Replaying the same 1,000 runs with that policy, Tempo kept **all 67 wrong answers**. That cost 27 more stored traces (372 instead of 345).

Two gotchas on the way:

- **My first attempt killed the gateway.** I wrote it as `numeric_attribute` on the score with `min_value: 0, max_value: 0`. The Collector treats zero as "not set", logs `At least one of minValue or maxValue must be set`, and then **panics on startup**. It took the Langfuse pipeline down with it. Match on the label string instead.
- **TraceQL types matter.** `{ span.crypto_desk.eval.score = 0 }` returned nothing, because the attribute is a float. `= 0.0` returned 85 traces. TraceQL can also query the span event directly, so `{ event.gen_ai.evaluation.score.label = "wrong" }` works.

This only works because the check is cheap and runs inside the agent. An LLM judge running minutes later can't help the sampler: by the time the score exists, the decision has already been made. If you rely on a judge, either keep everything in the backend that stores scores, or make the in-process check good enough to flag likely problems.

**Finding bad runs without reading 1,000 traces.** Cost isn't a good filter for quality. 33 runs cost more than three times the median, and 20 of them failed. But there were 113 failed runs in total, so a cost filter finds fewer than one in five. The score filter finds all of them, so put it first:

```
{ span.crypto_desk.eval.label != "correct" }                                   # 113: every failed run, with bad_answer on
{ span.crypto_desk.eval.label = "wrong" && span.crypto_desk.run.turns >= 4 }   # 25: wrong even after retries
```

## 4. Tempo against Langfuse, for these questions

| question | Tempo + Prometheus | Langfuse |
|---|---|---|
| Cost per step | Prometheus: one PromQL query over a metric you record yourself. TraceQL works, but on sampled data. | Built in once the model price is registered. Filter by your own attribute; grouping only works on fixed fields. |
| Model prices | Your query does the arithmetic. | Its price table. A new model gets tokens but **no cost, with no warning**. |
| Quality scores | Span attributes and events you set yourself; queryable and usable for sampling. | First-class scores with averages and charts, but sent through its **REST API**. The `gen_ai.evaluation.result` span event did not become a score. |
| Reading one run | Waterfall of spans and raw attributes. | Agent, generation and tool view, with prompts and outputs readable as messages. |
| Alerts, retention, the rest of your services | Strong: same stack as everything else. | Not what it's for. |
| Running it yourself | 1 container (`otel-lgtm`) for a laptop. | 6 containers. |

One API detail cost me a few minutes: Langfuse 4.x self-hosted runs in an "events only" mode where the old `GET /api/public/traces`, `/observations` and `/scores` return 404 with a message pointing you to the v2 endpoints. `POST /api/public/scores` still works for writing scores.

My conclusion is **use both, for different questions**. Tempo and Prometheus for "is it up, is it slow, is it erroring": sampled traces with unsampled metrics, as part three set up. Langfuse for "what did this cost and was it any good": every trace, with scores attached. The Collector makes that one extra exporter. And the two most important attributes in this note, `turn.reason` and `eval.label`, live in the telemetry itself, so they work in both backends.

## What I'd check before relying on this

- **Tag every model call with why it happened.** Span names can't tell a planning call from a retry. Add one attribute in the agent loop, on both the span and the token metric.
- **Tag every run with what kind of question it was.** Without it, cost against quality mostly measures how hard the questions were.
- **Get cost and quality numbers from unsampled data.** That means metrics, or a backend that gets every trace. Sampled traces are for reading individual runs.
- **Sample on quality, not just errors.** Most wrong answers have no error span. If the score exists before the root span ends, a `string_attribute` policy keeps them.
- **Register your model price in Langfuse before sending data,** and check the first trace shows a cost.
- **Score through each backend's own path.** A span event works in Tempo; Langfuse wants its scores API.
- **Remember that the evaluator is part of the system.** A deterministic check is free and stable. An LLM judge needs tracing, a cost line and drift checks of its own, and it arrives too late to help sampling.
- **Redact before the fork.** Langfuse shows prompts and outputs as readable messages, which is great for debugging and bad for leaks. Part three's redaction runs before the traces split, so both backends get the redacted version.

## Closing thought

Parts one to three were about getting telemetry right. This one was about getting answers out of it, and the answers depended less on the backend than on two attributes I had to add myself: why each call happened, and whether the run was right. Without those, the best backend in the world shows you a pile of spans. With them, even a plain PromQL query tells you a quarter of your spend buys nothing.

The other lesson repeats part three: sampling is fine for reading traces and wrong for computing numbers. This time it was quality numbers, and the runs it dropped were the quiet failures, which are the ones that most need a human to look.

## Sources

- Earlier in this series: [What is OpenTelemetry](/notes/2026-11-10-what-is-opentelemetry), [Tracing one agent run end to end](/notes/2026-11-12-tracing-one-agent-run-opentelemetry), [Redact, count, then sample](/notes/2026-11-14-otel-collector-redact-sample-count)
- OpenTelemetry [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) (spans, metrics and the `gen_ai.evaluation.result` event)
- OpenTelemetry Collector contrib: [tail sampling processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor), [forward connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/forwardconnector)
- Grafana [Tempo TraceQL metrics queries](https://grafana.com/docs/tempo/latest/traceql/metrics-queries/) and [docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- [Langfuse docs](https://langfuse.com/docs): OpenTelemetry ingestion, custom model prices, scores API and self-hosting with Docker Compose
- Related: [Evaluate transitions, not final answers](/notes/2026-08-03-evaluate-transitions-not-final-answers), [Cognitive surrender](/notes/2026-11-06-cognitive-surrender)
