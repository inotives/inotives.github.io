---
title: "Agent Skills vs Agent Workflows: Where's the Line?"
date: 2026-06-26
tags: [agent-design, architecture, llm-agents]
summary: "Skills are atomic capabilities. Workflows orchestrate them. But the boundary gets murky when a skill internally sequences steps, or a workflow is simple enough to look like one skill."
---

# Agent Skills vs Agent Workflows: Where's the Line?

I've been thinking about how we name things in agent systems. Specifically, the difference between a "skill" and a "workflow" — and why the distinction matters more than it seems at first glance.

## The Short Version

A skill is one thing the agent can do. It takes an input, produces an output, and the agent treats it as a single call. A workflow is a sequence of steps — possibly branching, looping, retrying — that together accomplish something bigger.

A skill answers: "What can the agent do?"
A workflow answers: "How does the agent get this multi-step job done?"

## Skills: Small, Self-Contained, Reusable

Think of a skill as the smallest invocable unit. It has one clear responsibility. It carries its own instructions — usually a markdown file with structured prompts — and it doesn't contain orchestration logic.

Good examples from my own setup:
- `agent-reach` fetches content from a URL or platform
- `diagnosing-bugs` runs a diagnosis loop for a reported bug
- `tdd` drives a test-driven development cycle

Some of these internally describe loops or branching. That's fine. The key is that from the caller's perspective, you invoke it once and get a result. The orchestrator doesn't manually sequence the steps.

## How Skills Are Structured on Disk

A skill isn't just an idea — it's a folder with a specific layout. The Claude Code skill-creator design lays this out clearly:

```
skill-name/
├── SKILL.md              (required)
│   ├── YAML frontmatter  (required: name + description)
│   └── Body              (markdown instructions)
├── agents/
│   └── openai.yaml       (UI metadata for skill lists)
└── Bundled Resources (optional)
    ├── scripts/          (executable code)
    ├── references/       (docs loaded into context as needed)
    └── assets/           (files used in output, not loaded into context)
```

### The YAML Frontmatter Trick

The frontmatter is the key to making skills efficient. Only `name` and `description` are required:

```yaml
---
name: humanizer
description: Identify and remove AI-generated writing patterns. Use when user says "humanize this" or "fix AI writing".
---
```

This matters because the system reads frontmatter from ALL installed skills to decide which ones to load. That costs about 100 words per skill. The full SKILL.md body only loads AFTER the skill triggers.

With 20 skills installed, you pay ~2000 words for metadata but only load the 1-2 you actually need. Without this design, you'd need to load every full skill into context.

### Progressive Disclosure

Skills use a three-level loading system:

1. **Metadata** (always in context): name + description, ~100 words
2. **SKILL.md body** (loaded on trigger): instructions, under 5k words
3. **Bundled resources** (loaded on demand): unlimited — scripts execute without loading into context

### Resource Types

- `scripts/` — Executable code (Python, Bash). Runs without loading into context. Use when the same code gets rewritten repeatedly.
- `references/` — Documentation, schemas, API docs. Loaded into context only when the task needs that specific detail.
- `assets/` — Templates, images, fonts. Never loaded into context — used directly in output.

The design principle: keep SKILL.md lean (under 500 lines), link to reference files for details, and only load what the current task actually requires.

## How TUI Harnesses Actually Load Skills

The theory is clean. The implementation is where things get interesting — and where the context window tradeoff becomes real.

### Claude Code's Approach

Claude Code loads skills from two locations: `$CLAUDE_HOME/skills/` (global) and `.claude/skills/` (project-local). On startup, it reads the frontmatter from every installed skill and injects a compact index into the system prompt. That index is just name + description for each skill — the "available_skills" block you see at the top of every conversation.

When a skill triggers, Claude Code reads the full SKILL.md into the conversation as a `<skill_content>` block. The body becomes part of the active context. If the skill has bundled resources (scripts, references), those get loaded on demand as the agent works through the skill's instructions.

The key constraint: everything shares one context window. The system prompt, conversation history, all skill metadata, and the user's request all compete for space. That's why the progressive disclosure design matters — you can't afford to load 50 full skill documents when you only need one.

### OpenCode's Approach

OpenCode uses a similar structure but with some differences. Skills live in `~/.agents/skills/` and are discovered by scanning for `SKILL.md` files. The frontmatter (name, description, trigger_tags) gets indexed. When a task matches a skill's trigger, the full SKILL.md loads.

OpenCode also supports a `skill` tool that lets the agent explicitly load a skill by name. This gives the agent more control — it can decide mid-conversation that a skill would help, rather than relying solely on automatic triggering.

### The Loading Sequence

Both systems follow roughly the same sequence:

1. **Startup**: Scan skill directories, parse YAML frontmatter, build a compact index (~100 words per skill)
2. **System prompt injection**: Add the skill index to the system prompt so the model knows what's available
3. **Trigger detection**: The model reads the user's request and decides if a skill applies (or the agent explicitly calls the skill tool)
4. **Full load**: The SKILL.md body loads into context as a `<skill_content>` block
5. **Resource loading**: Scripts execute directly; reference files load only when the agent determines they're needed
6. **Cleanup**: After the skill finishes, its content stays in context but the agent moves on

### Why This Design Wins

Without progressive disclosure, you'd face a binary choice: load all skills (expensive, wasteful) or load none (the model doesn't know what it can do). The metadata-first approach lets you keep a cheap index of capabilities while only paying the full cost for the 1-2 skills you actually use.

For a developer with 30+ skills installed, this is the difference between burning 30k tokens on skill docs every conversation versus burning 3k tokens on metadata and loading the one skill you need.

## Workflows: Multi-Step Orchestration

Workflows compose multiple skills or steps. They have branching, conditionals, iteration. They pass state between steps. They might involve multiple agents — a planner, a worker, a verifier.

In my vault:
- `stock-weekly-summary` runs a weekly summary skill for each ticker, then generates an HTML report from the aggregated results
- `project-profile` builds a project profile from a GitHub URL through multiple sequential steps

The difference from a skill: an orchestrator explicitly calls step A, checks the result, then calls step B. It's not one invocation — it's a sequence.

## Where the Line Blurs

Here's where it gets interesting. A workflow can get packaged as a skill for reuse. Imagine a skill whose instructions describe a multi-step process: "step 1: search, step 2: analyze, step 3: summarize." From the caller's view, it's a skill. From the implementer's view, it's a workflow.

The practical test: Is it invoked as one unit by an orchestrator, or does an orchestrator manually sequence the steps? One trigger, one result = skill. Explicit step-by-step calling = workflow.

## Frameworks Do This Differently

Different agent frameworks use different terms for roughly the same ideas:

| Framework | Skill-like | Workflow-like |
|---|---|---|
| opencode | `skill` (loadable instructions) | `agent` mode, multi-agent orchestration |
| LangGraph | Tool/node | Graph/state machine |
| OpenAI | Function/tool | Chain/parallel |
| Custom agents | Prompt file, tool | Pipeline, plan, recipe |

The concepts are consistent. The names aren't.

## What This Means for Vault Design

In my Strata-Memory vault:
- Skills live in `3_intelligence/skill/` — atomic, self-contained
- Workflows live in `3_intelligence/workflow/` — orchestrate multiple steps or skills

When deciding where something goes: if it has one clear entry point and one output, make it a skill. If it requires conditional branching, multiple sequential phases, or composing other skills, make it a workflow.

## Open Questions

I'm still figuring out a few things:
- Should a workflow that only ever calls one skill be collapsed into that skill?
- Can a workflow be promoted to a skill once its pattern stabilizes?
- Is there a reliable automated test to classify something as skill vs workflow based on its structure?

The boundary isn't always clean. But knowing where you are on the spectrum helps you design better agent systems.

## References

- [Claude Code skill-creator](https://github.com/anthropics/codex/blob/main/skills/.system/skill-creator/SKILL.md) — the design reference for skill structure
- [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
- [stop-slop project](https://github.com/hardikpandya/stop-slop)
