---
title: "Tracing one agent run end to end with OpenTelemetry"
date: 2026-11-12
tags: [opentelemetry, observability, ai-agents, llm-ops, tracing, grafana, claude-api]
summary: "A hands-on follow-up to the OpenTelemetry explainer. I built a small crypto agent on the Claude API, sent its telemetry to a local Grafana stack, and ran it until something broke. The Anthropic Python SDK now emits its own spans, so adding a third-party instrumentor doubled every model call. About twenty lines of manual spans turned scattered spans into one trace per run. The traces then showed things the final answer hides: a rate-limited tool made the failed run the most expensive one, the agent ignored a 'one at a time' instruction, and the same failure cost different amounts on different runs. Every number in this note comes from real spans."
---

In [What is OpenTelemetry, and why does it keep showing up in AI?](/notes/2026-11-10-what-is-opentelemetry) I said that "one agent run maps neatly onto one trace", and showed a trace picture to prove it. That picture was made up to explain the idea. This note does it for real: a small agent, a local telemetry stack, a few runs, and a look at what the traces actually say.

Short version:

1. **The Anthropic Python SDK traces itself now.** Register a tracer provider and every model call becomes a span with `gen_ai.*` attributes. I didn't expect that, and adding a third-party instrumentor on top doubled every span.
2. **Automatic spans are not a trace.** Out of the box, each model call is its own trace. You need a parent span for the agent run, and spans for your own tools, to get one connected trace per run. That takes about twenty lines.
3. **The traces were worth it straight away.** A free-tier API rate-limited my tool, and the run that failed cost more than the run that succeeded. The agent also ignored part of my instructions, and the trace showed it plainly.
4. **Spans are not metrics.** Tokens and cost need a metric. The SDK doesn't emit one, so I recorded the spec's two GenAI histograms myself.

All numbers below come from real runs on 12 November 2026, with spans saved to a local file so I could check them.

## The setup

![The setup: a Python agent called crypto-desk with three telemetry sources (the Anthropic SDK's built-in spans, about twenty lines of manual spans and metrics, and an optional third-party instrumentor that duplicates the SDK). It calls the Claude API and CoinGecko, and sends telemetry over OTLP/HTTP on port 4318 to one grafana/otel-lgtm container, where a Collector routes traces to Tempo and metrics to Prometheus, both read by Grafana.](/assets/images/otel-walkthrough-setup.svg)

**The agent.** About 200 lines of Python. It runs a plain tool-use loop on Claude Sonnet 5.5 with two tools:

- `get_price`: spot price and 24-hour change for a coin from CoinGecko's free API;
- `calculate`: plain arithmetic.

It loops until the model stops asking for tools, with a cap of eight turns. The system prompt is one line: be concise, use tools for prices and maths, and "if a tool fails, retry once". There's a `--flaky` flag that makes the first `get_price` call hang for three seconds and then fail, so I could see a timeout on purpose.

**The backend.** One container, [`grafana/otel-lgtm`](https://github.com/grafana/docker-otel-lgtm) (version 0.40.0 here). It bundles an OpenTelemetry Collector, Tempo for traces, Prometheus for metrics, Loki for logs and Grafana in front:

```bash
docker run -d --name otel-lgtm -p 3300:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
```

(I mapped Grafana to 3300 because something else already had 3000.) No account and no API keys apart from Anthropic's. The OpenTelemetry Python SDK sends OTLP to `localhost:4318` by default, so the exporter needs no configuration.

**The versions** that matter, because a lot of this is moving: `anthropic` 2.8.0, `opentelemetry-sdk` 1.45.2, `opentelemetry-instrumentation-anthropic` 0.63.0.

## Pass 1: just switch it on

The plan for pass 1 was "zero code": register a tracer provider, add the community Anthropic instrumentor, ask one question and see what turns up.

```python
provider = TracerProvider(resource=Resource.create({"service.name": "crypto-desk"}))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
trace.set_tracer_provider(provider)
AnthropicInstrumentor().instrument()   # opentelemetry-instrumentation-anthropic
```

The question was *"What is the price of bitcoin and ethereum right now, and how many ETH buys one BTC?"* The agent made three model calls (prices, then the calculator, then the answer) and gave a correct answer: about 36 ETH per BTC.

Here is what landed in Tempo:

![Grafana's Tempo search for the pass-1 time window: six separate traces, all from crypto-desk. They come in pairs with the same start times and durations: anthropic.messages.create and anthropic.chat at 20:23:28.714 (1.70s), at 20:23:30.80 (1.08s) and at 20:23:31.88 (1.26s).](/assets/images/otel-walkthrough-pass1-split-traces.png)

Three model calls, **six traces**. Two problems at once.

**Every model call shows up twice.** One span is called `anthropic.messages.create`, and the other, with the same timing, is called `anthropic.chat`. The second comes from the instrumentor. The first comes from **the Anthropic SDK itself**. Recent versions of the Python SDK have built-in OpenTelemetry tracing (still marked beta). When a tracer provider is registered, every `messages.create` call becomes a span carrying `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, input, output and cache token counts, the request id and HTTP details. You don't need an instrumentor for that any more. If you add one anyway, every dashboard that sums tokens over spans counts every call twice.

**Nothing is connected.** Each model call is its own trace with no parent. The tool calls, which take real time and can fail, don't appear at all, because nothing creates spans for them. The OpenTelemetry explainer promised one tree per run. Out of the box you get a scatter of unrelated calls.

Two smaller things showed up in the span attributes:

- **Neither span name follows the GenAI convention.** The spec says `chat {model}`. The SDK uses `anthropic.messages.create` and the instrumentor uses `anthropic.chat`. Both do set `gen_ai.operation.name = chat`, so **query by attribute, not by span name**.
- **Prompts were recorded without me asking.** The instrumentor's spans contained the full system prompt, the user's question, the tool definitions and the model's output. That's because its content switch, `TRACELOOP_TRACE_CONTENT`, defaults to `true`. The SDK's own spans default to metadata only. If you're tracing anything with customer data in it, check this before you ship.

So I dropped the instrumentor and kept the SDK's spans.

## Pass 2: twenty lines to get one trace per run

The missing pieces are the parent span (the agent run) and the child spans (the tools). That's what the GenAI conventions call `invoke_agent` and `execute_tool`:

```python
with tracer.start_as_current_span("invoke_agent crypto-desk") as span:
    span.set_attribute("gen_ai.operation.name", "invoke_agent")
    span.set_attribute("gen_ai.agent.name", "crypto-desk")
    span.set_attribute("gen_ai.conversation.id", conversation_id)
    answer, totals = agent_loop(question)
    span.set_attribute("gen_ai.usage.input_tokens", totals["input"])
    span.set_attribute("gen_ai.usage.output_tokens", totals["output"])

def run_tool(name, args, call_id):
    with tracer.start_as_current_span(f"execute_tool {name}") as span:
        span.set_attribute("gen_ai.operation.name", "execute_tool")
        span.set_attribute("gen_ai.tool.name", name)
        span.set_attribute("gen_ai.tool.call.id", call_id)
        try:
            return TOOLS[name](**args)
        except Exception as e:
            span.set_attribute("error.type", type(e).__name__)
            span.set_status(Status(StatusCode.ERROR, str(e)))
            raise
```

Nothing else changes. The SDK's model-call spans pick up the current span as their parent automatically, because that's how OpenTelemetry context works. The same clean question now gives **one trace with seven spans**: `invoke_agent` at the top, then model call, two `get_price` calls, model call, `calculate`, model call. That's exactly the tree from the explainer.

I'd also put the run's token totals on the parent span. It means "show me every expensive run" is a single query on one span, without adding up children:

```
{ span.gen_ai.operation.name = "invoke_agent" && span.gen_ai.usage.input_tokens > 5000 }
```

One gotcha in the SDK's configuration: it reads `ANTHROPIC_OPEN_TELEMETRY*` environment variables (for example, to switch on content capture), but **only if you pass no `open_telemetry` option to the client at all**. I passed one to set a conversation id, and from then on the content environment variable was silently ignored. Set everything in code, or everything in the environment.

## What the traces showed

With the tree in place, I ran the agent a handful of times. Three runs told me something I wouldn't have known from the answers alone.

### A tool timeout

With `--flaky`, the first `get_price` call hangs for three seconds and raises `TimeoutError`:

![Grafana trace view of the timeout run: invoke_agent crypto-desk takes 8 seconds and has 9 spans. Grafana's header highlights execute_tool get_price as the slowest error span at 3.01s, 37.7% of the trace. The waterfall shows a model call (1.47s), the failed get_price (3.01s), a successful get_price (65.62ms), a model call (1.11s), another get_price (133.29ms), a model call (983.47ms), calculate (52µs) and a final model call (1.18s).](/assets/images/otel-walkthrough-trace-timeout.png)

The trace reads like a story. The model asked for both prices in the same turn. Bitcoin's call failed after three seconds, then Ethereum's succeeded. The next model call retried bitcoin, as the system prompt says. The run took **8.0 seconds instead of 4.1**, and **one extra turn**. Grafana flags the failed span as 37.7% of the trace, so "where did the time go" doesn't need any analysis.

### A rate-limited tool, and the most expensive failure

This one wasn't planned. I asked a bigger question, *"I hold 0.5 BTC, 3 ETH, 40 SOL and 2000 XRP. Look up each price one at a time, then value each position…"*, right after a dozen quick test calls. CoinGecko's free tier had had enough:

![Grafana trace view of the rate-limited run: invoke_agent takes 12.34 seconds with 15 spans. After the first model call (3s), four execute_tool get_price spans fail back to back within about 0.3 seconds. Then the pattern repeats: a model call followed by a single failed get_price, four more times, ending with a final model call (2.45s). All eight get_price spans are marked as errors.](/assets/images/otel-walkthrough-trace-rate-limited.png)

All eight `get_price` calls failed with `429 Too Many Requests`. The error message is right there on the span status. The agent followed the "retry once" rule exactly, but it retried **one coin per turn**, so four failed lookups turned into four extra model calls. Each of those calls re-sends the whole conversation, including every error so far, so input tokens rose on every turn:

![Left: cost per run in US cents at Sonnet 5.5 list price. Clean question 0.70¢ (3 turns, 4.1s). Injected tool timeout 0.95¢ (4 turns, 8.0s). Portfolio question while rate-limited 3.11¢ (6 turns, 12.3s, no answer). Same portfolio question after the rate limit cleared 2.57¢ (5 turns, 10.7s, full answer). Right: input tokens per model call for the two portfolio runs; the rate-limited run climbs from 608 to 2,387 over six calls, the successful run from 608 to 2,049 over five.](/assets/images/otel-walkthrough-run-costs.svg)

**The run that produced nothing cost 3.11¢. The run that produced a full answer cost 2.57¢.** Cents, because it's a toy. Scale it to thousands of runs a day against a flaky dependency and this is a line on the bill that nobody can explain without traces.

Two more things from the same failure:

- **The same failure doesn't cost the same twice.** I ran the identical question again while still rate-limited. This time the agent retried all four coins in a single turn, gave up after three turns and cost 1.93¢. Same input and same failure, but half the turns. That's the non-determinism the explainer talked about, and a good reason to look at distributions of cost per run, not single runs.
- **The trace doesn't tell you what the user saw.** With content capture off, I knew the tool failed eight times, but not whether the agent made up prices to fill the gap. I switched content capture on for the rerun: the spans then held `gen_ai.input.messages`, `gen_ai.output.messages` and `gen_ai.system_instructions`, and the answer was honest: "I couldn't get any prices… I haven't estimated any numbers." That's the trade-off from the explainer's caveats, made concrete. Metadata tells you *that* something went wrong. Only content tells you whether the answer was still good, and content is the part you have to protect.

### The agent didn't do what I asked

After a cooldown, the same portfolio question succeeded:

![Grafana trace view of the successful portfolio run: invoke_agent takes 10.7 seconds with 19 spans. After the first model call, four execute_tool get_price spans run back to back within about 0.4 seconds. After the next model call, four calculate spans run almost instantly, then one more calculate, then four more, with a model call between each group.](/assets/images/otel-walkthrough-trace-parallel-tools.png)

I asked it to "look up each price one at a time". The trace shows the model asking for **all four prices in its first turn**: four `get_price` spans, back to back, within 0.4 seconds. (My loop runs tool calls one after another; the model asked for them all at once.) Batching is the sensible thing to do here, and the final answer even owned up to it ("I fetched all four prices in one batch rather than one at a time"). But if "one at a time" had been a real constraint, such as a rate limit you're trying to respect, this is exactly the sort of quiet deviation you'd want to catch. A final-answer check wouldn't catch it. The trace does, which is why [evaluating transitions, not final answers](/notes/2026-08-03-evaluate-transitions-not-final-answers) works so well on top of tracing.

## From spans to metrics

Traces are for looking at one run. For "how much did we spend this week" and "alert when tool errors pass 10%", you want metrics.

The LGTM stack gives you some for free: Tempo's metrics generator turns spans into `traces_spanmetrics_calls_total` and latency histograms, labelled by span name and status. That's enough for a tool error rate:

```promql
sum by (span_name) (traces_spanmetrics_calls_total{service="crypto-desk", status_code="STATUS_CODE_ERROR"})
  / sum by (span_name) (traces_spanmetrics_calls_total{service="crypto-desk"})
```

For my session that came out at 0.56 for `execute_tool get_price`, which is CoinGecko's free tier telling me something.

**Tokens don't become metrics on their own**, though, and the SDK only emits spans. So I recorded the two histograms the GenAI conventions define, `gen_ai.client.token.usage` (with a `gen_ai.token.type` of `input` or `output`) and `gen_ai.client.operation.duration`, after each model call. That's another dozen lines with the OpenTelemetry metrics API. In Prometheus they show up as `gen_ai_client_token_usage_*` and `gen_ai_client_operation_duration_seconds_*`: dots become underscores, and the duration gets its unit as a suffix.

Over six paced runs the metric totals came out at 15,440 input and 1,876 output tokens. That matches the sums from the spans exactly, which is the check worth doing before you trust a cost panel. Cost is then plain arithmetic in PromQL:

```promql
sum(max_over_time(gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[1h]))  * 2e-6
+ sum(max_over_time(gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[1h])) * 10e-6
```

That's $0.0496 for the six runs, or about 0.8¢ per question. Two things about that query are worth knowing:

- **Short-lived processes go stale.** My agent is a script that exits after each question. Prometheus treats a series as gone five minutes after its last sample, so a plain `sum(...)` returned nothing once the runs were over. `max_over_time` over a window fixes that.
- **Every process run is its own series.** The OpenTelemetry SDK gives each process a random `service.instance.id`, which becomes an `instance` label. That's what makes the query above correct, since it adds up one series per run. But it also means a script-style agent run a thousand times a day creates a thousand series a day. For real volume, run the agent as a long-lived service, or drop that label in the Collector.

## What I'd tell myself before starting

- **Check whether your LLM SDK already traces itself** before adding an instrumentor. Anthropic's Python SDK does, and other provider SDKs are moving the same way. Two instrumentations of one call means double-counted tokens.
- **Write the agent and tool spans yourself.** They're the part no library can guess, and they're what turn spans into a trace.
- **Query by `gen_ai.*` attributes, not span names.** The names aren't consistent across libraries yet.
- **Decide on content capture deliberately.** The defaults differed between the two libraries I tried, in opposite directions.
- **Put run totals on the root span.** It makes "expensive runs" and "runs with errors" one-line queries.
- **Reconcile metrics against spans once** before building a cost dashboard on them.

There's one thing I didn't try. Anthropic also offers server-side "API tracing": an org admin adds an OTLP destination, and the API sends its own spans for each request there, which join your traces through the `traceparent` header the SDK already sends. That needs org-admin access and an HTTPS endpoint, so it's a note for another day.

## Closing thought

The explainer argued that agents need ordinary, boring telemetry. Doing it for real mostly confirmed that, with a twist: the boring part was easy. Twenty lines of spans and one container gave me a proper trace per run within an hour. The interesting part was how fast the traces showed things I'd have missed: a failed run costing more than a good one, the same failure costing different amounts on different days, and an agent politely ignoring an instruction. None of that shows up in the final answer. All of it was obvious in the waterfall.

## Sources

- Anthropic, [OpenTelemetry for the Claude API](https://platform.claude.com/docs/en/manage-claude/opentelemetry), with the [SDK tracing](https://platform.claude.com/docs/en/manage-claude/opentelemetry/sdk) and [API tracing](https://platform.claude.com/docs/en/manage-claude/opentelemetry/api) pages (beta)
- OpenTelemetry, [Semantic conventions for generative AI systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/): spans (`invoke_agent`, `execute_tool`, `chat`) and metrics (`gen_ai.client.token.usage`, `gen_ai.client.operation.duration`)
- OpenTelemetry, [Python instrumentation](https://opentelemetry.io/docs/languages/python/)
- Grafana, [docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- Grafana, [Tempo metrics generator](https://grafana.com/docs/tempo/latest/metrics-generator/) and [TraceQL](https://grafana.com/docs/tempo/latest/traceql/)
- Traceloop, [OpenLLMetry](https://github.com/traceloop/openllmetry) (source of `opentelemetry-instrumentation-anthropic`)
- CoinGecko, [Errors and rate limits](https://docs.coingecko.com/docs/errors-and-rate-limits)
- Previous notes: [What is OpenTelemetry?](/notes/2026-11-10-what-is-opentelemetry), [Evaluate transitions, not final answers](/notes/2026-08-03-evaluate-transitions-not-final-answers), [AI agents need budgets](/notes/2026-09-05-ai-agents-need-budgets)
