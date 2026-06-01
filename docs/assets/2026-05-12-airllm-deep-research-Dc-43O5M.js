var e=`---
title: "AirLLM: Running 70B Models on a 4GB GPU (But Pack a Lunch)"
date: 2026-05-12
tags: [airllm, llm-inference, local-llm, ollama, llama-cpp, apple-silicon, open-source, gpu]
summary: "AirLLM streams model layers from disk to fit 70B+ LLMs on tiny GPUs. The mechanism is clever. The speed is ~0.7 tok/s. Here's how it works, when it makes sense, and when to reach for Ollama instead."
---

## The Promise

AirLLM's README makes a claim that stops you in your tracks: *"70B large language models to run inference on a single 4GB GPU card without quantization, distillation and pruning. And you can run 405B Llama 3.1 on 8GB VRAM now."*

A 70B model in FP16 takes ~130GB of VRAM. A 405B model takes ~800GB. The idea of running either on a laptop GPU sounds like marketing copy.

But the mechanism is real, the code is open source (Apache-2.0, 17.6k stars), and the author — Gavin Li, founder of Anima AI, ex-Airbnb senior AI lead — is transparent about the trade-off. The question is whether the trade-off is worth it for what you're trying to do.

## The Trick: Layers Are Sequential, So Load Them One at a Time

The insight is almost too simple: during inference, transformer layers execute one after another. The output of layer N is the input to layer N+1. Only one layer computes at a time. So why keep all 80 layers in VRAM?

AirLLM initializes the model on HuggingFace Accelerate's \`meta\` device — structure only, no weights allocated. Then for each generated token, it cycles through every layer:

1. Load layer 1's safetensors shard from disk into GPU
2. Forward pass, retain only the activations
3. Free layer 1 from GPU memory
4. Load layer 2, repeat, all the way to layer 80
5. Sample the next token, append to KV cache, start over

For a 70B model with ~80 layers and 130GB total, each layer is about **1.6GB**. The KV cache at 100 tokens is ~30MB. Peak GPU usage stays well under 4GB. The math checks out.

The first run decomposes the original HuggingFace checkpoint into one safetensors file per layer — a process that's "very disk-consuming" per the README. After that, each token step reads each layer sequentially from disk.

## The Performance Reality

Here's where the promise meets physics. Reading 80 sequential files from disk for every single token is slow.

| Setup | Speed |
|-------|-------|
| NVMe SSD + consumer GPU, 70B | **~0.7 tok/s** |
| Google Colab T4, 70B | **~1 token/minute** |
| M4 MacBook Pro, Mistral 7B (MLX) | **~10 min/prompt** |
| Batch 50 prompts amortized | ~5.3 sec/tok (vs 35 sec/tok single) |
| **llama.cpp Q4_K_M, 70B, same hardware** | **8–15 tok/s** |

The comparison that matters: AirLLM is **10-20× slower than llama.cpp with Q4 quantization** on the same hardware. The 3× speedup from AirLLM's 4-bit block compression comes from smaller disk reads, not faster compute — the inverse of how llama.cpp uses quantization.

The author's own framing on Hacker News: *"Not fast, not a good fit for realtime interaction applications, but for offline data processing cases, it works perfectly."*

## What It Actually Supports

The model coverage is real but frozen. Last functional commit was September 2024 (Qwen2.5 support). Everything since is README fixes and funding.json touches.

| Supported | Not Supported |
|-----------|---------------|
| Llama 1/2/3/3.1 (incl. 405B) | Llama 3.2 Vision, Llama 4 |
| Qwen / Qwen2 / Qwen2.5 | Qwen3 (open issues requesting it) |
| Mistral / Mixtral | DeepSeek V3 / R1 (no module exists) |
| ChatGLM, Baichuan, InternLM | Any multimodal model |

If your model shipped after August 2024, AirLLM likely doesn't support it.

## The Verdict

**Use AirLLM when:**
- You literally cannot fit the model at any quantization (e.g., 405B on consumer hardware)
- You need full FP16 precision for research where quantization would confound results
- You're running an overnight batch job (dataset labeling, bulk PDF analysis) and don't care about latency
- You want the bragging rights of "I ran 70B on my laptop" at ~1 tok/min

**Do not use AirLLM when:**
- You want interactive chat — this is disqualifying
- You need production serving — use vLLM or TGI
- You're on Apple Silicon and want speed — use MLX directly or llama.cpp's Metal backend
- You need modern models like DeepSeek V3, Qwen3, or Llama 4 — not supported

**The pragmatic default for 90% of local inference needs is Ollama + llama.cpp with Q4_K_M quantization.** It's 10-20× faster, supports vastly more models, has an active ecosystem, and runs on the same hardware. AirLLM is a niche tool for the edge case where "I literally cannot fit this model any other way" meets "and I am OK waiting."

If you do use it, batch your prompts. A batch of 50 amortizes the per-token layer-load cost from 35 seconds to about 5 seconds per prompt — still slow, but usable for overnight jobs.

And check your disk. NVMe is essential, SATA SSD is painful, and HDD is unusable. Every token is 80+ sequential reads. A 1000-token generation job reads roughly 128GB from disk — plan accordingly.
`;export{e as default};