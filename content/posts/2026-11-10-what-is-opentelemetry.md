---
title: "What is OpenTelemetry, and why does it keep showing up in AI?"
date: 2026-11-10
tags: [opentelemetry, observability, ai-agents, llm-ops, tracing, engineering-practice]
summary: "OpenTelemetry (OTel) is the vendor-neutral standard for producing and moving telemetry: traces, metrics, logs and, since this year, profiles. It is not a dashboard or a database. Its core pieces are the API, the SDK, instrumentation libraries, the OTLP protocol, the Collector and semantic conventions. It matters in AI because an agent run is a distributed system that makes decisions, and the GenAI semantic conventions give every framework and model provider one shared way to record model calls, tool calls, tokens and errors. So you instrument once and can see cost, latency, loops and failures in whatever backend you choose."
---

"OpenTelemetry" used to be a word only platform and SRE teams used. This year it is everywhere in AI. Agent frameworks list "OTel support" as a feature, LLM observability tools say they are "OTel-native", and every second agent architecture diagram has a box labelled *OTLP* in it. OpenTelemetry also [graduated in the CNCF](https://opentelemetry.io/blog/2026/otel-graduates/) in May 2026, which is the same status Kubernetes and Prometheus have.

I have touched pieces of it before, in the notes on [Grafana in agentic workflows](/notes/2026-05-22-grafana-in-agentic-workflows) and [run logs are data too](/notes/2026-07-22-run-logs-are-data-too), but never written down what it actually *is*. So this note is the plain version.

Short version:

1. **OpenTelemetry is a standard plus tooling for producing and moving telemetry.** It does not store or display anything.
2. **Its pillars are the signals**: traces, metrics and logs, with profiles as a new fourth. Shared context ties them together.
3. **Its components are** the API, the SDK, instrumentation libraries, the OTLP protocol, the Collector and semantic conventions.
4. **It matters in AI** because agent runs are multi-step, non-deterministic and expensive. The GenAI conventions give everyone one way to record model calls, tool calls and tokens.

## The simple version: tracking a parcel

If the terms above mean nothing yet, start here. In one sentence: **OpenTelemetry is an agreed way for software to report what it is doing, so that any tool can read the report.**

The easiest way to picture it is parcel tracking.

![A parcel with one tracking number travels from pick-up, to a sorting hub, to the airport, to a local courier, to the door. Each stop scans it: each scan is a span and the full scan history is a trace. A driver's note "delayed by weather" is a log. A chart of parcels per day is a metric. Without a shared standard, the local courier uses its own label and the trail goes cold. With OpenTelemetry, everyone scans the same label the same way and you get one unbroken history, viewable on any tracking website.](/assets/images/opentelemetry-parcel-analogy.svg)

When you send a parcel, it gets a **tracking number**. At every stop (pick-up, sorting hub, airport, local courier, your door) someone scans it, and the scan records where it was and when. Put all the scans together and you can see the full journey: where it is now, which stop was slow, and where it got stuck.

Now imagine every courier company used its own label and its own scanner. The moment your parcel is handed from one company to another, the trail goes cold. Each company has its own tracking website, and you cannot see the full journey anywhere.

Software has the same problem. One click in an app passes through many pieces of software, often written by different teams in different languages and watched by different tools. **OpenTelemetry is the shared label and the shared scanning rules.** Every piece of software stamps the same tracking number on the work and reports each step in the same format. You can then read the full history in whatever "tracking website" you prefer.

Every OpenTelemetry term has a parcel equivalent:

| Parcel world | OpenTelemetry term |
| --- | --- |
| Tracking number | **Trace id** |
| One scan at one stop ("hub, 11:20 to 13:40") | **Span** |
| The full scan history of one parcel | **Trace** |
| A driver's note: "delayed by weather" | **Log** |
| Monthly stats: parcels per day, average delivery time | **Metric** |
| The label format every company agreed on | **Specification and semantic conventions** |
| The handheld scanner at each stop | **SDK and instrumentation** |
| The standard way scanners send their data | **OTLP** (the protocol) |
| The regional office that collects all scans, tidies them and forwards them | **Collector** |
| The tracking website you look at | **Backend** (Grafana, Datadog, Langfuse …), which is *not* part of OpenTelemetry |

**And for AI?** Your question to an AI agent is the parcel. The model calls and tool calls are the stops. Two things make it trickier than a real parcel. First, **the agent picks its own route**, so it sometimes goes back to the same stop again and again. Second, **every stop charges a fee** (tokens). Without scans, all you see is whether the parcel arrived, and the bill. With OpenTelemetry, you see every stop, how long each took and what each cost.

That is the whole idea. The rest of this note is the same thing in proper terms.

## 1. What OpenTelemetry is (and is not)

**Telemetry** is the data a running system gives off about itself: how long things took, what failed, how much was used. **Observability** is being able to answer new questions about your system from that data, without shipping new code first.

**OpenTelemetry (OTel)** is an open-source project that standardises *how telemetry is produced and moved*. It came from merging two earlier projects, OpenTracing and OpenCensus, in 2019. In practice it gives you:

- a **specification**: what a span, a metric or a log record looks like;
- **libraries** in most languages (Python, JS/TS, Go, Java, .NET, Rust …) to create that data;
- a **wire protocol**, OTLP, to send it;
- a **Collector** to receive, process and forward it;
- **naming rules** (semantic conventions) so that "HTTP status code" or "input tokens" is called the same thing everywhere.

What it is **not**: a backend. There is no OpenTelemetry database or OpenTelemetry dashboard. You still pick Jaeger, Prometheus, Grafana, Datadog, Langfuse or whatever you like to store and look at the data. OTel is the part *in between*. That is the whole point: instrument your code once and keep the freedom to change where the data goes.

## 2. The core pillars: signals

![Three stable signals: traces show what happened step by step, metrics show how much and how often, logs show what was said. A fourth signal, profiles, has been in alpha since March 2026. A shared context bar underneath: every record carries the same trace id, span id and resource attributes. Semantic conventions give every signal the same attribute names, such as http, db and gen_ai.](/assets/images/opentelemetry-signals.svg)

OpenTelemetry calls each kind of telemetry a **signal**. The classic "three pillars of observability" are the first three.

**Traces: what happened, step by step?** A trace is the full path of one request through a system. It is made of **spans**. Each span is one unit of work (an HTTP call, a database query, a model call) with a start time, a duration, a status and attributes. Spans have parents, so a trace is a tree. In parcel terms, spans are the scans and the trace is the full scan history. For agents this is the most useful signal by far, because one agent run maps neatly onto one trace.

**Metrics: how much, how often?** Numbers aggregated over time: counters (requests served), gauges (queue depth now), histograms (latency distribution). Metrics are cheap to keep for months and are what you alert on.

**Logs: what was said?** Timestamped records, ideally structured. OTel did not invent logs. What it adds is a common log data model and, more importantly, stamping each log line with the trace and span it belongs to.

**Profiles: where did CPU and memory go?** Continuous profiling became the fourth signal and entered public alpha in March 2026. It is useful to know about, but not something to build production alerts on yet.

The part that makes these more than "three tools in a trench coat" is **context**:

- **Context propagation.** When service A calls service B, the trace id travels along (in HTTP headers, using the W3C `traceparent` format). So B's spans join A's trace, even across languages and machines. This is the tracking number surviving the handover from one courier to the next.
- **Resource.** Every record says *who* produced it: `service.name`, `service.version`, host, container, cloud region.
- **Correlation.** Because metrics, traces and logs share the same context, you can go from a latency spike on a dashboard, to an example trace from that minute, to the exact log line that failed.

And on top of the signals sit **semantic conventions**: agreed attribute names such as `http.response.status_code`, `db.system.name`, and, newest, `gen_ai.*`. They are boring, and they are what lets a dashboard built for one service work for every other service.

## 3. The core components

![On the left, your app holds instrumentation libraries, the API and the SDK. The SDK sends data over OTLP to the Collector in the middle, a pipeline of receivers, processors and exporters. Exporters fan out to any backend: tracing tools, metrics stores, log stores, all-in-one platforms and LLM observability tools. Change the backend by editing Collector config, not application code.](/assets/images/opentelemetry-components.svg)

| Component | What it does | Who touches it |
| --- | --- | --- |
| **API** | The small interface your code (and libraries) call: `start_span`, `counter.add`. Does nothing if no SDK is set up, so libraries can depend on it safely. | Library and app authors |
| **SDK** | The real implementation: sampling, batching, attaching the resource, and handing data to exporters. | Whoever runs the app |
| **Instrumentation libraries** | Ready-made spans and metrics for common things: HTTP servers and clients, databases, queues and, increasingly, LLM SDKs and agent frameworks. Can be *automatic* (zero-code agents or wrappers) or *manual* (you add spans for your own logic). | Mostly nobody, which is the point |
| **OTLP** | The OpenTelemetry Protocol. One wire format for all signals over gRPC or HTTP. Almost every backend accepts it now. | Nobody, it just works |
| **Collector** | A standalone process that **receives** telemetry, **processes** it (batch, filter, add or drop attributes, redact, sample) and **exports** it to one or more backends. Often runs as a sidecar or agent per host, plus a central gateway. | Platform / ops |
| **Semantic conventions** | The shared vocabulary for attribute and span names, per domain: HTTP, databases, messaging, cloud, GenAI. | Instrumentation authors, dashboard builders |

In parcel terms: instrumentation and the SDK are the scanners, OTLP is how scanners send their data, the Collector is the regional office that gathers and tidies the scans, and the backend is the tracking website.

Two things worth knowing about the Collector:

- It is **optional**. An SDK can export straight to a backend. But as soon as you want to redact data, sample, or send to two places, you want the Collector. It also keeps backend credentials out of your app.
- Its config *is* the routing. Switching from one vendor to another, or sending the same traces to both while you compare, is a YAML change.

## 4. Why it matters in AI

![Without a standard, each framework and vendor has its own SDK and format, so switching means re-instrumenting and agent traces are separate from the rest. With OpenTelemetry, agent frameworks, LLM clients and your services all emit OTLP with gen_ai attributes into one Collector and any backend. Six questions this answers: cost per run, where the time went, looping, which tool fails most, what changed after a model swap, and who did what for audit.](/assets/images/opentelemetry-why-ai.svg)

An agent run is a distributed system that also makes decisions. One user request can turn into several model calls, a handful of tool calls, a retrieval step, a sub-agent and a database write. Each step can be slow, can fail, costs money and, unlike normal code, can do something *different* next time with the same input. Without good telemetry the agent is a black box with a bill attached.

Before OpenTelemetry had anything to say about AI, every LLM observability tool and agent framework shipped its own tracing SDK and its own data format. Changing tools meant re-instrumenting. Worse, agent traces lived in a separate tool from the rest of the system, so you could not follow one request from the API gateway, through the agent, into the model and back out to the database.

The fix is the **GenAI semantic conventions**. They define:

- **Operations and span names**: `chat`, `text_completion`, `embeddings`, `create_agent`, `invoke_agent`, `execute_tool` and more. A span is named `{operation} {model or tool}`, e.g. `chat claude-sonnet-5-5` or `execute_tool refund_order`.
- **Attributes**: `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.tool.name`, `gen_ai.agent.name`, finish reasons, and `error.type` when something goes wrong.
- **Metrics**: token usage and operation duration as histograms, so cost and latency dashboards work across providers.
- **Content capture**: prompts, completions and tool arguments can be recorded, but only if you opt in.

Here is what one agent run looks like with all of that applied:

![A waterfall of one 9.4 second support-agent run: invoke_agent at the top, then a chat call, a search_orders tool call, a second chat call with more input tokens, a refund_order tool call that times out, a successful retry, and a final chat call. Below, the gen_ai attributes on the spans, and four readings: the refund tool timed out once, input tokens grow every turn, model calls take about 6.4 of the 9.4 seconds, and total cost is the sum of token usage.](/assets/images/opentelemetry-agent-trace.svg)

From one picture like this you can read off things that are otherwise guesswork:

- **Cost.** Add up token usage on the `chat` spans, then group by agent, user, feature or model. This is what [agent budgets](/notes/2026-09-05-ai-agents-need-budgets) need as input.
- **Latency.** Which step is slow: the model, a tool, or retrieval?
- **Loops and runaway runs.** Too many `chat` spans, or the same tool called over and over in one trace, is an obvious alarm. See [loop prevention](/notes/2026-07-03-scalable-agentic-systems-loop-prevention).
- **Context growth.** Input tokens rising every turn is the classic sign of a context window filling up.
- **Tool reliability.** Error rates per `gen_ai.tool.name` across all runs.
- **Change impact.** Compare traces before and after a prompt, model or tool change. Pairs well with [evaluating transitions, not final answers](/notes/2026-08-03-evaluate-transitions-not-final-answers): each transition is already a span.
- **Audit.** Who asked, which agent acted, which tool it called with what result, all in one connected record.

And because it is a standard, the same data works across frameworks and providers and lands next to your normal service traces. A model swap does not mean new dashboards. A vendor swap does not mean new instrumentation.

## 5. Caveats

**The GenAI conventions are still marked "Development".** That means not stable: names have already changed (for example `gen_ai.system` became `gen_ai.provider.name`, and agent spans were split up in 2026), and the whole set now lives in its own [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai) repository, with per-provider pages for Anthropic, OpenAI, Bedrock and others, plus MCP and A2A. Pin the conventions version your instrumentation uses and expect a rename or two.

**Prompts are sensitive data.** Prompts and tool arguments often contain customer data, secrets pasted by users, or internal documents. That is why content capture is opt-in. If you turn it on, redact in the Collector and give that data shorter retention than your normal traces.

**Volume and cost.** Agents produce lots of spans, and captured content makes them large. Head sampling (deciding at the start) can throw away exactly the rare failed run you wanted. Tail sampling in the Collector, keeping all errors and slow runs plus a share of the rest, is usually the better choice.

**Telemetry is not evaluation.** A trace tells you *what* the agent did, quickly and cheaply. It does not tell you whether the answer was *good*. You still need evals, ideally attached to the same trace id so you can join them later.

## 6. A minimal start

For a Python agent, the smallest useful setup is the SDK, an OTLP exporter and a few manual spans around your own tool calls. Most LLM client and agent framework instrumentations will then add the `chat` spans for you.

```python
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider(resource=Resource.create({"service.name": "support-agent"}))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))  # localhost:4318 by default
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("support-agent")

def run_refund(order_id: str):
    with tracer.start_as_current_span("execute_tool refund_order") as span:
        span.set_attribute("gen_ai.operation.name", "execute_tool")
        span.set_attribute("gen_ai.tool.name", "refund_order")
        return refund_order(order_id)
```

And a Collector that receives it and forwards it to one backend:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:
  batch:

exporters:
  otlphttp:
    endpoint: https://your-backend.example.com

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]
```

From there, the next steps are usually: add the LLM client instrumentation for your provider, add a redaction processor before turning on content capture, and add tail sampling once volume grows.

## Closing thought

OpenTelemetry is not new, and it is not specific to AI. It is the plumbing that the rest of software engineering already settled on. That is exactly why it matters now: agents are becoming ordinary production systems, and ordinary production systems need ordinary, boring, standard telemetry. The interesting bit is not the protocol. It is that "what did my agent actually do, and what did it cost?" finally has a standard answer.

## Sources

- OpenTelemetry, [What is OpenTelemetry?](https://opentelemetry.io/docs/what-is-opentelemetry/) and [Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/)
- OpenTelemetry, [Signals](https://opentelemetry.io/docs/concepts/signals/) and [Components](https://opentelemetry.io/docs/concepts/components/)
- OpenTelemetry, [Collector documentation](https://opentelemetry.io/docs/collector/)
- OpenTelemetry, [Semantic conventions for generative AI systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/) and the [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai) repository
- OpenTelemetry, [OpenTelemetry graduates in the CNCF](https://opentelemetry.io/blog/2026/otel-graduates/) and [OpenTelemetry has graduated… now what?](https://opentelemetry.io/blog/2026/otel-grad-now-what/) (2026)
- Greptime, [OpenTelemetry GenAI semantic conventions](https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions) (May 2026)
- TrueFoundry, [OpenTelemetry GenAI semantic conventions](https://www.truefoundry.com/blog/opentelemetry-genai-semantic-conventions)
