---
title: "Needle 2: A 14MB Model for Tool Calling and Structured Extraction"
date: 2026-08-25
tags: [ai, small-language-models, tool-calling, on-device-ai, structured-data]
summary: "Needle 2 is a 45M-parameter open model packaged as a 14MB inference engine for tool calling, device use, and structured extraction. This article explains its constrained design, realistic uses, and how to compare it fairly with FunctionGemma and LFM2.5-230M."
series: building-ai-systems
---

Most local-model discussions begin at a few billion parameters. That is already too large for a wearable, a small embedded computer, or an application that wants an always-on helper without treating memory as an afterthought.

[Needle 2](https://github.com/cactus-compute/needle) takes a much narrower path. It is an Apache-2.0 licensed, 45M-parameter model for tool calling, device use, and structured extraction. Cactus Compute packages the model and its runtime as a single 14MB binary and reports about 28MB of RAM for a full session. The model is not meant to be a chat companion, a coding agent, or a broad research assistant. It is meant to choose an action, fill a schema correctly, and know when to hand the work to something larger.

That constraint is its appeal. A tiny model cannot carry an entire agent stack by itself, but it can remove a surprising amount of glue code from a device workflow.

## What Needle is

Needle is a Python package with inference, LoRA fine-tuning, and export support. A developer declares Python functions, Pydantic models, or JSON schemas as tools. Needle receives text, decides whether to call a tool, produces structured arguments, runs the tool in its full-loop API, and can use the result in a later step.

```python
import needle

@needle.tool
def get_price_disagreement(symbol: str, run_id: str):
    "Return the two provider prices and their gap in basis points."
    return {
        "symbol": symbol,
        "run_id": run_id,
        "provider_a": 113_250.12,
        "provider_b": 113_271.00,
        "gap_bps": 1.84,
    }

agent = needle.Needle(tools=[get_price_disagreement])
result = agent.run("Check BTC/USDT disagreement for run 2026-08-25-0100")
print(result["results"])
```

The example looks like ordinary function calling, but Needle makes three product choices that matter at this size.

First, its decoder is constrained by a byte-level grammar compiled from the declared schemas. The model cannot freely emit a close-enough JSON shape and leave the application to repair it. Schema conformance is part of decoding.

Second, it has a learned confidence head. A caller can set a threshold and route low-confidence requests to a bigger model, a rule-based fallback, or a person. That is more useful than treating every tool call from a tiny model as equally trustworthy.

Third, it retrieves tools from a larger catalogue and exposes only the five highest-ranked choices on a turn. Fewer tool schemas mean less prompt pressure and a smaller grammar. This is a practical response to a common small-agent failure: a model picks a plausible but irrelevant tool because the catalogue is too large.

## Why the footprint is unusually small

Needle's 45M parameter count does not by itself explain its 14MB binary. The project says it uses Cactus Quants' CQ2-bit compression and ships the weights with its own engine. Two bits per parameter would be roughly 11.25MB before metadata and runtime concerns, so a 14MB binary is plausible as a packaged figure. It is very different from loading the same parameter count in fp16, which would require roughly 90MB just for the weights.

The reported 28MB session footprint includes more than weights. It must also hold the runtime, decode state, tool metadata, and attention cache. Needle limits the conversational window to 256 tokens and pins tools as KV sinks, keeping memory bounded as a session continues. This is a deliberate trade: it has a controlled amount of recent context, not an endless chat transcript.

The underlying Simple Attention Network uses a Hadamard MLP, grouped-query attention, an engram key-value memory, and multi-lane hyper-connections. Those details matter to model builders. Application developers should focus on the operational consequence: this is a specialised, tightly packaged inference path, not a general Hugging Face checkpoint to drop into every existing serving stack.

## The intended jobs

Needle is strongest when the output is an action or a typed record, and the surrounding system owns the knowledge and policy. Good candidates include:

- A smart-home controller that maps "dim the lights in the bedroom" to an allow-listed `set_lights(room, brightness)` call.
- A wearable that extracts intent from a short voice transcript and calls a phone-side action.
- An offline receipt or invoice parser that returns a validated `merchant`, `total`, and `due_date` record.
- A field-service app that turns a technician's short note into a structured maintenance event.
- A data-quality helper that chooses a documented check and returns its arguments, rather than generating arbitrary SQL.

The last case is a useful guardrail. An agent investigating a price discrepancy should call `get_price_disagreement(run_id)` or `get_provider_freshness(provider, window)`. It should not receive a general database shell and improvise against production tables. Needle's schema-constrained output works well when the tool contract is already narrow.

## A real workflow: triaging an exchange-price alert

Imagine a small process on a trading operations dashboard. Two providers report BTC/USDT prices that differ by more than 50 basis points. The alert contains a symbol, a run ID, and the current gap. A lightweight model needs to choose the next read-only action.

```text
alert text
  -> Needle selects one allow-listed tool
  -> tool reads the documented disagreement mart
  -> Needle returns a typed action or escalation reason
  -> policy engine either creates a ticket or asks a human to review
```

The catalogue might have tools for `get_price_disagreement`, `get_raw_response_status`, `get_provider_freshness`, and `open_incident`. Tool retrieval keeps the active choice set small. The confidence gate can require a high score before `open_incident` runs automatically. A low-confidence result can surface the same evidence to an operator.

Needle does not decide whether an incident policy is correct. It makes the input to that policy structured and cheap to run. That distinction keeps a tiny model in a role where it can be tested.

## Structured extraction is the other obvious fit

Extraction is implemented as a one-tool call. Give Needle a record schema as the only tool and pass it text. The constrained decoder can then emit one valid call of that record type or no call.

```python
from pydantic import BaseModel
import needle

class ProviderIncident(BaseModel):
    provider: str
    status_code: int
    affected_symbol: str | None = None
    retry_after_seconds: int | None = None

incident = needle.extract(
    "Coinbase returned HTTP 429 for BTC/USDT. Retry after 60 seconds.",
    ProviderIncident,
)
print(incident)
```

The application still needs validation beyond the schema. A string can satisfy a field type and still be semantically wrong. Check that the provider is in an allow-list, that a status code is valid, and that the resulting event has the expected lineage. Constrained decoding reduces one class of failure. It does not turn a language model into a source of ground truth.

## Comparing Needle with other light models

Needle's README places it beside FunctionGemma 270M, Liquid AI's LFM2.5-230M, and Apple Foundation Models. These are useful comparisons because they are intended for function calling, extraction, or on-device work. They are not interchangeable packages.

| Model | Published size and form | Primary orientation | Tool and structured-output approach | What to verify before adoption |
| --- | --- | --- | --- | --- |
| Needle 2 | 45M parameters; 14MB packaged engine; about 28MB session RAM reported | Tool calls, device actions, extraction | Grammar-constrained JSON, tool retrieval, confidence score, built-in Python loop | 256-token window, real tool-selection accuracy, confidence calibration on your data |
| FunctionGemma | 270M parameters | Function calling and mobile actions, with fine-tuning examples | Function-calling model in the Gemma ecosystem | Runtime size after your quantisation, mobile-action accuracy, integration with your serving stack |
| LFM2.5-230M | 230M parameters | Data extraction and lightweight edge agents | General instruct model with tool-call parser support and multiple deployment formats | Your required JSON reliability, latency, and memory in GGUF, MLX, or ONNX form |
| Apple Foundation Models | Apple platform models; implementation details and available capacity vary by platform | On-device features inside Apple's platform | Framework-integrated structured generation and tool-like actions | Platform availability, feature restrictions, and whether your application must run outside Apple devices |

On raw parameter count, Needle is about one-sixth the size of LFM2.5-230M and FunctionGemma 270M. The meaningful deployment comparison is larger than that ratio. A 230M or 270M model can be quantised and deployed efficiently, but it still needs a model runtime, weights in the selected precision, and a context cache. Needle owns both the model format and engine, which is why its 14MB binary and bounded session memory are part of the product claim.

FunctionGemma and LFM2.5 are better choices when the task needs more language breadth, longer context, or a conventional model runtime. LFM2.5-230M is explicitly positioned by Liquid AI for edge extraction and lightweight agents and ships in formats such as GGUF, MLX, and ONNX. FunctionGemma comes from the Gemma ecosystem and includes recipes for fine-tuning mobile actions. Both have more parameters to spend on generalisation.

Needle's advantage is not that 45M beats every larger model. Cactus Compute says Needle trades wins with these models on its benchmark frontier while being much smaller and using 2-bit rather than fp16 weights. The public README presents that comparison as a chart, not a table with a shared task suite, prompts, latency method, and raw scores. Treat it as a promising claim rather than a procurement result.

Apple Foundation Models belong in a different category. They may be compelling when the app is already inside the Apple ecosystem, but they are not an open, portable model package that can be evaluated on a Linux device or embedded controller in the same way as Needle, FunctionGemma, or LFM2.5.

## How to test performance fairly

The right benchmark is the one your device must survive. Measure a small, fixed evaluation set rather than comparing a chart to an unrelated public leaderboard.

For tool calling, make a test set with valid requests, ambiguous requests, requests for absent tools, malformed arguments, and prompt-injection attempts inside tool results. Measure:

- exact tool selection;
- exact argument validity against the JSON schema;
- confidence calibration, especially false confidence;
- end-to-end latency and peak RAM on the target device;
- behaviour after a denied tool call or a tool timeout.

For extraction, measure field-level precision and recall, then separately count schema-valid but semantically wrong records. A perfect JSON response with the wrong invoice total is still a bad extraction.

Run the same tool descriptions, same schemas, and same device conditions for each model. If the larger model has a much longer context, disclose that difference instead of calling it a head-to-head result. If Needle's 256-token window excludes important information, that is a real limitation, not a configuration error.

## Where Needle fits in an AI system

Needle is a small decision component, not a replacement for the rest of an AI stack. It still needs a durable source of facts, stable tool schemas, permissions, raw evidence, and audits. Those are data-engineering problems.

Use it at the edge of a workflow where one of two outcomes is acceptable: a valid typed action or a safe escalation. Keep long-horizon reasoning, broad document retrieval, open-ended writing, and high-consequence decisions with a larger model or a human review path.

That boundary is where the model becomes useful. A 14MB engine is small enough to deploy widely. The hard work is deciding which 14MB-sized decision you are willing to automate.

## References

- [Needle 2 repository and README](https://github.com/cactus-compute/needle)
- [Needle API documentation](https://github.com/cactus-compute/needle/blob/main/doc/apis.md)
- [Needle 2 weights](https://huggingface.co/Cactus-Compute/needle2)
- [Simple Attention Network paper](https://arxiv.org/abs/2607.18363)
- [FunctionGemma cookbook](https://github.com/google-gemini/gemma-cookbook/tree/main/FunctionGemma)
- [LFM2.5-230M documentation](https://docs.liquid.ai/lfm/models/lfm25-230m)
- [Apple Foundation Models documentation](https://developer.apple.com/documentation/FoundationModels)
- [Data Engineering in 30 Days, Day 29: Data for AI systems](/posts/2026-08-18-data-engineering-day-29-data-for-ai-systems)
