---
title: "Training My Own Local SLM: Fine-Tuning Gemma 4 with mlx-lm for a Coding Agent"
date: 2026-06-14
tags: [local-llm, fine-tuning, mlx-lm, mlx, apple-silicon, slm, coding-agent, data-analysis, lora, qlora, open-source]
summary: "I've been exploring how to fine-tune a small language model locally on Apple Silicon to serve as the backbone of a personal coding and data analysis agent. No cloud APIs, no per-token costs, no data leaving my machine. Here's what I found and where I'm heading."
---

## Training My Own Local SLM: Fine-Tuning Gemma 4 with mlx-lm for a Coding Agent

I've been running cloud-powered agents for months now — Claude Code, Cursor, various API-backed assistants — and the recurring theme is the same: they're brilliant, they're fast, and they cost real money every single time I ask them to do something.

For the kind of work I do — writing Rust CLIs, cleaning crypto data, analyzing on-chain datasets, building dashboards — most of my agent interactions are repetitive patterns. I ask for the same error handling style. I want the same project conventions followed. I want code that looks like *mine*, not generic Stack Overflow scaffolding.

That's the itch that led me to fine-tuning.

### The Idea

I want a small language model — 7B to 12B parameters — that lives on my Mac, runs locally, and knows my coding patterns well enough to handle the routine stuff without me paying per token. Not a replacement for frontier models when I need deep reasoning, but a specialized assistant for the 80% of tasks that are pattern-matching, not novel problem-solving.

The toolchain I landed on: **mlx-lm** on Apple Silicon.

### Why mlx-lm on Apple Silicon

Apple Silicon has one architectural advantage that makes local fine-tuning genuinely practical: **unified memory**. On an NVIDIA GPU, you're limited by VRAM — 24GB on an RTX 4090. On an M2 Max with 32GB, the GPU and CPU share the entire 32GB pool. That means a 12B quantized model (~3GB for 4-bit) plus LoRA adapters plus training overhead all fit comfortably without creative memory management.

mlx-lm is Apple's own framework for this. It supports LoRA, DoRA, QLoRA, gradient checkpointing, distributed training, and exports to GGUF for use with Ollama or llama.cpp. The command to start fine-tuning is almost embarrassingly simple:

```bash
pip install "mlx-lm[train]"

mlx_lm.lora \
    --model mlx-community/gemma-4-12b-it-4bit \
    --train \
    --data ./dataset \
    --adapter-path ./adapters \
    --batch-size 4 \
    --iters 600 \
    --num-layers 16
```

That's it. That's the training loop.

### The Dataset Question

The hard part isn't the training — it's the data.

I've been collecting examples from my actual work:

- **Git commits**: Commit messages paired with diffs. The model learns how I write commit messages, what patterns I follow, what naming conventions I use.
- **Code reviews**: PR descriptions and review comments. It learns my judgment about code quality.
- **Project-specific patterns**: How I structure Rust CLIs with clap, how I handle errors, how I set up Vite + Tailwind projects, how I write data pipelines.
- **Data analysis workflows**: Typical pandas/Polars queries, cleaning scripts, visualization patterns I reuse.

The format is straightforward — JSONL with system/user/assistant messages:

```jsonl
{"messages": [{"role": "system", "content": "You are a code assistant. You write Rust CLI commands following these conventions: use clap for arg parsing, return Result<()>, handle errors with anyhow."}, {"role": "user", "content": "Create a CLI command to index markdown files into SQLite"}, {"role": "assistant", "content": "use clap::Parser;\nuse rusqlite::Connection;\n\n#[derive(Parser)]\nstruct Args {\n    #[arg(short, long)]\n    vault: PathBuf,\n}\n\nfn main() -> Result<()> {\n    let args = Args::parse();\n    let db = Connection::open(args.vault.join(\"index.db\"))?;\n    // indexing logic\n    Ok(())\n}"}]}
```

The key insight from the research: **quality beats quantity**. 500 excellent, curated examples will outperform 5,000 mediocre ones. I'd rather have 300 examples of my actual coding patterns than 3,000 scraped from GitHub repos that don't match my style.

### Fine-Tuning vs. Harnessing — And Why You Need Both

This is the distinction I keep coming back to, because it determines how you spend your time and where you get accuracy gains.

**Harnessing** is everything you do *around* the model to make it behave correctly. System prompts that tell it your conventions. RAG pipelines that feed it relevant documentation. Few-shot examples in the context window that show it the pattern you want. Tool definitions that let it call your APIs. This is how most people use LLMs today — you don't change the model, you change what it sees.

**Fine-tuning** changes the model itself. You take a base model and adjust its weights so that it *intrinsically* knows your patterns. Not because you told it in the prompt, but because it learned from thousands of examples of your actual work.

The tradeoffs are real:

| | Harnessing | Fine-Tuning |
|---|---|---|
| **What changes** | The prompt/context | The model weights |
| **Portability** | Reusable across models — switch from Gemma to Llama by changing a config | Locked to the model you trained on |
| **Effort to switch** | Low — update system prompt, done | High — re-run fine-tuning on the new model |
| **Data needed** | Few-shot examples in prompt (0-20 examples) | Hundreds to thousands of training examples |
| **Cost to iterate** | Free — edit prompt, test immediately | Time + compute — minutes to hours per iteration |
| **When base model improves** | Automatically benefits — same prompt, better model | Must re-fine-tune to port to new model |
| **Accuracy ceiling** | Limited by prompt length and base model knowledge | Can exceed base model on specific tasks |
| **Hallucination** | Depends on base model + context quality | Reduced on trained tasks, but can hallucinate on untrained tasks |

The key insight: **harnessing is portable but limited. Fine-tuning is powerful but locked to a model.**

When a new model drops, harnessing lets you switch in minutes. Fine-tuning means re-running your whole training pipeline. That's a real cost — and it means you need to decide *what's worth fine-tuning* vs. what's better handled through prompts and context.

### How They Work Together

The real answer isn't choosing one — it's layering them. Think of it as two levels of knowledge:

**Fine-tuning teaches the model how I think about code.** My error handling patterns. My naming conventions. My project structure preferences. The way I write Rust CLI commands with clap. The way I structure Python data pipelines with Polars. This is durable knowledge that persists across sessions — it's baked into the weights, not injected into the prompt every time.

**Harnessing teaches the model what I'm working on right now.** The current project's directory structure. The three files I just edited. The specific error message I'm debugging. The database schema for this particular analysis. This is ephemeral context that changes every session and can't be permanently trained in.

In practice, the stack looks like this:

```
Layer 1: Fine-tuned model weights
    ↓
Layer 2: System prompt ("You are a coding assistant for this project.
          Follow these conventions: ...")
    ↓
Layer 3: RAG context (relevant docs, API references, similar past code)
    ↓
Layer 4: Tool access (file read/write, shell, databases, web search)
    ↓
Layer 5: Dynamic few-shot examples (most similar past queries)
    ↓
Output: Specialized, context-aware, accurate response
```

Each layer narrows the problem. Fine-tuning eliminates an entire class of "the model doesn't know my style" errors. System prompts eliminate "the model doesn't know the project rules" errors. RAG eliminates "the model doesn't have the right documentation" errors. Tool access eliminates "the model can't actually do anything" errors.

The accuracy gains compound. A fine-tuned model with good RAG context will outperform a generic model with great RAG context, because the fine-tuned model starts from a better baseline. It already knows your patterns — the RAG context just gives it the specific details it needs for this task.

### The Practical Recommendation

Start with harnessing. It's fast, free, and portable. Get your system prompts right. Set up RAG for your documentation. Define your tools. See where the accuracy ceiling is.

If accuracy is insufficient or costs are too high — because you're sending too many tokens to cloud APIs for context — that's when fine-tuning makes sense. Fine-tune for your core use case. Keep harnessing on top for dynamic context.

When a new model arrives, decide: is the base model improvement worth re-fine-tuning? Often the answer is yes, but your fine-tuning dataset and workflow are reusable. You're not starting from scratch — you're reapplying your data to a better foundation.

### The Economics

I ran the numbers. At 100 queries per day with GPT-4o (2K input, 1K output tokens), that's roughly $225/month. At 1,000 queries/day — which is plausible for an autonomous agent — it's $2,250/month.

My M2 Max already sits on my desk. The marginal cost of running a local model is electricity — maybe $5-10/month. The hardware is a sunk cost. Fine-tuning itself takes minutes, not hours, and costs nothing.

For the kind of repetitive, pattern-heavy coding assistance I need, the ROI is obvious. Save the frontier APIs for the hard stuff.

### The Problems I'm Watching Out For

Fine-tuning sounds straightforward — collect data, train, deploy. But there are real pitfalls that can silently degrade your model or make it worse than the base version. These are the ones I'm most aware of:

#### Catastrophic Forgetting

The model forgets what it learned during pretraining. You fine-tune it on your Rust code patterns, and suddenly it's worse at Python, or it loses general reasoning ability, or it starts hallucinating APIs that don't exist.

This happens because fine-tuning adjusts weights that hold *all* the model's knowledge, not just the knowledge you want to change. A model that was trained on the entire internet has general capabilities baked into those weights. When you nudge them toward your specific patterns, you risk nudging away from everything else.

The mitigation: use LoRA/QLoRA instead of full fine-tuning. LoRA adds small adapter matrices on top of frozen base weights, so the original knowledge stays intact. You're layering your patterns on top, not replacing the foundation. Also, keep the learning rate low (1e-5 or lower) and train for fewer iterations — you want to gently steer the model, not rewire it.

#### The Context-Length Memory Trap

Fine-tuning teaches the model patterns from your examples, but it doesn't teach it to *remember* context across long conversations. If your coding agent needs to hold a 50-file project structure in working memory, fine-tuning won't help — it trained on individual examples, not on maintaining state across 10K tokens of context.

This is where harnessing (RAG, system prompts, tool access) fills the gap. Fine-tuning teaches *how* to write code. RAG teaches *what* the current project looks like. Confusing these two leads to disappointed expectations — you fine-tune thinking the model will "know your project," but what it actually knows is your *style*. The project context still needs to be injected at inference time.

#### Overfitting to Code Style

This one is subtle. If your training data is too narrow — say, 500 examples all from the same project, same language, same patterns — the model becomes a parrot for that specific style. It produces code that looks like yours but can't adapt when the task is slightly different.

The risk is especially high for code fine-tuning because code is highly structured. A model can memorize function signatures, error handling patterns, and naming conventions without actually understanding *why* those patterns exist. It learns the shape of your code but not the reasoning behind it.

Mitigation: diversify your dataset. Include examples from multiple projects, multiple languages, multiple contexts. Include examples where you *break* your own patterns — refactoring, handling edge cases, making exceptions. And always evaluate on held-out data you didn't train on, not just on whether the output "looks right."

#### Codebases Are Moving Targets

Your code changes. Your conventions evolve. That error handling pattern you used six months ago? You refactored it last week. The model you fine-tuned three months ago is now out of sync with your current codebase.

This is the fundamental tension: fine-tuning captures a snapshot of your patterns at a point in time. Codebases are living things. The practical response is to treat fine-tuning as a repeatable process, not a one-time event. Keep your dataset versioned. Retrain periodically. Make the fine-tuning pipeline cheap enough that you can rerun it every month or two without dreading the process.

It also means fine-tuning is most valuable for *stable* patterns — the things that don't change often. Your general coding style, your project structure conventions, your preferred libraries and frameworks. Don't fine-tune on things that change weekly — use harnessing for those.

### Where I'm Headed

This is still exploration, not production. My current plan:

1. **Curate the dataset** — Pull 500-1,000 examples from my git history, project configs, and code review patterns. Focus on the coding and data analysis workflows I repeat daily.
2. **Fine-tune Gemma 4 12B** — Use QLoRA on a 4-bit quantized model. Should fit in 32GB with room to spare.
3. **Evaluate** — Test against a held-out set of coding tasks. Does the fine-tuned model produce better code for *my* projects than the base model?
4. **Export to GGUF** — Fuse the adapter, export, load into Ollama as a local coding assistant.
5. **Layer harnessing on top** — System prompts for project context, MCP tools for file access, RAG for documentation.

The open questions I'm still working through:

- How many examples are actually enough for meaningful specialization on coding tasks?
- Does fine-tuned Gemma 4 12B outperform fine-tuned Llama 3.2 3B for the same tasks, or is smaller better?
- What's the quality hit when exporting fused models to GGUF?
- Can I compose multiple LoRA adapters — one for Rust, one for Python, one for data analysis — and swap them based on context?

### The Bigger Picture

There's a philosophical shift happening in how I think about AI assistants. The cloud-first model — every request goes to someone else's GPU, every token costs money, every interaction is metered — is one way to do it. But for a personal agent that knows my code, my patterns, my preferences, the local-first model makes more sense.

The model is mine. The data never leaves my machine. The inference is free after the initial investment. And the fine-tuning dataset — my actual code, my actual patterns, my actual style — is something no cloud provider can offer me.

That's worth exploring.
