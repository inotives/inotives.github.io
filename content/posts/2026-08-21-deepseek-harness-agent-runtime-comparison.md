---
title: "DeepSeek Harness: A Plugin-First Agent Runtime Compared with Hermes, Pi, and OpenCode"
date: 2026-08-21
tags: [ai-agents, agent-harness, deepseek, coding-agents, open-source]
summary: "DeepSeek Harness treats the model loop, tools, storage, sandbox, and agent teams as replaceable plugins. This article examines that design and compares it with Hermes Agent, Pi, and OpenCode across models, skills, loops, multi-agent work, safety, and deployment."
series: building-ai-systems
---

The recent [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) release is easy to misread as one more coding-agent CLI. It is closer to a runtime for constructing an agent product. Its central idea is that the model adapter, tool registry, session log, agent loop, storage backend, and sandbox are all plugins. If one of those choices stops fitting, the intended move is to replace a plugin, not fork a monolith.

That makes it an interesting comparison with the agent harnesses many developers already use. [Hermes Agent](https://github.com/NousResearch/hermes-agent) aims to be a persistent, self-improving personal agent. [Pi](https://github.com/earendil-works/pi) is a small, extensible agent toolkit and coding CLI. [OpenCode](https://github.com/anomalyco/opencode) is a configurable open-source coding agent with first-class agents, skills, MCP, and permissions.

All four can drive a model through tool calls. The more useful question is: where does each project expect you to put the policy that controls those calls?

## The short version

Choose DeepSeek Harness when the harness itself is the product surface you need to change. Choose Hermes when you want a long-running personal agent with memory, skills, scheduling, and messaging already assembled. Choose Pi when you want a compact core and are happy to compose your own workflow. Choose OpenCode when the immediate job is a configurable coding agent for people and repositories.

None of these labels mean the others cannot be extended. They describe the default shape of the work.

| Project | Default shape | Best fit |
| --- | --- | --- |
| DeepSeek Harness | Plugin-composed agent runtime | Teams building or embedding a custom agent product |
| Hermes Agent | Persistent personal agent platform | An assistant that works across sessions and messaging channels |
| Pi | Minimal agent toolkit and coding CLI | Developers who want a small core and explicit extensions |
| OpenCode | Configurable coding agent | Repository-focused coding, review, planning, and tool policy |

## What DeepSeek Harness is building

DeepSeek calls the project a developer preview, which is an important qualifier. The repository has a web profile and a headless profile, but the interesting part is underneath: it starts from Cordis, a plugin framework in which services and their effects can be mounted, replaced, and unloaded.

At boot, a DeepSeek Harness profile stacks bundles. The base bundle provides the model adapters, tools, persistence, sandbox and approval policy, credentials, settings, and telemetry. A web bundle adds the browser application. A headless bundle adds a one-shot runner. A profile can then apply its own configuration patch, followed by a home-level patch or command-line overlay.

That gives a team a useful kind of control. A local development profile might use a local filesystem and shell, a permissive policy, SQLite session storage, and a cheap model. A production profile can use a remote sandbox, an approval policy, telemetry, a different model adapter, and the same agent-facing tool contract.

The harness does not treat this as a collection of environment flags. The composed plugin tree is the application. `dsh --dump-config` can show the tree that actually booted, which makes a configuration review more concrete than hunting through a mixture of source files and shell variables.

## A loop that is visible and interceptable

Most agent harnesses have the same basic loop:

```text
assemble context -> call model -> run requested tools -> append results -> repeat
```

DeepSeek Harness documents this lifecycle more precisely. A turn can contain multiple steps. A step is one model request plus its tool calls. Before each step, plugins can inspect or rewrite the admitted messages; they can also stop the turn. Tool calls pass through pre-execute, execute, and post-execute events. The next step happens only when a tool result or queued input makes another model call necessary.

This matters when policy needs to live inside the loop rather than beside it. Suppose an agent investigates an exchange-price disagreement. Before the first tool call, a plugin can inject the current run ID and approved data-contract version. Before a SQL tool runs, a policy plugin can reject raw-table access and permit only a documented mart. After the result returns, a logging plugin can store the tool input, result reference, policy decision, and session event together.

```text
agent asks: "Why did BTC/USDT providers disagree?"
  -> context plugin adds run_id and approved marts
  -> model requests get_price_disagreement(run_id)
  -> policy plugin checks the tool schema and caller permission
  -> tool returns the provider values and gap in basis points
  -> session log records the prompt, call, result, and decision
  -> model writes an explanation with evidence it can cite
```

The important boundary is the contract. The agent receives `get_price_disagreement`, not unrestricted access to whatever production table happens to contain a price today.

## Session logs as a source of truth

DeepSeek Harness makes a strong architectural claim: anything visible to the model must be reconstructable from the session log. It projects the model message history from that log; forks, resumes, transcripts, telemetry, and persistence derive from the same event stream.

That is a good default for agents that affect real systems. It makes a run replayable and gives a reviewer somewhere to look when the agent took an unexpected action. It also puts pressure on extension authors to record context injection, tool results, and state changes as durable events instead of hiding important state in process memory.

This resembles the data-engineering discipline of keeping raw evidence and traceable transformations. An agent answer is a downstream mart. The session event stream is part of the lineage.

## Models: adapter breadth versus a fixed menu

DeepSeek Harness ships a DeepSeek adapter and a `pi-ai` adapter. The latter is significant because Pi's model library has a broad provider catalogue and supports custom providers that speak supported APIs. In DeepSeek Harness, model choice is therefore an adapter and configuration question rather than a narrow list hard-coded into the loop.

Hermes also presents a broad provider story. Its documentation lists Nous Portal, OpenRouter, OpenAI, self-hosted endpoints, and other providers, with a model switch command rather than a source change. Pi has the widest explicitly documented catalogue in this comparison, including hosted providers, subscriptions such as Claude and ChatGPT/Codex, DeepSeek, OpenRouter, and local llama.cpp routing. OpenCode has a large provider directory, supports custom OpenAI-compatible providers, and documents local options including Ollama and llama.cpp.

| Project | Model approach | Local and custom model posture |
| --- | --- | --- |
| DeepSeek Harness | Swappable LLM adapters; bundled DeepSeek and Pi AI adapters | Determined by the configured adapter; the Pi AI route brings broad provider coverage |
| Hermes | Provider configuration and runtime model switching | Self-hosted endpoints are part of the documented model story |
| Pi | Unified model API with a maintained provider catalogue | Native llama.cpp routing; custom provider definitions and extensions |
| OpenCode | Provider directory plus `provider/model-id` configuration | Ollama, llama.cpp, custom compatible providers, and per-model context limits |

Breadth alone is not the deciding factor. A local model that cannot reliably call the required tools is usually a worse operational choice than a smaller hosted model with good structured-output behaviour. Test the real loop: malformed tool arguments, long tool results, a denied action, and a retry after a provider timeout.

## Skills are different kinds of extension

The word "skill" means different things across these projects.

DeepSeek Harness has a skill service, a filesystem-backed skill catalogue, and a model-facing skill tool. Skills can be discovered and rendered into the model's available catalogue, while the deeper behaviour still comes from plugins and service seams. That is a useful split: a skill can be a portable procedural instruction, while a plugin can change runtime behaviour such as an LLM adapter, permission policy, or session store.

Hermes treats skills as procedural memory. Its built-in learning loop can create and improve skills from prior work, and it supports the Agent Skills standard. This makes sense for a personal assistant that should get better at recurring tasks across sessions.

Pi supports skills, prompt templates, JavaScript/TypeScript extensions, and installable Pi packages. Its default coding agent starts with only `read`, `write`, `edit`, and `bash`; everything else is intentionally optional. Pi's maintainers explicitly leave MCP, subagents, plan mode, permission popups, and background shell execution out of the core, expecting users to add the behaviour they want.

OpenCode discovers `SKILL.md` files from project and user-level locations, including `.opencode`, `.claude`, and `.agents` directories. It can constrain which skills an agent may load with permissions. That makes skills a natural way to give repository-local procedures to a coding agent without turning every instruction into application code.

For a team maintaining several repositories, portable skills are a useful shared vocabulary. They should still be treated as data: review them, version them, state their intended tool permissions, and test the workflows they cause.

## Multi-agent work: capability, workflow, or omission

DeepSeek Harness has the most ambitious built-in multi-agent architecture of the four, though its Agent Teams capability is explicitly experimental and private opt-in. It describes a durable roster, mailbox, shared task DAG, and replay. Its subagent interface supports one-shot children and continuable children, with providers for in-process runs and external systems such as ACP, Claude Code, and Codex.

This is more than a `spawn()` call. A continuable child has its own persisted session and can receive follow-up work. A team has named members, durable messages, and task state. The design is promising for an investigation that takes several rounds: one agent checks raw provider evidence, another validates the transformation rule, and the lead asks either one a follow-up when the facts disagree.

OpenCode has a more immediately usable coding-oriented model. Primary agents can delegate through a Task tool to specialized subagents. It ships General, Explore, and Scout subagents, and lets users define more. Each agent can have a different model, maximum step count, prompt, tools, and task permissions. An orchestrator can therefore use an inexpensive exploration model before assigning a bounded implementation task to a stronger model.

Hermes is primarily organised around one persistent agent. It has tools, scheduled work, memory, and gateway channels; multi-agent orchestration is not its central contract in the same way as DeepSeek Harness Agent Teams or OpenCode's taskable subagents.

Pi makes the opposite choice on purpose: there are no built-in subagents. Use tmux, write an extension, or install a package if the workflow needs them. This is an honest trade-off. It removes a coordination system you may not need, but leaves you responsible for building one when you do.

| Project | Multi-agent default | What is durable? |
| --- | --- | --- |
| DeepSeek Harness | Experimental teams and continuable subagents | Child sessions, mailbox messages, task DAG, replayable session events |
| Hermes | One persistent assistant is the primary model | Memory, sessions, scheduled work, channel conversations |
| Pi | No built-in subagents | Sessions and extensions; coordination is external or user-built |
| OpenCode | Primary agents delegate to specialized subagents | Agent configuration and task-scoped delegation within coding sessions |

Multi-agent systems need more policy than single-agent systems. Define write scopes, ownership of shared files, a hand-off format, a completion condition, and a budget. Without those, extra agents mostly create extra context and conflicting edits.

## Safety: put the decision near the action

The projects differ sharply in defaults.

DeepSeek Harness has plugin seams for filesystem access, subprocess execution, sandboxing, approvals, and interception of tool requests or turns. Its base composition includes sandbox and approval policy. That is a strong foundation if an organisation needs one policy implementation to apply across model providers and tool backends.

Hermes documents command approval, pairing for direct messages, and container isolation. That suits an agent that can be reached from Telegram, Slack, or another external channel. A useful default for a personal gateway is tighter than the default for a local coding CLI.

Pi delegates the question. There are no built-in permission popups; the project recommends a container or an extension that fits the environment. This keeps the core simple, but an unreviewed extension can quietly become the security model.

OpenCode has explicit, granular permissions for reads, edits, shell commands, external directories, skills, web access, and subagent tasks. It also includes a `doom_loop` guard for three identical repeated tool calls. For repository work, this is a practical policy surface: a review agent can read and search freely while being unable to edit files or launch an implementation agent without approval.

## A useful way to compare them in practice

Do not evaluate a harness by asking it to "build a todo app." Give each one the same bounded operational task:

1. Read two saved exchange responses whose prices disagree.
2. Call only a documented `get_price_disagreement` tool.
3. Explain the gap and link every claim to the tool result.
4. Attempt an undeclared raw-table query and verify that policy rejects it.
5. Resume the session after interruption and check whether the history and approval decision remain inspectable.
6. Repeat with a malformed provider payload and a timeout.

This exposes the properties that matter: model-tool reliability, loop cancellation, context compaction, auditability, permission boundaries, and how much custom code is needed to make the right thing easy.

## Where DeepSeek Harness could fit

For a project that already has documented marts, tools, and evaluation cases, DeepSeek Harness is interesting when you need to build a custom agent control plane around them. Its plugin tree can make policy, persistence, sandboxing, model selection, and agent coordination explicit components of the same runtime.

The constraint is maturity. DeepSeek labels the harness a developer preview and Agent Teams an experimental opt-in capability. Start with a contained profile and a narrow tool contract. Record session events, exercise failure paths, and measure whether the plugin seams reduce change cost for your actual workflow. Do not adopt a team system simply because it can spawn more agents.

Hermes remains compelling when the product is a persistent assistant. Pi remains a good base when you want to own every added layer. OpenCode is a strong fit when the unit of work is a repository and the team needs configurable subagents and permissions today.

The harness is the policy surface around the model. The model may write code or an explanation, but the harness decides what it can see, call, repeat, retain, and prove later.

## References

- [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
- [DeepSeek Harness architecture documentation](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/architecture.md)
- [DeepSeek Harness Agent Teams documentation](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/agent-team.md)
- [DeepSeek Harness subagent documentation](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/subagent.md)
- [Hermes Agent repository](https://github.com/NousResearch/hermes-agent)
- [Hermes Agent documentation](https://hermes-agent.nousresearch.com/docs)
- [Pi repository](https://github.com/earendil-works/pi)
- [Pi agent package documentation](https://github.com/earendil-works/pi/tree/main/packages/agent)
- [OpenCode repository](https://github.com/anomalyco/opencode)
- [OpenCode agents documentation](https://opencode.ai/docs/agents)
- [OpenCode skills documentation](https://opencode.ai/docs/skills)
- [OpenCode providers documentation](https://opencode.ai/docs/providers)
- [OpenCode permissions documentation](https://opencode.ai/docs/permissions)
