var e=`---
title: "Benchmarking Local LLMs on Apple Silicon: What Matters Beyond Parameters"
date: 2026-09-18
tags: [local-llm, apple-silicon, benchmarking, mlx, llama-cpp, ai-agents]
series: building-ai-systems
summary: "A practical method for benchmarking local LLMs on a Mac for a real agent workload. Measure cold start, prefill, generation, memory headroom, structured-output reliability, and task quality before choosing Dense or MoE models."
---

A local model benchmark is easy to make look impressive. Pick a short prompt, generate 50 tokens, quote tokens per second, and declare a winner.

That result tells very little about whether the model can run an internal agent. An agent loads system instructions, retrieved documents, prior messages, tool definitions, and structured-output schemas before it emits a useful token. It also has to return valid tool arguments and make decisions that survive review.

For a Mac-based deployment, the useful question is not, "Which model is fastest?" It is, "Which model completes this job at an acceptable speed, quality, and memory footprint on this machine?"

This article lays out a benchmark I would use before deploying a private support-and-knowledge agent on Apple Silicon. The same method works for a coding assistant, a research copilot, or an internal document triage service.

## Start with the workload, not the model catalogue

Consider an internal operations agent for a 40-person company. Staff ask questions such as:

> A contractor starts next Monday. Which systems need access, who approves each one, and what must be completed before their first day?

The agent searches approved HR and IT documents, returns cited steps, then proposes a structured hand-off to an operations queue. It must not invent access rights, send a request, or treat an outdated policy as current.

That single task has a much different shape from a chat benchmark:

| Workload component | What it adds | What it exposes |
| --- | --- | --- |
| System prompt and safety rules | 600–1,200 tokens | Baseline prefill cost |
| Retrieved policy excerpts | 1,000–8,000 tokens | Context handling and KV-cache growth |
| Tool definitions and JSON schema | 500–1,500 tokens | Structured-output reliability |
| A useful response | 150–400 tokens | Generation speed and completeness |
| Approval boundary | A proposed ticket, never a direct change | Whether the model follows operating rules |

![A local-agent benchmark should measure the full request path: user request, retrieved policy, local LLM, JSON validation, human approval, and trusted response.](/assets/images/local-llm-agent-benchmark-flow.png)

Write down the workload before testing anything. Keep a small, anonymised evaluation set: routine questions, ambiguous questions, stale-document traps, and requests that should be escalated. If a benchmark uses a different prompt for every model, it is a demo, not a comparison.

## Measure the phases a person notices

An LLM request has more than one speed. On a Mac, separating them is especially useful because large context and memory pressure can change the user experience without much change to a headline generation score.

| Metric | Definition | Why it matters to an agent |
| --- | --- | --- |
| Cold start | Time from process start until the model can serve a request | Determines whether the agent can be started on demand or needs to stay resident |
| Time to first token (TTFT) | Time until the first generated token after a request arrives | The delay a user feels before the agent responds |
| Prompt processing / prefill throughput | Input tokens processed per second | Dominates when retrieval and tool schemas make prompts long |
| Generation throughput | Output tokens generated per second | Matters for explanations, code, and longer reports |
| Peak memory | Highest observed memory use during the request | Reveals whether the model leaves room for macOS and other applications |
| Warm-request latency | TTFT and completion time after the model is already loaded | The normal interactive experience |
| Concurrent-request behavior | Latency and failures with two or more active requests | Determines whether one Mac can serve a team or only one user |

\`llama-bench\` explicitly separates prompt processing, text generation, and combined tests. It also supports repeated runs, context-depth tests, and JSON-family output. That is a better starting point than recording one terminal line. MLX-LM exposes prompt tokens per second, generation tokens per second, and peak memory in its generation response. [llama.cpp benchmark documentation](https://github.com/ggml-org/llama.cpp/tree/master/tools/llama-bench), [MLX-LM generation code](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/generate.py)

Do not confuse prompt throughput with perceived latency. A fast prefill result is useful, but a user still waits for request handling, tokenisation, sampling, the first generated token, and any application work around the model. The \`llama-bench\` documentation notes that its measurements exclude tokenisation and sampling. Run an end-to-end agent test as well.

## Keep the test conditions boring and consistent

Local results are fragile. A different quantisation, runtime version, context length, power mode, or background workload can outweigh the apparent difference between two models.

Record these fields with every run:

\`\`\`text
machine: MacBook Pro, Apple Silicon, 64 GB unified memory
macOS: version and build
runtime: llama.cpp or MLX-LM version and commit/release
model: source repository, exact revision, format, and quantisation
context: requested context limit and actual prompt-token count
generation: max tokens, temperature, seed, and output schema
load state: cold or warm
concurrency: number of in-flight requests
background state: other substantial apps closed or listed
\`\`\`

The model name needs the same care as the earlier Dense-versus-MoE choice. \`Q4_K_M\` GGUF, \`4bit\` MLX, and an F16 checkpoint are not comparable merely because their family name and total parameter count match. A 30B-A3B MoE release may perform far less expert-layer arithmetic per token than a 30B dense model, but its total expert weights still need memory. Measure the exact artifact you will deploy.

Apple Silicon uses unified memory. MLX documents that arrays live in shared memory and can be used by supported devices without copying between CPU and GPU memory. That helps local workflows, but it does not turn shared memory into free capacity. If macOS is under memory pressure or starts swapping, a result from an otherwise quiet benchmark run is no longer the operating result. [MLX unified-memory documentation](https://ml-explore.github.io/mlx/build/html/usage/unified_memory.html)

## Build a small benchmark matrix

Test only models that are plausible candidates. Five carefully controlled runs teach more than twenty random downloads.

For the support agent, I would start with three candidates:

| Candidate | Why include it | What it is testing |
| --- | --- | --- |
| Small dense instruct model | Low memory and simple serving | The acceptable floor for task quality |
| Medium dense instruct model | Predictable architecture and stronger capacity | Whether quality improves enough to justify slower responses |
| MoE instruct model | High total capacity with fewer active expert parameters | Whether its quality and compute profile justify its full memory footprint |

Run each candidate against fixed prompt sizes: a short 800-token request, a realistic 4,000-token request, and a long 12,000-token request. Keep the response cap identical, for example 200 tokens. Then repeat the realistic request after the model is warm.

This creates a simple matrix:

| Model artifact | Load state | Prompt tokens | Output cap | TTFT | Prefill tok/s | Generation tok/s | Peak memory | JSON valid | Task score |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| \`model-a\` | cold | 4,000 | 200 | record | record | record | record | record | record |
| \`model-a\` | warm | 4,000 | 200 | record | record | record | record | record | record |
| \`model-b\` | warm | 12,000 | 200 | record | record | record | record | record | record |

There are intentionally no invented scores in this table. A hardware-specific benchmark should earn its numbers.

## Use runtime benchmarks, then test the full agent

For a GGUF model, \`llama-bench\` can provide reproducible low-level runs. The exact flags may change with releases, so check \`llama-bench --help\` on the installed version.

\`\`\`bash
llama-bench \\
  -m ./models/support-agent.Q4_K_M.gguf \\
  -p 800,4000,12000 \\
  -n 200 \\
  -r 5 \\
  -o jsonl > results/llama-bench.jsonl
\`\`\`

The command repeats the tests and records machine-readable results. Add a context-depth run when the agent has ongoing conversations, because a partly filled KV cache can affect the result:

\`\`\`bash
llama-bench -m ./models/support-agent.Q4_K_M.gguf -d 8000 -n 200 -r 5 -o jsonl
\`\`\`

For an MLX model, make a short script that loads the exact repository, sends the fixed prompts, and writes the metrics exposed by MLX-LM. The runtime’s generator reports prompt throughput, generation throughput, and peak memory, which are useful fields for the same result table.

\`\`\`python
from mlx_lm import generate, load

model, tokenizer = load("organisation/support-agent-mlx-4bit")
answer = generate(
    model,
    tokenizer,
    prompt=realistic_prompt,
    max_tokens=200,
    temp=0,
    verbose=True,
)
\`\`\`

Run the application-level test after this. Send the same request through the actual API endpoint, retrieval layer, prompt builder, JSON validator, and audit logger. Capture the time at request receipt, first streamed token, last token, validation completion, and final response. That is the number the business experiences.

## Quality has to sit beside speed

The fast model is a bad bargain if it sends an employee to the wrong approval path. Give each test case a small rubric rather than relying on a general impression.

For the support-agent example, score:

| Check | Pass condition |
| --- | --- |
| Grounding | Every policy claim is supported by a supplied current source or is explicitly uncertain |
| Approval boundary | The agent creates a proposed hand-off; it does not claim that access was granted |
| Structured output | The response validates against the ticket schema with no repair pass |
| Escalation | Conflicting or missing policy is routed to the named human owner |
| Completeness | It includes required systems, owners, and pre-start steps without irrelevant material |

Use a human reviewer for an initial set of 20 to 50 cases. An automated checker can validate JSON and citations, but it cannot safely decide that a proposed access path is correct unless the business policy itself is structured and current.

One useful statistic is *validated task completion rate*: the share of cases that produce a complete, correct, schema-valid result without manual repair. Compare that with median end-to-end latency. This prevents a model that is fast but routinely needs an operator to rewrite its output from winning the evaluation.

## Decide with headroom, not a cliff edge

A model that barely fits is not a deployment plan. The agent competes with macOS, the browser, the retrieval store, the runtime, and its growing KV cache. It may also need to serve a second request while a first response is still streaming.

Set a headroom rule before looking at results. For example: reject a candidate if the realistic long-context test causes memory pressure, swap activity, request failures, or a large tail-latency jump when a second request arrives. The exact memory reserve depends on the Mac and the rest of the workflow, so record the observed state instead of treating a generic GB threshold as a guarantee.

MoE models belong in the candidate set when their quality is attractive and the Mac has enough unified memory for all weights plus runtime headroom. Their routed experts may improve token-generation efficiency relative to an equally capable dense model, but a small active-parameter label is not permission to ignore total storage. A medium dense model can still be the better operational choice when it loads faster, leaves more memory for context, and meets the task rubric.

![A local model reaches limited rollout only after passing separate quality, latency, and memory-headroom gates; any gate can reject the candidate.](/assets/images/local-llm-operating-headroom-gates.png)

## Turn one benchmark into an operating practice

Keep the prompt set, model identifiers, runtime configuration, and results in version control. Rerun the suite when you change a model, quantisation, system prompt, retrieval format, tool schema, runtime version, or Mac hardware.

That turns benchmark work into a release gate:

\`\`\`text
candidate change
  -> runtime benchmark
  -> end-to-end agent evaluation
  -> quality and memory review
  -> limited internal rollout
  -> production promotion or rejection
\`\`\`

The numbers will move as models and runtimes evolve. The workflow should not. A local agent is ready when it is fast enough for its users, fits with operational headroom, returns trustworthy work, and can be measured again after the next change.

## References

- [MLX documentation: unified memory](https://ml-explore.github.io/mlx/build/html/usage/unified_memory.html)
- [MLX-LM generation implementation and metrics](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/generate.py)
- [MLX-LM prompt-cache utility](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/cache_prompt.py)
- [llama.cpp llama-bench documentation](https://github.com/ggml-org/llama.cpp/tree/master/tools/llama-bench)
- [llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)
`;export{e as default};