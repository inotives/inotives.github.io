---
title: "What Are Agent Harnesses?"
date: 2026-05-02
tags: [agent-harness, ai-agents, multi-agent, skills, workflow, developer-tools]
summary: "A survey of the agent-harness landscape: what defines a harness, why the abstraction matters, and the top open-source harnesses worth knowing."
---

## What Are Agent Harnesses?

An agent harness sits between the LLM and the tools. It is the runtime that manages an agent's lifecycle: receiving a task, maintaining persona and memory state, resolving tool permissions, routing sub-tasks, and returning results.

The clearest definition comes from OpenHarness: *"Tools + Knowledge + Observation + Action + Permissions."* Those five axes describe what a harness does:

- **Tools** — what the agent can use (shell, file, web, MCP servers)
- **Knowledge** — what the agent knows (memory, documents, graph data)
- **Observation** — what the agent sees (tool outputs, file contents, environment state)
- **Action** — what the agent does (code execution, tool calls, sub-agent delegation)
- **Permissions** — what the agent is allowed to do (sandboxing, approval gates, confinement)

A harness is not a model provider. It is not a framework. It is the runtime shell that makes an agent more than a stateless chat completion.

## Why They Matter

Raw LLM calls produce text. Agent harnesses turn text into action. They matter for three reasons:

**1. Persistence beyond the context window.** Without a harness, an agent loses state when the conversation ends. Harnesses manage memory blocks (Letta's `human` + `persona`, Hermes' `MEMORY.md`), session history, and tool state across restarts.

**2. Multi-persona routing.** A single harness can serve multiple agent personas — a coding agent, a research agent, a scheduling agent — each with its own tools, memory, and permissions. The harness routes tasks to the right persona.

**3. Safety and containment.** Agentic code execution (writing files, running shell commands, calling APIs) is inherently dangerous. Harnesses enforce sandboxes, permission gates, and audit logs. Without a harness, every tool call is a security gamble.

## The Landscape

The agent-harness space has consolidated around a few clear archetypes. Here are the top open-source harnesses as of early 2026, grouped by design philosophy.

### Personal Multi-Channel Harnesses

These are harnesses built for a human owner to assign tasks across messaging channels.

| Tool | Lang | Stars | Channels | Key idea |
|---|---|---|---|---|
| **Hermes Agent** | Python | 129k | 8+ (Telegram, Discord, Slack, etc.) | Self-improving personal agent; `agentskills.io` skill standard; 6 isolation backends; `SOUL.md` persona file |
| **OpenClaw** | TypeScript | 367k | 22+ | Three-file workspace injection (`AGENTS.md` / `SOUL.md` / `TOOLS.md`); channel-to-agent routing; sandboxed sessions |
| **OpenHarness** | Python | 11.7k | 4+ (Feishu, Slack, Telegram, Discord) | Research-grade harness; 43 built-in tools; streaming loop with permission checks; auto-compaction |

Hermes and OpenClaw are the most architecturally mature. Both share the `SOUL.md` persona convention and treat skills as plain-text files. OpenHarness is smaller but gives the cleanest definition of what a harness *is* — worth reading its source even if you do not use it.

### Multi-Agent Frameworks

These focus on multiple agents collaborating on tasks, rather than a single personal assistant.

| Tool | Lang | Stars | Key idea |
|---|---|---|---|
| **CrewAI** | Python | 50.5k | Role-based agents with YAML-defined personas; `Crew/Agent/Task` triad; sequential or hierarchical delegation |
| **AutoGen** | Python | 57.6k | Multi-agent conversations via `GroupChatManager`; now in **maintenance mode** (Microsoft moved to Agent Framework) |
| **smolagents** | Python | 27k | ~1000 LOC agent core; code-as-tool philosophy (agents write Python, not JSON); HuggingFace |

CrewAI's `Task` as a first-class object (with description, expected output, assigned agent, dependencies) is the clearest task-abstraction pattern in OSS. smolagents is the reference for "what does a minimal harness look like" — read its source first if you want to understand harness internals.

### Memory-First Harnesses

| Tool | Lang | Stars | Key idea |
|---|---|---|---|
| **Letta** | Python | 22.4k | Memory blocks as labeled sections (`human`, `persona`); server/client model; MemGPT lineage — the original "give the LLM tools to manage its own context window" |

Letta's labeled memory blocks are the most principled approach to agent persistence. Treating persona and user-model as structured blocks (not strings concatenated into a system prompt) is the difference between an agent that "remembers" and one that just has a long context.

### Full-Platform Harnesses

| Tool | Lang | Stars | Key idea |
|---|---|---|---|
| **OpenHands** | Python+TS | 72.5k | Microagents (persona+knowledge bundles triggered by keywords); Action/Observation primitive; sandboxed Docker runtime; SDK + CLI + GUI |
| **Eliza** | TypeScript | 18.3k | Character files for declarative personas; plugin ecosystem; multi-platform clients (Discord, Telegram, Farcaster, Tauri desktop) |
| **Goose** | Rust+TS | 43.7k | Rust core with minimal overhead; Recipes as task templates; 70+ MCP extensions; Linux Foundation governance |

OpenHands' **microagent** convention — markdown files with frontmatter triggered by keywords — is the highest-fidelity match to "personas with skills" in a single file. Goose's **Recipes** are the closest OSS analog to a reusable task template library.

## Convergent Patterns

Across all ten harnesses, a few design patterns are converging:

1. **Plain-text skills.** Every major harness uses file-based skills (`SKILL.md`, `agentskills.io`, anthropics/skills). The format differs, but the concept is universal: skills are portable text files, not code plugins.

2. **Persona as a file.** `SOUL.md` (Hermes, OpenClaw), character files (Eliza), microagents (OpenHands), YAML role configs (CrewAI) — all encode the agent's identity in a structured document.

3. **Memory blocks, not chat history.** Labeled memory sections (Letta's `human` + `persona`, Hermes' `MEMORY.md` + `USER.md`) replace raw context-window concatenation.

4. **MCP as the universal tool layer.** Seven of the ten harnesses support the Model Context Protocol. MCP has become the standard bridge between agent runtimes and external tools.

5. **Sandboxed execution.** Every harness that runs agent code does so in an isolated backend — Docker, SSH, serverless containers. Local-only execution is the exception, not the default.

## MCP vs CLI: The Tool-Calling Surface

A harness's most consequential design decision is how agents call tools. Two surfaces dominate: MCP (Model Context Protocol) and CLI (shell commands). The trade-offs are not academic — they determine token budgets, composition patterns, and the security model of everything the agent touches.

### The Token Tax

MCP carries a real, measurable overhead. The official GitHub MCP server defines 93 tools consuming roughly 55,000 tokens of context. Against Claude's 200K window (minus ~24K system prompt), that burns ~31% of the budget before any real work.

CLI sidesteps this entirely. There is one `Bash` tool definition. `gh --help` is paid for only when the agent runs it. A controlled benchmark by Mornati measured identical GitHub operations across four modalities:

| Surface | Fixed schema cost |
|---|---|
| CLI (raw `gh`) | 0 tokens |
| CLI + on-demand skill file | ~480 tokens |
| Native MCP (`github-mcp-server`) | ~3,062 tokens, always present |
| Gateway MCP (Nexus) | ~20 tokens |

For a 20-prompt session with 2 GitHub operations, the totals were 448 (CLI) vs 61,654 (Native MCP) tokens. CLI was ~138x cheaper.

The structural reason: MCP requires the host to enumerate every tool's name, description, and JSON Schema in the system prompt before the model can decide which to call. CLI defers that cost to the moment of use.

### Where Each Wins

**CLI wins when** a capable CLI already exists (`gh`, `aws`, `kubectl`, `git`, `jq`), composition matters (pipes, redirects, `xargs`), and the model already knows the tool from training data. The Unix decomposition has been done — 50 years of pre-built composability the model gets for free.

**MCP wins when** the service has no good CLI (most SaaS APIs), output is structured JSON the agent will reason over, the capability is genuinely remote and needs auth per call, or cross-platform support is required.

### The Convergent Fix

The industry is converging on a hybrid: MCP for transport and auth, code as the agent-facing interface, the filesystem as the lazy-loading mechanism. Anthropic ("Code execution with MCP"), Cloudflare ("Code Mode"), and Skills all push capabilities to disk and let the agent load them on demand — essentially making MCP behave more like CLI. The agent has one or two general tools (`bash`, `execute_code`) and reads capability docs from files when needed.

### Security

CLI's security model is well-understood: the shell can do anything, so the harness gates the shell. Blast radius is "your shell user." MCP introduces novel attack surfaces — tool-shadowing, rug-pull mutations (a tool's definition changes post-install without notice), and prompt injection via tool descriptions. The MCP spec itself flags tool descriptions as untrusted.

For harness builders, the practical takeaway is: prefer CLI for local, well-known tools; use MCP for remote services where structured I/O and auth matter; but always gate both through the harness's permission layer.

## Which One to Pick

The answer depends on what you need:

- **Personal assistant across messaging channels** → Hermes Agent or OpenClaw
- **Multi-agent research / task orchestration** → CrewAI
- **Understanding what a harness is at the code level** → smolagents source (~1000 LOC)
- **Memory as a first-class feature** → Letta
- **Lightweight, extensible, Linux Foundation-backed** → Goose
- **Full platform with SDK + cloud** → OpenHands

For my own work, the practical split is: Hermes for daily personal-agent use, smolagents as a reference for understanding harness internals, and the `SOUL.md` / `SKILL.md` conventions as a portable standard that crosses ecosystems.

## Sources

- Hermes Agent: https://github.com/NousResearch/hermes-agent
- OpenClaw: https://github.com/openclaw/openclaw
- OpenHarness: https://github.com/HKUDS/OpenHarness
- CrewAI: https://github.com/crewAIInc/crewAI
- Letta: https://github.com/letta-ai/letta
- Eliza: https://github.com/elizaOS/eliza
- AutoGen: https://github.com/microsoft/autogen
- OpenHands: https://github.com/All-Hands-AI/OpenHands
- Goose: https://github.com/block/goose
- smolagents: https://github.com/huggingface/smolagents
