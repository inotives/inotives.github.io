var e=`---
title: "Fusion Models: When One LLM Isn't Enough, Use Five"
date: 2026-06-24
tags: [fusion-models, trinity, sakanaai, fugu, openrouter, multi-agent, model-orchestration, ai-architecture]
summary: "Fusion models combine multiple specialized LLMs into a single coordinated system. SakanaAI's Fugu uses a 0.6B coordinator to orchestrate a pool of frontier models, matching or beating Fable 5 on benchmarks. The key insight: collective intelligence from diverse models outperforms any single model."
---

# Fusion Models: When One LLM Isn't Enough, Use Five

The industry has been chasing one goal: build a bigger model. More parameters, more training data, more compute. The assumption is that a single massive model will eventually do everything well.

Fusion models flip this. Instead of one model that does everything, you coordinate many models that each do one thing well.

SakanaAI's Fugu just proved this works. A 0.6B coordinator orchestrating a pool of frontier models matches or beats Fable 5 on benchmarks.

## What a Fusion Model Is

A fusion model isn't a single neural network. It's an orchestrator that coordinates multiple existing LLMs into a unified system. The user sees one API endpoint. Behind the scenes:

1. The coordinator receives the query
2. Analyzes the task type (coding, reasoning, knowledge)
3. Dynamically selects which models to activate
4. Assigns roles — Thinker, Worker, Verifier — to each
5. Manages multi-turn collaboration between them
6. Synthesizes the final answer

The difference from simple model routing: fusion models don't just pick the best model for a task. They coordinate multiple models simultaneously, each contributing different capabilities.

## TRINITY: The Coordinator That Learned to Delegate

Two ICLR 2026 papers laid the foundation. TRINITY uses a lightweight 0.6B coordinator trained with evolutionary optimization (not RL) to assign roles across a model pool:

- **Thinker**: Plans, reasons, strategizes
- **Worker**: Executes, generates code, implements
- **Verifier**: Checks, validates, catches errors

The coordinator assigns these roles dynamically, per turn. It doesn't just pick one model — it picks which model plays which role at each step.

The key result: 86.2% on LiveCodeBench, outperforming individual models across coding, math, reasoning, and domain knowledge.

The Conductor (second paper) goes further. A 7B model trained with RL discovers coordination patterns humans wouldn't design — communication topologies, dynamic role reassignment, even self-recursive loops where it reviews its own delegation decisions.

## Fugu: The Production Version

SakanaAI took these papers and built Fugu. Two tiers:

- **Fugu**: Balanced performance and latency, user-configurable model pool
- **Fugu Ultra**: Maximum quality, full fixed pool

The numbers:

| Benchmark | Fugu Ultra | Opus 4.8 | GPT 5.5 |
|---|---|---|---|
| SWE-Bench Pro | **73.7** | 69.2 | 58.6 |
| LiveCodeBench | **93.2** | 87.8 | 85.3 |
| GPQA-Diamond | **95.5** | 92.0 | 93.6 |
| TerminalBench 2.1 | **82.1** | 74.6 | 78.2 |

Fugu Ultra matches or beats Fable 5 — without using Fable 5 in its pool (it's not publicly accessible).

## Why This Works

**Diverse models have diverse blind spots.** Model A might be great at coding but weak at reasoning. Model B might be strong at math but weak at verification. A coordinator assigns tasks to the model best suited for each subtask.

**Coordination is a learnable skill.** TRINITY's hidden-state representations provide rich contextualization. The Conductor's RL discovers non-obvious communication patterns. The coordinator doesn't need to be large — 0.6B is enough.

**The whole exceeds the sum of parts.** Individual models have training biases and blind spots. A diverse pool reduces correlated errors. Multi-turn coordination catches mistakes that single-pass generation misses.

## Why This Might Be the Future

**No single-vendor dependency.** Fugu uses models from OpenAI, Anthropic, Google, Meta. If one provider has downtime or raises prices, the system adapts. Users can opt out of specific providers for compliance.

**Continuous improvement without retraining.** When a new frontier model releases, it can be added to the pool. Fugu aims for ~2 week turnaround. No need to retrain the entire system.

**Cost efficiency.** A 0.6B coordinator plus diverse pool is cheaper than training one massive model. Dynamic routing means cheap models handle simple tasks, expensive models handle hard ones.

**Export control evasion.** Fugu achieves frontier performance without using restricted models. The coordinator itself isn't subject to export controls.

## The Connection to Our Stack

TRINITY validates the thinker/worker/verifier pattern we've been building:

- mattpocock/skills provides the engineering discipline (the "how")
- ponytail provides the minimization (the "how little")
- git-conveyor orchestrates the pipeline (the coordination)

Fusion models take this further — the coordination itself becomes a trained skill. Instead of manually assigning roles, the coordinator learns which model plays which role at each step.

The question for us: when does it make sense to swap our single-model agents for a fusion approach? Probably when the task requires multiple capabilities that no single model handles well — deep reasoning plus fast execution plus careful verification.

## The Open Questions

- **Latency**: Multi-model coordination adds latency. Is it acceptable for real-time applications?
- **Reliability**: What happens when one model in the pool fails?
- **Cost at scale**: While individual requests may be cost-effective, what about high-throughput production?
- **Security**: Multi-provider coordination increases attack surface. How do you audit a system that uses 5 different models?

---

## References

- [TRINITY: An Evolved LLM Coordinator](https://arxiv.org/abs/2512.04695) — ICLR 2026 paper on evolved coordination
- [The Conductor: Learning Natural-Language Coordination](https://arxiv.org/abs/2512.04388) — ICLR 2026 paper on RL-trained orchestration
- [Sakana Fugu Technical Report](https://arxiv.org/abs/2606.21228) — Production fusion model architecture
- [Sakana Fugu](https://sakana.ai/fugu/) — Product page and benchmarks
- [OpenRouter Fusion](https://openrouter.ai/fusion) — Alternative fusion approach
`;export{e as default};