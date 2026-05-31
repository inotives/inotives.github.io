---
title: "Prompt Engineering: Tokenization, Structure, and Prompt-Optimizer Integration"
date: 2026-05-13
tags: [llm, tokens, prompt-engineering, prompt-optimization, mcp, data-workflows, ai-agents]
summary: "How LLMs translate prompts into tokens and use them to predict responses. How to structure effective prompts. How prompt-optimizer works and how it integrates into data workflows via MCP and API."
---

## How LLMs Translate Prompts into Tokens

LLMs do not read text. They read **token IDs** — integers that map to subword units. The pipeline:

**1. Tokenization.** The input string is split into tokens by a tokenizer (BPE for GPT models, SentencePiece for LLaMA, etc.). Each token is 1-4 bytes. Example with GPT-4 tokenizer:

```
"Hello, world!" → [15496, 11, 995, 0]
                → ["Hello", ",", " world", "!"]
```

A word like "unbelievable" might split into `["un", "belie", "vable"]` — three tokens. Common words like "the" are single tokens. The tokenizer is deterministic and never changes after training.

**2. Embedding lookup.** Each token ID is mapped to a dense vector (e.g., 4096 floats for a 7B-parameter model) via a learned embedding table. The sequence of vectors becomes a matrix of shape `(sequence_length, embedding_dim)`.

These vectors encode semantic relationships in the geometry of the embedding space. The classic example:

```
vector("king") - vector("man") + vector("woman") ≈ vector("queen")
```

The model has never seen a rule for this. It emerges from the co-occurrence patterns in training data — "king" and "queen" appear in similar contexts (throne, crown, royal), and the gender dimension is captured by the direction from "man" to "woman". You can query this direction directly: `vector("king") - vector("queen") ≈ vector("man") - vector("woman")`. The same pattern generalizes to hundreds of analogy types (capital-city, verb-tense, company-CEO).

**3. Transformer layers.** This matrix passes through N stacked transformer blocks (32 for a 7B model, 80+ for 70B+). Each block has two sub-layers: self-attention and feed-forward.

### Self-Attention (The "Look Around" Step)

Imagine you are proofreading a sentence and need to understand what "it" refers to. You scan backward to find the noun. Self-attention does this mathematically — every token computes how much attention to pay to every other token.

The mechanism uses three learned matrices per layer: **Query (Q)**, **Key (K)**, and **Value (V)**.

```
For a 3-token sentence ["The", "bank", "overflowed"]:

Token "bank" generates:
  Q_bank  → "what am I looking for?"
  K_the   → "what does 'The' contain?"    K_bank → "what does 'bank' contain?"    K_overflowed → "what does 'overflowed' contain?"

Attention score = Q_bank · K_each  (dot product, higher = more relevant)
  score(the) = 0.1     score(bank) = 0.8     score(overflowed) = 0.5

Softmax turns scores into probabilities:
  P(the) = 0.12        P(bank) = 0.55        P(overflowed) = 0.33

Final representation = weighted sum of Value vectors:
  bank_updated = 0.12·V(the) + 0.55·V(bank) + 0.33·V(overflowed)
```

Every token does this simultaneously. The result is a new matrix where each token's row now carries context-dependent meaning.

**The context-mixing example.** Same word, different neighbors:

```
Sentence A: "I walked to the bank to deposit money."
Sentence B: "The boat drifted toward the river bank."

After self-attention, the representation of "bank" in A is pulled toward
vectors for "money", "deposit" — financial domain.
In B, "bank" is pulled toward "river", "boat" — geographical domain.
```

This is why the same input token produces a different vector depending on its surroundings. Self-attention is the core mechanism that makes language models contextual rather than bag-of-words.

### Feed-Forward Network (The "Think" Step)

After self-attention, each token's vector passes through a wide multilayer perceptron independently. The FFN does not mix tokens — it transforms each one separately, adding non-linear pattern matching:

```
bank_updated → FFN → bank_refined
```

Where the FFN consists of two learned weight matrices sandwiching a non-linear activation (ReLU, GELU, or SwiGLU). Think of it as: "given this context-aware representation, what concept should I extract or generate next?" The FFN stores the model's factual knowledge — dates, facts, language patterns — encoded in its weights.

### The Stack

A 7B-parameter model stacks 32 of these blocks. The output of block 1 feeds into block 2, which feeds into block 3, and so on. Early layers handle syntax and local context ("This verb matches that subject"). Middle layers handle semantics ("bank is a financial institution here"). Later layers handle long-range reasoning and output planning.

Each layer has learned weights (the "parameters" of the model). No loops, no recursion — pure matrix multiplication with activations.

**4. Next-token prediction (the output head).** The final layer's output for the last position is projected through a `(embedding_dim, vocab_size)` matrix to produce a **logit** for every token in the vocabulary. These logits are normalized by softmax into probabilities:

```
P(next_token | "Hello, world") = [0.02, 0.001, ..., 0.15, ...]
                                    "The"      "A"       "!"
```

**5. Sampling.** The probability distribution is sampled (greedy, top-k, top-p, temperature) to pick the actual next token. That token is appended to the input, and steps 2-5 repeat until an `<EOS>` token or maximum length is reached.

This is why LLMs are called **autoregressive**: each token is generated conditioned on *all previous tokens*, one at a time. The model uses **causal (left-to-right) attention** — token at position i can only attend to tokens at positions ≤ i. No information flows from future tokens backward.

Concrete trace for the prompt "The cat sat":

```
Step  Input tokens (left → right)    Prediction (next token)
────  ─────────────────────────────   ─────────────────────
  1   [The]                           → " cat"  (P=0.45)
  2   [The, " cat"]                   → " sat"  (P=0.38)
  3   [The, " cat", " sat"]           → " on"   (P=0.22)
  4   [The, " cat", " sat", " on"]    → " the"  (P=0.51)
  5   [The, " cat", " sat", " on", " the"] → " mat" (P=0.33)
  6   [The, " cat", " sat", " on", " the", " mat"] → "." (P=0.72)
  7   [The, " cat", " sat", " on", " the", " mat", "."] → "" (EOS)
```

At each step, the entire sequence up to that point is reprocessed through all transformer layers — there is no cached state reuse unless explicit KV-caching is implemented. The probability distribution at step 1 assigns some mass to " cat", " dog", " bird", " fish", etc. Only after " cat" is sampled and appended does the model compute the next step with the new context. " sat" only becomes the most likely continuation once the model has seen "The cat".

This left-to-right causal constraint is what separates generative LLMs from masked language models like BERT (which attend to both directions). It is also why prompt ordering matters — earlier tokens have more opportunities to influence later attention patterns.

## Why Token Count Matters

Every API call charges by tokens. More important: the **context window** is finite. Once the cumulative sequence exceeds the window (4K, 8K, 128K tokens depending on model), earlier tokens are truncated or lost. This is the bottleneck in every agentic workflow.

| Model | Typical context | Max prompt tokens for a 2K response |
|---|---|---|
| GPT-4o | 128K | 126K |
| Claude 3.5 Sonnet | 200K | 198K |
| DeepSeek-V3 | 64K | 62K |
| LLaMA 3.1 8B | 8K | 6K |

For agentic workflows, the context window fills fast — system prompt (2-5K), conversation history (5-50K), tool outputs (1-20K per turn). Every turn eats context. Token efficiency is not a nice-to-have; it determines whether a session survives 5 turns or 50.

## How to Structure a Good Prompt

Effective prompts follow a small number of structural patterns. These are not opinions — they are empirically validated against the transformer architecture's properties.

### The Anatomy

A well-structured prompt has four parts:

**Role + Context.** Define who the model is and what situation it is in. This activates the relevant parts of the training distribution:

```
You are a senior data engineer at a fintech company.
You are reviewing a SQL query that joins 12 tables.
```

Without the role, the model defaults to a generic assistant distribution — less precise, more hedging.

**Task instruction.** State what to do. Be specific. The model has no theory of mind — it cannot infer what you *actually* want if you ask vaguely:

```
Bad:  "Fix this query."
Good: "Rewrite this query to reduce join count. Maintain the same result set.
       Use CTEs instead of subqueries where it improves readability."
```

**Constraints.** Format, length, tone, things to avoid. These act as sampling-time guards:

```
Return only valid JSON with keys: table_name, row_count, estimated_cost.
No markdown. No explanation. JSON only.
```

**Examples (few-shot).** Show 1-3 input-output pairs. For the transformer, examples are not just hints — they shape the in-context learning dynamics by biasing attention patterns toward the desired output distribution:

```
Input: SELECT * FROM users JOIN orders ON users.id = orders.user_id
Output: SELECT u.*, o.order_date FROM users u JOIN orders o ON u.id = o.user_id
```

### Token Efficiency Tactics

Since context is finite, every token in the prompt must earn its place:

| Tactic | Token savings | Mechanism |
|---|---|---|
| Single-letter initials for roles | ~50% on role block | "SE" instead of "Senior Engineer" |
| Compressed instruction style | 30-60% | Eliminate articles, use active voice |
| One example instead of three | 40-100 tokens | Fewer in-context exemplars |
| No pleasantries | 10-30 tokens | Skip "Please", "I would like you to" |
| Syntax over prose | 20-50% | Use bullet lists, tables, JSON |

The `/caveman` skill formalizes this: drop articles, use active voice, one statement per line. For systems running at scale (batch processing, agent loops), these savings compound.

### What Wastes Tokens

**Over-explaining.** The model was trained on terabytes of text — it knows what a JOIN is. You do not need to explain SQL basics.

**Repeating instructions.** The attention mechanism already covers the full prompt. Repeating the same constraint in different wording does not reinforce it; it dilutes the signal-to-noise ratio.

**Chain-of-thought boilerplate.** "Let's think step by step" costs 5 tokens and adds nothing if the task does not require reasoning decomposition. Save CoT for multi-step reasoning problems.

## How prompt-optimizer Works

[prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) (30K+ stars) is a tool that takes a rough prompt and returns an improved version — like a linter for prompts, but powered by an LLM evaluator loop.

### Architecture

```
User prompt  →  LLM evaluator  →  optimized prompt
                    ↑
               scoring criteria (clarity, specificity, constraints, format)
```

It is a pure frontend application (Vue + TypeScript). All data stays in the browser. No prompt text is sent to a central server — the optimization happens by calling the user's configured LLM API (OpenAI, Gemini, DeepSeek, Grok, etc.) directly from the browser.

### Core Features

**Dual mode optimization.** Two separate tools for the two parts of a prompt:

- `optimize-system-prompt` — rewrites the system instruction (role, context, behavior rules)
- `optimize-user-prompt` — rewrites the user query (task, constraints, examples)

**Iterative refinement loop.** The evaluator scores the optimized prompt and decides whether to iterate again. Three strategies:

- **Analysis** — scores the prompt on multiple axes (clarity, specificity, completeness)
- **Single evaluation** — rates the output quality of the original vs optimized prompt
- **Compare evaluation** — runs two or more optimized versions side-by-side

**Variable management.** Prompts can contain `{variable}` placeholders that get filled at test time. This turns a generic prompt skeleton into a reusable template:

```
You are a {role}. Summarize this {document_type} in {language}.
```

**Multi-turn conversation testing.** Simulates a full conversation with a prompt as the system instruction. Tests how the prompt holds up over multiple exchanges — many prompts degrade after the first turn because the model's attention dilutes.

**Image generation mode.** The same optimizer works for text-to-image prompts (T2I), adding subject cues, spatial relationships, and mood anchors that image models respond to.

### What It Does Not Do

prompt-optimizer does **not** rewrite your prompt with the goal of reducing token count. It adds structure, constraints, and specificity — which often *increases* token count. The tradeoff is acceptable because a well-structured prompt produces correct output on the first try, avoiding costly retry loops that burn far more tokens than the prompt itself.

It also does not run server-side inference. All LLM calls go directly from the browser to the provider's API. This means:

- No prompt data ever touches a third-party server
- You bring your own API keys
- Works fully offline in the desktop app

## Integrating prompt-optimizer into Data Workflows

Prompt optimization is not a one-shot task in data engineering. Pipelines change, schemas evolve, and the "right" prompt for a data extraction job last quarter may produce garbage today. prompt-optimizer fits into data workflows at several integration points:

### Via MCP (Model Context Protocol)

prompt-optimizer exposes an MCP server at `/mcp` (Docker) or `localhost:3000/mcp` (dev). Three tools:

| Tool | What it does | Data workflow use case |
|---|---|---|
| `optimize-user-prompt` | Rewrites a user query | Optimize extraction queries for new data sources |
| `optimize-system-prompt` | Rewrites system instruction | Tune agent behavior for a specific pipeline |
| `iterate-prompt` | Iterative refinement | A/B test prompt variants against ground truth |

Integration with Claude Desktop (and any MCP-compatible client):

```json
{
  "services": [{
    "name": "Prompt Optimizer",
    "url": "http://localhost:8081/mcp"
  }]
}
```

### Via Docker for Pipeline-adjacent Deployment

Run prompt-optimizer as a sidecar alongside your data pipeline:

```bash
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=sk-... \
  -e ACCESS_PASSWORD=your-password \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

The web UI is at `localhost:8081`. An agent or script can call the MCP endpoint at `localhost:8081/mcp` to optimize prompts programmatically.

### In an Agentic Data Pipeline

A concrete workflow for a daily data extraction pipeline:

1. **Source discovery** — new API endpoint or database table is added
2. **Draft prompt** — a seed prompt is written: "Extract {columns} from {source} where {condition}"
3. **Optimize** — the seed prompt is sent to prompt-optimizer via MCP. The optimizer adds missing constraints (date range, pagination, error handling, null handling)
4. **Evaluate** — run the optimized prompt against a test query to verify it produces correct output
5. **Store** — save the prompt as a Prompt Garden asset or in version control
6. **Monitor** — weekly, re-optimize against the latest schema. If the data source changes, the optimizer surfaces the drift

### What the Integration Costs

- **Latency**: Each optimization call adds ~2-10 seconds (one LLM round trip)
- **Tokens**: The optimizer uses ~500-2000 tokens per optimization call
- **API cost**: At GPT-4o pricing, ~$0.01-0.10 per optimization

For a pipeline running 50 extraction jobs daily, optimizing all prompts once a week costs ~$2-5/month in API calls. The alternative — debugging a broken prompt at 3 AM — costs far more in engineering time.

## Comparison to Other Approaches

| Approach | Token efficiency | Prompt quality | Automation |
|---|---|---|---|
| Manual writing | Variable | Depends on skill | None |
| Template libraries (LangGPT) | Good | Good for common patterns | Static |
| prompt-optimizer | Worse (adds tokens) | Best | MCP/API integration |
| LLM-as-judge (inline) | Worst (double cost) | Comparable | Scriptable |

prompt-optimizer trades slightly higher token cost for significantly better prompt quality. The tradeoff makes sense when the optimized prompt is reused many times (e.g., a system prompt for an agentic data pipeline) rather than for one-shot queries.

## Summary

Tokens are the currency of LLM interaction. Every prompt competes for space in a finite context window with conversation history, tool outputs, and instructions. Good prompt structure — role, task, constraints, examples — improves output quality without additional compute. prompt-optimizer automates the refinement of that structure, and via MCP or Docker, it slots into data pipelines as a prompt-quality gate before any expensive extraction or transformation step.

## Sources

- prompt-optimizer: https://github.com/linshenkx/prompt-optimizer
- MCP Server Guide: https://github.com/linshenkx/prompt-optimizer/blob/develop/docs/user/mcp-server_en.md
- Prompt Garden: https://garden.always200.com
- Prior evaluation — RTK (token compression): /posts/2026-05-19-rtk-token-killer-for-agentic-workflows
- Prior evaluation — playwright-cli (CLI vs MCP token efficiency): /posts/2026-05-25-playwright-cli-for-data-work
