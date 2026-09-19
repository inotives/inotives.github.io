var e=`---
title: "CPU, GPU, TPU and NPU: Where Each Processor Fits in an AI System"
date: 2026-09-19
tags: [ai-infrastructure, machine-learning, gpu, tpu, npu]
series: building-ai-systems
summary: "CPUs coordinate an AI system; GPUs and TPUs supply parallel matrix compute; NPUs run efficient local inference. This guide explains how the processors differ, how work moves between them, and how to choose them for real production workloads."
---

AI systems are often described as if a model simply “runs on a GPU.” That is only part of the picture. A production workload needs code to receive a request, fetch data, tokenize text, schedule work, run model math, store results, and return a response. Different processors take different parts of that job.

The useful mental model is this:

- The CPU is the general-purpose coordinator.
- The GPU is the flexible parallel compute engine.
- The TPU is a specialized cloud accelerator for very large tensor workloads.
- The NPU is a power-efficient engine for sustained local inference.

They are complements more often than competitors. A cloud training stack may use CPU plus GPU *or* CPU plus TPU. A laptop can use CPU, integrated GPU, and NPU in the same application. The right choice comes from the shape of the workload, how much latency matters, where data is allowed to live, and how long the workload must run.

![A production AI system uses CPUs to coordinate data and requests, GPUs or TPUs for large model computation, and NPUs for efficient inference on edge devices.](/assets/images/cpu-gpu-tpu-npu-ai-system.png)

## Why neural networks need specialized compute

Most of the expensive work in a modern model is repeated matrix multiplication. During a transformer forward pass, the model multiplies a large batch of input activations by learned weight matrices, then applies operations such as attention, normalization, and activation functions. Training adds another pass to calculate gradients and update the weights.

This work has two awkward properties for a conventional processor: it is enormous, and much of it can happen in parallel. A CPU can do matrix multiplication, but it is built to execute varied programs quickly: database queries, operating-system work, branching business rules, API handlers, and file parsing. Its small number of powerful cores and large caches make it excellent at those tasks.

AI accelerators trade some of that flexibility for much more throughput on repeated numerical operations. Their performance still depends on memory bandwidth, data movement, model precision, batch size, and software support. A chip's quoted TOPS or FLOPS is not an application latency guarantee.

## CPU: the coordinator that is always in the system

A central processing unit executes general-purpose instructions. In an AI service, the CPU usually handles work before and after model execution:

- receive HTTP, gRPC, queue, or tool calls;
- authenticate the caller and apply rate limits;
- load data from object storage, databases, or caches;
- tokenize and validate prompts;
- schedule model batches and launch accelerator kernels;
- post-process model outputs, call tools, and write audit records.

Consider an internal document-extraction service. The CPU receives a PDF upload, checks tenant permissions, extracts pages, prepares image tensors, and submits them to an accelerator. After inference, it converts the returned fields into the business schema, marks uncertain fields for review, and writes the result to a database. The model math may dominate elapsed time, but the service still fails if the CPU-side work overloads, blocks, or leaks data between tenants.

CPUs also run workloads that do not map cleanly onto giant matrices: orchestration logic, irregular graph traversals, data parsing, small-batch jobs, and parts of a model that the accelerator runtime does not support. They are the host processor for most GPU and cloud-TPU deployments.

## GPU: high-throughput parallel compute with broad software support

A graphics processing unit has many smaller compute units that can apply the same operation across large groups of values. That design began with graphics, where many pixels need similar calculations, and it maps well to tensor operations in neural networks.

For AI teams, the GPU's major advantage is flexibility. The ecosystem supports a wide range of model architectures, custom kernels, quantization formats, training techniques, and serving runtimes. GPUs are common for:

- training and fine-tuning language, vision, speech, and multimodal models;
- serving high-throughput inference, especially with continuous batching;
- experimentation where model code changes often;
- local development and private inference on a workstation.

The trade-off is that a GPU is still a general-purpose parallel processor. It needs host coordination and careful movement of data between system memory and accelerator memory. A low-latency service can lose much of its theoretical speedup through tokenization, PCIe transfers, small batches, cache misses, or an overloaded request scheduler.

For a retrieval-augmented support assistant, a realistic split might be: CPU retrieves documents and creates the prompt; GPU produces tokens and optionally generates embeddings; CPU checks policies, invokes approved tools, and streams the answer to the user. The GPU is the expensive calculator, not the entire application.

## TPU: purpose-built tensor compute at cloud scale

A Tensor Processing Unit is Google's application-specific integrated circuit (ASIC) for machine-learning workloads. Cloud TPUs are designed around fast matrix operations. Their matrix multiplication units use a systolic-array design: multiply-accumulate values flow across a physical array of processing elements, reducing repeated trips to general memory during the core operation.

TPUs are a strong fit when a team has a large, regular tensor workload and can use the supported compiler and framework path. Google Cloud exposes them through TPU VMs, GKE, and Vertex AI. The XLA compiler transforms the computational graph for the accelerator, while the host machine runs the remainder of the program.

That makes TPUs attractive for large-scale training, large-batch inference, and workloads that scale across tightly connected chips. They are not a drop-in answer for every ML project. A custom operation, a highly dynamic model, or a toolchain built around GPU-specific kernels may be easier to run on GPUs. This is an engineering choice, not a race for the more specialized chip.

For example, a company training a recommendation model over billions of events may use CPUs to read, shuffle, and distribute the input pipeline, then send dense embedding and ranking calculations to a TPU slice. Training checkpoints, evaluation, experiment tracking, and feature-store writes still happen through the surrounding host and service infrastructure.

## NPU: local inference without treating the battery as disposable

A Neural Processing Unit is an accelerator integrated into many modern phones and PCs. It targets neural-network operations at low power, particularly workloads that run frequently or continuously on the device.

Its natural home is not usually frontier-model training. It is on-device inference: speech recognition, OCR, webcam effects, image classification, background transcription, and smaller language-model features. Keeping these tasks local reduces round trips to a cloud service and may keep sensitive audio, images, or text on the device.

An NPU has constraints. Models often need to be exported to an accepted format, quantized, and compiled for a specific execution provider. Some operators may fall back to the CPU or GPU. Memory capacity is far below a data-center accelerator. Measure the full user interaction, including model load time and fallback behavior, rather than assuming every “AI PC” workload will use the NPU.

On a Windows Copilot+ PC, Windows ML can select local execution providers for NPU, GPU, or CPU acceleration. The same application may use the NPU for background transcription while the CPU runs the UI and audio pipeline, and use a GPU for a heavier interactive generation task.

## How the processors work together

The division becomes clearest when following an end-to-end workflow.

| Stage | Typical processor | What happens |
| --- | --- | --- |
| Ingest and prepare | CPU | Read files or events, decode media, validate schema, tokenize text, and construct tensors. |
| Train or fine-tune | GPU or TPU, coordinated by CPU | Run forward and backward passes; exchange gradients across accelerators when distributed. |
| Evaluate and package | CPU plus accelerator | Run test prompts, calculate metrics, quantize or compile the model, and publish an approved artifact. |
| Cloud serving | CPU plus GPU or TPU | CPU handles requests, routing, batching, tools, and storage; accelerator runs the model. |
| Local feature | CPU plus NPU, sometimes GPU | CPU manages the app and data; NPU handles sustained efficient inference. |

The boundary is not static. A serving runtime can move simple preprocessing onto the GPU. An NPU runtime may use the CPU for unsupported operators. A cluster can place one part of a model on each of several GPUs or TPUs. The architecture needs observability across all of it: accelerator utilization, device-memory pressure, queue wait, CPU saturation, transfer time, tokens per second, and end-to-end latency.

## A practical design example: AI quality inspection

Imagine a factory quality-inspection system. Cameras capture product images all day. A cloud-only design would upload every frame, run a vision model remotely, then return a pass or fail result. That can work, but the network cost and latency can become painful.

With an edge-capable design:

1. The device CPU receives the camera stream, handles image decoding, and runs the local control application.
2. The NPU runs a compact defect-detection model continuously, using little power.
3. The CPU sends only ambiguous cases, samples, and audit metadata to the cloud.
4. A cloud GPU trains a better vision model from labelled review outcomes. A TPU could be used instead if the training workload and platform are designed for it.
5. The team validates, signs, and deploys a smaller compiled model back to the edge devices.

This is one AI system, not separate CPU, GPU, TPU, and NPU projects. Each processor has a role matched to its location and economics.

## How to choose without starting with the hardware

Start with the workload question.

| If you need to... | Start evaluating... | Watch for... |
| --- | --- | --- |
| Build an API, retrieval pipeline, or agent workflow | CPU capacity plus a hosted model or GPU service | The CPU-side queue, parsing, and tool latency may dominate. |
| Experiment with a new model or fine-tune widely supported frameworks | GPU | VRAM capacity, interconnect, cost per useful training step, and runtime maturity. |
| Train or serve large regular tensor workloads on Google Cloud | TPU | XLA compatibility, data pipeline design, topology, and compiler-friendly shapes. |
| Run a small model privately and continuously on a phone or PC | NPU | Model operator support, quantization quality, thermal behavior, and fallback path. |

The least glamorous part often decides the result. A model served by the fastest accelerator still feels slow if its CPU request queue is saturated, its vector database is remote, or its data transfer path is poorly designed. Profile the complete pipeline before buying hardware or reserving cloud capacity.

## The operating principle

CPU, GPU, TPU, and NPU describe different trade-offs between flexibility, parallel throughput, specialization, and power use. A robust AI system gives each one work that matches those trade-offs, then measures the hand-offs between them.

That is more useful than asking which processor is “best for AI.” The answer changes with the stage of the system, the model, the data boundary, and the product experience being delivered.

## References

- [Google Cloud TPU architecture](https://cloud.google.com/tpu/docs/system-architecture-tpu-vm)
- [Introduction to Cloud TPU](https://cloud.google.com/tpu/docs/intro-to-tpu)
- [Microsoft guide to NPU-powered Windows devices](https://learn.microsoft.com/en-us/windows/ai/npu-devices/)
- [Windows ML hardware acceleration overview](https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/overview)
`;export{e as default};