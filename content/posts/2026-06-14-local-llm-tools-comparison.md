---
title: "The Local LLM Toolbox: Picking the Right Runner for Your Models"
date: 2026-06-14
tags: [local-llm, llama-cpp, ollama, lm-studio, mlx-lm, llm-cli, developer-tools, open-source]
summary: "Five tools dominate the local LLM landscape, and they're not interchangeable. llama.cpp is the engine, Ollama is the one-liner, LM Studio is the GUI, LLM CLI is the Swiss army knife, and mlx-lm is the Apple Silicon specialist. Here's how I think about which one to reach for."
---

## The Local LLM Toolbox: Picking the Right Runner for Your Models

I've been experimenting with running models locally for a few months now — first out of curiosity, then out of necessity as cloud API costs climbed and the repetitiveness of my coding tasks started to feel like a problem worth solving at the infrastructure level.

The good news: the local LLM ecosystem has matured fast. The bad news: there are five major tools, they overlap in confusing ways, and the "just use X" advice you find online usually assumes your use case matches the recommender's.

Here's my take on the landscape — what each tool actually does, where it shines, and when to reach for something else.

### llama.cpp — The Foundation

Everything else builds on this. llama.cpp is a plain C/C++ inference engine — no dependencies, no framework opinions, just raw token generation. It supports basically every hardware backend (Metal, CUDA, HIP, Vulkan, SYCL), every quantization format from 1.5-bit to 8-bit, and 60+ model architectures. GGUF, the model format it pioneered, is now the de facto standard for local model distribution.

If you're building something — an inference server, a custom agent, a specialized tool — llama.cpp is what you build on. The OpenAI-compatible API server (`llama-server`) is production-ready, and the language bindings (Python, Node.js, Rust, Go, C#, Java) mean you can call it from anything.

The tradeoff is friction. No model management, no GUI, no chat templates out of the box. You download GGUF files from HuggingFace, you specify quantization types, you configure GPU layers manually. It's the Linux of local LLMs — maximum control, maximum responsibility.

**When I reach for it:** Almost never directly anymore. But I'm grateful it exists, because everything I do use is built on top of it.

### Ollama — The Default Choice

Ollama is what I recommend to anyone who just wants to run models locally. One command:

```bash
ollama run gemma4
```

That downloads the model, selects the right quantization, offloads to GPU automatically, and drops you into a chat. The API server starts on `localhost:11434` with OpenAI-compatible endpoints. It's the Docker of local LLMs — it abstracts away everything that isn't the conversation.

The ecosystem integrations are massive. Open WebUI for a chat interface, Continue and Cline for VS Code, LiteLLM for routing, LangChain for chains, OpenLIT for observability. If a tool supports local LLMs, it probably supports Ollama first.

The limitations are real but rarely matter: you're locked to GGUF models, you have less control over inference parameters than raw llama.cpp, and the curated model library doesn't include everything on HuggingFace. For 90% of use cases, that's fine.

**When I reach for it:** Quick experiments, prototyping, any time I need a local model *now* without thinking about configuration. Also for agent work — the OpenAI-compatible API means any tool that speaks OpenAI can talk to Ollama.

### LM Studio — The GUI

LM Studio is for people who want to browse, download, and chat with models without touching a terminal. The model browser shows VRAM requirements, quantization options, and community ratings. One click to download, one click to load, type in the chat box.

It's proprietary but free for personal use, and the recent addition of `llmster` (headless server mode) makes it viable for deployment. The JavaScript and Python SDKs mean you can integrate it into applications. MCP client support means it can use tools.

The honest assessment: the GUI is polished, the headless mode is new and less battle-tested, and the proprietary core means you're trusting a company to maintain it. For个人 use, it's excellent. For infrastructure I'm building on, I want the open-source guarantees of Ollama or llama.cpp.

**When I reach for it:** Showing someone how local LLMs work. Quick visual testing of different models. The headless mode is interesting for lightweight deployment but I haven't pushed it yet.

### LLM CLI — The Unified Interface

Simon Willison's `llm` tool is the most underrated tool in this space. It's a Python CLI that talks to *every* provider — OpenAI, Anthropic, Gemini, Ollama, LM Studio — through a plugin system. One command for everything:

```bash
# Cloud
llm "what is the capital of France" -m gpt-4o

# Local via Ollama
llm "what is the capital of France" -m llama3.2

# Local via LM Studio
llm "what is the capital of France" -m lmstudio/local-model
```

What makes it special: SQLite logging of every prompt and response, built-in embeddings (generate, store, search), structured data extraction via JSON schemas, tool use support, and a template system for reusable prompts. It's not an inference engine — it's a *workflow tool* that happens to talk to inference engines.

The plugin ecosystem is 50+ deep. `llm-ollama` for local models, `llm-gemini` for Google, `llm-anthropic` for Claude, embedding plugins, fragment loaders for long contexts. If you work across multiple providers — which most people do — this is the unified interface you didn't know you needed.

**When I reach for it:** Scripting, data pipelines, anywhere I need to call LLMs programmatically and want a clean API with logging. The embeddings support is surprisingly good for quick RAG prototypes.

### mlx-lm — The Apple Specialist

mlx-lm is Apple's own tool for running and fine-tuning models on Apple Silicon. It uses the MLX framework, which is optimized for the unified memory architecture of M-series chips. If you have an M2/M3/M4 Mac, this is the fastest path to local inference.

The killer feature: **fine-tuning**. mlx-lm supports LoRA, DoRA, QLoRA, full fine-tuning, and distributed training. No other tool in this list does that out of the box. I wrote about this in detail in my fine-tuning post — it's how I'm planning to train a specialized coding assistant on my own patterns.

The tradeoff is strict: Apple Silicon only, no REST API (Python library and CLI only), no GUI, smaller ecosystem. It's a specialist tool, not a general-purpose runner.

**When I reach for it:** Fine-tuning experiments. Running models when I want maximum Apple Silicon performance. Building custom Python applications that need local inference.

### How They Stack Up

| | llama.cpp | Ollama | LM Studio | LLM CLI | mlx-lm |
|---|---|---|---|---|---|
| **Ease of setup** | Medium | Very Easy | Very Easy | Easy | Easy (Mac only) |
| **GUI** | No | No | Yes | No | No |
| **API server** | Yes | Yes | Yes | No | No |
| **Model management** | Manual | Built-in | Built-in | Via plugins | HuggingFace Hub |
| **Hardware support** | All | All | All | Via backends | Apple Silicon only |
| **Fine-tuning** | No | No | No | No | Yes |
| **Structured output** | GBNF grammars | No | No | Schemas | No |
| **Best for** | Engine/infra | General use | GUI users | Multi-provider CLI | Apple perf + training |

### My Actual Stack: Ollama + mlx-lm

I don't use just one tool. My stack has two layers, and they serve different purposes:

**Ollama** is the inference runtime. It's always running, the API server is on `localhost:11434`, and every tool I build talks to it. I pull models from Ollama's library for quick experiments:

```bash
ollama run gemma4
```

That's the starting point. Zero friction, one command, done.

**mlx-lm** is the training layer. This is where the real value lives for specialized work. The workflow looks like this:

```text
1. Download base model from HuggingFace
        ↓
2. Curate dataset (my code patterns, project conventions, data analysis workflows)
        ↓
3. Fine-tune with mlx-lm (QLoRA on 4-bit model)
        ↓
4. Export to GGUF
        ↓
5. Import into Ollama
        ↓
6. Run fine-tuned model via Ollama API
```

This is the pipeline I'm building toward. The base model gives you general capability. Fine-tuning gives you *your* patterns — your error handling, your naming conventions, your project structure. Ollama gives you the infrastructure to serve it.

The first phase was simple: download a model from Ollama's library and connect a harness to it. That worked, but the model doesn't know my code. The second phase — which I'm exploring now — is downloading the raw base model from HuggingFace, fine-tuning it on my actual work, and then running the specialized version through Ollama. Same API, same tooling, but a model that knows *me*.

**Why this combination works:**

- Ollama handles everything I don't want to think about: model loading, GPU offloading, API serving, multi-user support
- mlx-lm handles everything Ollama can't: training, fine-tuning, adapter management
- Together they form a complete loop: train locally, serve locally, iterate locally

**LLM CLI** I also keep around for scripting and data work — calling LLMs from shell scripts, extracting structured data, logging interactions. It plugs into Ollama's API, so it's part of the same stack.

**llama.cpp** is underneath everything. I don't call it directly, but it's there — handling inference for Ollama, powering the GGUF format I use everywhere.

LM Studio I keep installed for demos and quick visual tests, but it's not part of my daily workflow.

### The Takeaway

There's no single "best" local LLM tool. There's the right tool for what you're doing right now. If you're starting from zero, install Ollama and start running models. If you're on Apple Silicon and want to fine-tune, add mlx-lm. If you're building workflows across providers, add LLM CLI. And if you need maximum control or are building infrastructure, go straight to llama.cpp.

The local LLM ecosystem isn't a competition — it's a stack. Use the layers that make sense for your work.
