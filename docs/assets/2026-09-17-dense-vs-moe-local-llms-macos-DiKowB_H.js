var e=`---
title: "Dense vs MoE Models: Choosing a Local LLM for macOS"
date: 2026-09-17
tags: [local-llm, llm-architecture, mixture-of-experts, macos, apple-silicon, mlx]
series: building-ai-systems
summary: "Dense and Mixture-of-Experts models use context and generate tokens differently at the feed-forward layer. This guide explains the architecture in plain language, why MoE is not automatically faster on a Mac, and how to decode local-model names, formats, and quantization tags before downloading."
---

Local-model names have become hard to read. A download called \`Qwen3-30B-A3B-Instruct-GGUF-Q4_K_M.gguf\` looks like a password until you know what each segment means. It also hides an important architectural choice: the model may be dense, or it may be a Mixture-of-Experts (MoE) model.

That choice affects quality, memory, speed, and which Mac can run the model comfortably.

The short version is this: a dense model uses the same main weights for every token. An MoE model has a router that selects a small number of specialist feed-forward networks for each token. MoE can use far fewer parameters per generated token than its total parameter count suggests. It still has to keep most or all expert weights available in memory.

Apple Silicon makes larger local models possible because CPU and GPU share unified memory. It does not repeal the memory requirement. A 30B-A3B MoE model may compute like roughly 3B active parameters in its expert layers, but it is still a roughly 30B-parameter model to store.

![Dense and MoE local LLM architecture: both preload weights and grow a KV cache, but MoE routes token computation to selected experts.](/assets/images/dense-vs-moe-local-llm-macos.png)

## The two architectures in plain language

Every transformer processes tokens through repeated layers. Attention lets the current token consider relevant earlier tokens. A feed-forward network then transforms that representation before the next layer receives it.

A dense model has one feed-forward network per layer. Every token uses it.

\`\`\`text
Prompt tokens
    |
    v
Tokenizer -> token IDs -> transformer layer
                              |
                       attention reads KV cache
                              |
                       one dense FFN
                       (all FFN weights)
                              |
                              v
                         next layer ...
                              |
                              v
                        probability for next token
\`\`\`

An MoE model replaces some dense feed-forward networks with a pool of experts and a router. The router scores the experts for a token and selects the top one, two, or another small number. The selected experts process the token and their outputs are combined.

\`\`\`text
Prompt token representation
    |
    v
attention reads KV cache
    |
    v
router scores available experts
    |
    +--> expert 2  --+
    |                +--> combine weighted outputs -> next layer
    +--> expert 5  --+

Experts 1, 3, 4, 6... are not used for this token's FFN calculation.
\`\`\`

"Expert" is a slightly misleading name. It does not mean one expert knows tax law and another knows Python. During training, the model learns routing patterns that can look like specialisation, but there is no dependable menu of human-labelled skills. The router is an optimisation mechanism that lets a model have more total capacity without running every feed-forward weight for every token.

The Switch Transformer paper describes the general idea as sparse activation: different inputs select different parameters while keeping per-token compute bounded. Modern MoE models vary in the number of experts and how many are selected, but the trade-off stays the same.

## How context is loaded and tokens are generated

Architecture names tell only part of the local-memory story. A running LLM holds three major things:

\`\`\`text
model weights + KV cache for the conversation + runtime workspace
\`\`\`

The model weights are the learned parameters. They are loaded once when the runtime starts. The prompt is then tokenized and passed through the model in a prefill phase. At each transformer layer, the runtime stores attention keys and values for those prompt tokens in the KV cache.

When the model generates a response, it runs one new token at a time. Each new token reads the earlier context from the KV cache, calculates a probability distribution, selects the next token, and appends its new keys and values to the cache. The cache grows with the prompt and response length.

\`\`\`text
1. Load model weights
2. Prefill: process prompt tokens -> build KV cache
3. Decode: generate token 1 -> append KV
4. Decode: generate token 2 -> append KV
5. Repeat until stop token or output limit
\`\`\`

Dense and MoE models use this context pattern in broadly the same way. MoE does not make a 128K-token conversation free. Long context can consume several gigabytes of unified memory even after the model weights fit. The exact amount depends on layer count, hidden size, precision, runtime, and configured context window.

The architectural difference appears in the feed-forward calculation during prefill and decode. Dense runs the dense FFN. MoE runs a router and only selected experts. Attention, KV cache, embeddings, and many shared weights remain active in both designs.

## Why MoE can be attractive on a Mac

Apple Silicon has unified memory: the CPU and GPU access the same memory pool. That lets a local inference runtime use more of the machine's installed memory than a discrete GPU with a fixed VRAM limit. MLX is Apple's array framework for Apple Silicon, while runtimes such as llama.cpp can use Metal and GGUF model files.

This makes an MoE model attractive when it offers much higher total capacity without asking the GPU to perform dense computation across every parameter per token. A model labelled \`30B-A3B\` is commonly read as about 30 billion total parameters with about 3 billion active parameters per token. Compared with a dense 30B model, the MoE may need much less expert-layer arithmetic to generate the next token.

That is a quality-per-active-compute argument. It is not a promise of faster tokens per second.

On a Mac, inference is often constrained by memory bandwidth. The runtime must read weights for every layer. MoE routing introduces extra work and can create less regular memory access. More importantly, the complete expert pool still needs to be resident, memory-mapped, or paged from storage. If a model barely fits and macOS starts swapping, the theoretical MoE advantage disappears quickly.

Use this rule instead:

> MoE is often a good way to fit more model capacity into a Mac's unified memory while limiting active compute. It is not automatically a faster replacement for a smaller dense model.

For short coding assistance or agent tool calls, a smaller dense model may have lower latency and more predictable throughput. For work that benefits from a larger model's broad capability, a quantized MoE that fits with comfortable memory headroom can be a strong choice. Benchmark with your real prompt length, not a one-line benchmark prompt.

## Dense vs MoE on local hardware

| Question | Dense model | MoE model |
| --- | --- | --- |
| Which FFN weights run for a token? | The same full FFN in every layer | Router-selected experts, plus shared weights |
| What does parameter count describe? | Mostly compute and storage together | Total storage differs from active compute |
| Does all model weight storage matter? | Yes | Yes, including inactive experts |
| Does long context matter? | Yes, via the KV cache | Yes, via a similar KV cache cost |
| Is performance predictable? | Often more regular | Depends more on router, runtime, batching, and memory behaviour |
| Good local use case | Low-latency chat, coding, small machines | Higher quality at bounded active compute, if total weights fit |

The table explains why comparing only "active parameters" is dangerous. A 30B-A3B MoE and a 3B dense model are not equivalent downloads. The MoE can have much more total learned capacity, but it needs far more storage and memory.

## Reading a model name before you download it

Use this illustrative filename:

\`\`\`text
Qwen3-30B-A3B-Instruct-GGUF-Q4_K_M.gguf
\`\`\`

Different publishers order terms differently, but the common pieces mean:

| Part | Typical meaning | What to check |
| --- | --- | --- |
| \`Qwen3\` | Model family and generation | Read the model card for license, context, and tools support |
| \`30B\` | Total parameter count | Estimate weight storage from this number, not \`A3B\` |
| \`A3B\` | Rough active parameter count per token in an MoE | Useful for compute expectations, not memory sizing |
| \`Instruct\` | Post-trained for following instructions/chat | Choose this for local chat, coding help, and agents; \`Base\` is for further training |
| \`GGUF\` | llama.cpp-compatible model-file format | Use with llama.cpp-compatible tools such as LM Studio or Ollama when that release is supported |
| \`Q4_K_M\` | A 4-bit GGUF quantization variant | Good general starting point when RAM is limited; test quality on your task |
| \`.gguf\` | One model shard or file | Confirm whether the download is split into multiple files |

The model card is the source of truth. Do not infer tool calling, vision, context length, license, or supported language from the filename alone. A tag may say \`Instruct\`, but the card should still tell you the prompt format and whether it was trained for tool calls or structured output.

### A wider tag dictionary

Catalogues combine model capability, file format, and compression in one long name. Read those categories separately:

| Tag you may see | Category | Practical reading |
| --- | --- | --- |
| \`Base\`, \`Instruct\`, \`Chat\` | Training variant | \`Base\` is the foundation checkpoint; \`Instruct\` or \`Chat\` is normally the better starting point for a local assistant. They are not different file formats. |
| \`Coder\`, \`Math\`, \`VL\`, \`Vision\`, \`Omni\` | Capability variant | A specialist fine-tune or multimodal variant. \`VL\`/\`Vision\` normally also needs a compatible runtime and, for GGUF releases, may include a separate projector file. |
| \`Thinking\`, \`Reasoning\`, \`Distill\` | Post-training label | It indicates how the release was trained or intended to respond, not a guarantee of quality, tool use, or a fixed reasoning budget. |
| \`F16\`, \`BF16\`, \`FP16\` | Weight precision | Near-original 16-bit weights. Expect about 2 bytes per parameter before overhead; usually too large for casual local use. |
| \`Q8_0\`, \`Q6_K\`, \`Q5_K_M\`, \`Q4_K_M\`, \`Q3_K_M\` | GGUF quantization | Lower digits generally save memory but can reduce quality. \`Q4_K_M\` is a common balanced GGUF choice; the \`K\` and \`M\` are llama.cpp quantization names, not universal benchmarks. |
| \`IQ4_XS\`, \`IQ3_M\`, \`UD-IQ1_S\` | GGUF importance quantization | More aggressive GGUF families. They can make a model fit, but test them on the real prompts before relying on them for agent work. |
| \`4bit\`, \`8bit\` | Runtime-specific quantization | Common on MLX releases. The label says little about the exact method, so do not treat MLX \`4bit\` and GGUF \`Q4_K_M\` as identical. |
| \`GGUF\`, \`.gguf\` | llama.cpp-format artifact | Use with a GGUF-capable runtime. The format tells you how weights are packaged, not whether the model is dense or MoE. |
| \`MLX\` | Apple Silicon artifact | Prepared for MLX/MLX-LM. It is a strong fit for Mac-native workflows, but it is not interchangeable with GGUF. |
| \`AWQ\`, \`GPTQ\`, \`EXL2\` | Other quantized runtime formats | Common in GPU-focused releases. Only download them when the chosen local runtime explicitly supports them; they are not the default Mac choice. |
| \`-00001-of-00004\` | Sharded download | Every numbered shard is required. A single downloaded part is not a usable model. |
| \`mmproj\`, \`projector\` | Multimodal companion file | A vision-language GGUF release may need this file in addition to the language model. Match it to the exact model family and release. |
| \`LoRA\`, \`adapter\` | Delta weights | An add-on, not a standalone model. It requires the matching base model and a runtime that can load the adapter. |

Version labels such as \`v1\`, \`v1.1\`, or a publisher name identify a release, conversion, or fine-tune. Prefer a publisher with a linked model card, a stated source checkpoint, and a reproducible conversion command. A familiar family name alone is not enough.

## Format and quantization tags matter as much as the model family

For local macOS use, two packaging ecosystems appear often:

| Format | Typical Mac runtime | What it means |
| --- | --- | --- |
| GGUF | llama.cpp, LM Studio, Ollama-compatible distributions | A quantized model-file format widely used by local inference tools |
| MLX | MLX-LM and Apple Silicon-focused tools | Model weights converted for MLX on Apple Silicon, often labelled \`4bit\`, \`8bit\`, or similar |
| Safetensors / original checkpoints | Transformers and training workflows | Usually not the convenient first download for a local chat runtime |

Do not download a GGUF file for an MLX-only workflow or an MLX conversion for a GGUF-only runtime. The model architecture can be identical while the weight format and quantization implementation differ.

Quantization stores weights using fewer bits. A rough first estimate is:

\`\`\`text
weight storage ≈ total parameters × bits per weight / 8
\`\`\`

That estimate is deliberately rough. Quantization metadata, non-quantized tensors, runtime buffers, and the KV cache add memory. Still, it gives the correct instinct:

- F16/BF16 needs roughly 2 bytes per parameter before overhead.
- Q8 needs about 1 byte per parameter before overhead.
- Q4 needs about 0.5 bytes per parameter before overhead.

For an MoE model, apply the calculation to total parameters. A 30B-A3B Q4 model does not need only 1.5 GB because 3B parameters are active. Its weights are closer to the storage class of a 30B model, plus context and runtime headroom.

## A sensible Mac selection process

Start with installed unified memory, then reserve room for macOS, your editor, browser, and the KV cache. Do not aim to fill the machine to 99 percent. A model that technically loads but forces swap will feel worse than a smaller one that responds consistently.

| Mac unified memory | Sensible first experiment | Avoid assuming |
| --- | --- | --- |
| 16 GB | 3B to 8B dense Q4, short context | That a large MoE with low active parameters will run comfortably |
| 32 GB | 14B-class dense Q4 or a carefully chosen 30B-A3B-class Q4 MoE | That the advertised maximum context will fit with the chosen model |
| 64 GB | 32B-class dense quantizations or larger MoE experiments | That the largest model is the best coding or tool-use model |
| 128 GB and above | Larger quantizations and longer contexts become practical | That a model's full context window is useful without latency testing |

These are starting points, not compatibility guarantees. A 32 GB Mac can run out of headroom because of context size, a high-quality quantization, a large Metal workspace, or other applications. The correct test is a representative conversation: your system prompt, your usual files or retrieved context, a realistic output length, and the tools you keep open during work.

For a coding agent on macOS, record four results for every candidate model:

\`\`\`text
model file + runtime + quantization + context length
prompt prefill speed + decode tokens/second
peak memory + swap activity
task quality: tests passed, tool-call correctness, or review acceptance
\`\`\`

That record is more useful than a leaderboard. It tells you whether a MoE model is buying useful quality for your workload or merely using more memory.

## What I would choose for local agents

Choose a dense instruction model when the Mac has limited unified memory, the agent needs short and frequent replies, or predictable latency matters more than broad model capacity. Dense models are easier to size from their parameter label because total and active parameters are effectively the same story.

Try an MoE instruction model when you have enough memory for its total quantized weights plus context headroom and you want a stronger model without paying dense compute across its full parameter count on every token. Use an MLX build for an MLX workflow or a GGUF build for a llama.cpp-compatible workflow. Benchmark the exact file; two Q4 releases of the same family can behave differently across runtimes.

Do not choose by a single label. Read the model card, match the file format to the runtime, size from total parameters, configure context deliberately, and test the task you actually care about. That is how a local model becomes part of a reliable macOS workflow instead of a large download that only works in a demo.

## References

- [Switch Transformers paper](https://arxiv.org/abs/2101.03961)
- [Apple MLX repository](https://github.com/ml-explore/mlx)
- [MLX-LM repository](https://github.com/ml-explore/mlx-lm)
- [llama.cpp repository](https://github.com/ggml-org/llama.cpp)
- [Qwen3-30B-A3B model card](https://huggingface.co/Qwen/Qwen3-30B-A3B)
`;export{e as default};