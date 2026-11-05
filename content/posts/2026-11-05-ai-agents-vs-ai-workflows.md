---
title: "AI agents vs AI workflows: who decides the next step"
date: 2026-11-05
tags: [ai-agents, ai-workflows, agent-architecture, orchestration, agent-harnesses, tool-use]
series: building-ai-systems
summary: "An AI agent decides what to do next and acts on its own. An AI workflow follows steps you wrote in advance, so it gets the same task done the same way every time. This note compares the two on concept, architecture, execution flow and runtime, then covers when to use each, and why the most useful systems put an agent inside a workflow instead of picking one."
---

"Agent" now gets used for almost anything with an LLM in it. A cron job that summarises a report and posts it to Slack gets called an agent. So does Claude Code spending forty minutes fixing a failing test suite. They are different kinds of system, and mixing them up leads to bad design choices in both directions: agents doing work that should be a pipeline, and pipelines hitting cases a fixed script cannot handle.

The cleanest line I know comes from Anthropic's [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) post. **Workflows** run LLMs and tools through code paths you define in advance. **Agents** let the LLM direct its own process and tool use, deciding as it goes. Put simply:

- **An AI agent makes decisions and acts autonomously.**
- **An AI workflow follows predefined steps to complete a task reliably.**

Both use the same parts: a model, prompts, tools and some state. The difference is **who decides the next step**.

## Concept

![Left, an AI workflow: input, extract, classify, draft and output in a fixed line, with the LLM filling in steps but not choosing them. Right, an AI agent: a goal feeds a think, act, observe loop that exits only when the model judges the goal met.](/assets/images/agents-vs-workflows-concept.svg)

A **workflow** is a recipe. You decide the steps, their order and the branches. The LLM does the hard part inside a step (reading a messy PDF, classifying a ticket, writing a draft), but it never chooses what happens next. If the same input comes in twice, it takes the same path twice. That is the whole point: you get **reliability and repeatability**.

An **agent** is given a goal, not a recipe. It runs a loop: think about the goal, pick an action (usually a tool call), look at the result, and decide again. It keeps going until it judges the goal met or runs out of budget. The path is chosen at runtime, so it can handle cases nobody planned for. That is also the risk: it can choose badly.

A useful test: **could you draw the flowchart before the task arrives?** If you can, you have a workflow, whether or not you call it one. If the flowchart only exists afterwards as a trace of what happened, you have an agent.

The common workflow patterns from Anthropic's post are worth knowing by name, because most "agents" in production are really one of these:

- **Prompt chaining:** step A's output feeds step B, with checks in between.
- **Routing:** classify the input, then send it to a specialised path.
- **Parallelisation:** run several LLM calls at once and combine them, or vote.
- **Orchestrator-workers:** one LLM splits a task and hands parts to workers. This is already close to an agent.
- **Evaluator-optimiser:** one LLM writes, another critiques, and they repeat until it passes.

## Architecture

![Four layers compared. Control: code owns the flow in a workflow; the model owns it in an agent. LLM role: a worker inside one step versus the planner. Tools: hard-wired calls versus a catalog the model chooses from. State: typed, checkpointed data versus a growing context window plus memory.](/assets/images/agents-vs-workflows-architecture.svg)

The parts are almost the same. What moves is control.

| Layer | AI Workflow | AI Agent |
|---|---|---|
| **Control flow** | Your code: a DAG, a state machine, a cron job, if/else routing | The model, run inside a loop by a [harness](/notes/2026-05-02-what-are-agent-harnesses) |
| **LLM role** | A worker inside one step, with a fixed prompt and usually a structured output schema | The planner: reads the situation, picks the next action, decides when it is finished |
| **Tools** | Called by code at a fixed point. Step 3 always calls the CRM API | A catalog the model chooses from: MCP servers, shell, browser, APIs, sub-agents |
| **State** | Typed data passed from step to step, often checkpointed so a failed run resumes at that step | The context window, which grows every turn, plus whatever memory the agent reads and writes |
| **Typical stack** | Airflow, Temporal, n8n, Step Functions, plain Python with LangGraph edges you drew yourself | Claude Code, the Claude Agent SDK, OpenAI Agents SDK, a custom tool loop |

An agent's architecture is smaller than people expect. The core is a while-loop: send the conversation and tool definitions to the model, run whatever tool it asks for, append the result, and repeat until it stops asking. Most of the engineering goes into what surrounds that loop: which tools it gets, how results are summarised so the context does not fill up, permissions, and limits.

A workflow's architecture is mostly ordinary software: an orchestrator, retries, idempotent steps, queues and logs. The LLM calls are just steps in it.

## Execution flow

The clearest way to see the difference is to give both the same job. Here a customer writes in asking for a refund on order #4821, but they have mistyped the order number.

![The same refund ticket handled twice. Left, a workflow: classify, branch on refund, draft or FAQ answer, validate, send. Right, an agent trace: think, orders.get returns not found, re-plan and search by email, find order 4812, check the refund policy, create a refund that waits for approval, reply.](/assets/images/agents-vs-workflows-execution-flow.svg)

The **workflow** classifies the ticket as a refund and goes down the refund branch. If the branch includes an order lookup, the lookup fails and the workflow does what you told it to do in that case: probably escalate to a human. That is correct behaviour. It is predictable and easy to audit, and a human will sort out the typo.

The **agent** reads the ticket, looks up the order, gets "not found", and makes a decision nobody wrote down: maybe it is a typo, so search by the customer's email. It finds #4812, checks the refund policy, and starts a refund. The refund tool pauses for approval because issuing money is a risky action. Then it replies.

The agent's flow is a **trace, not a plan**. Step 3 did not exist until the model needed it. That is the power, and it is also why the refund tool has an approval gate: the same freedom that lets it get past a typo could let it refund the wrong order.

## Runtime

![Three runs of a workflow are identical four-step bars. Three runs of an agent take three, five and nine steps. Cards compare latency, cost, debugging and failure for each.](/assets/images/agents-vs-workflows-runtime.svg)

At runtime the difference shows up as **shape**. A workflow has a fixed shape: the same number of steps, roughly the same latency and roughly the same cost every run. An agent's shape varies: an easy case takes three turns, a messy one takes fifteen, and each turn re-reads the growing context, so cost grows faster than the step count.

| Runtime property | AI Workflow | AI Agent |
|---|---|---|
| **Latency** | Predictable. Independent steps can run in parallel | Variable. Turns mostly run one after another |
| **Cost** | Known per run, easy to budget | Scales with steps and context size; needs a cap |
| **Determinism** | Same input, same path (the LLM output inside a step can still vary) | Same input can take a different path each run |
| **Failure** | Stops loudly at a step, with that step's input and output | Can drift, loop, give up early, or do more than you wanted |
| **Debugging** | Open the step that failed | Read the whole trace to see where the reasoning went wrong |
| **Testing** | Unit-test each step, snapshot outputs | Evals over many runs, graded on outcome |
| **Safety controls** | Mostly implicit: it can only do what the code does | Must be explicit: tool permissions, approval gates, step and time budgets |

This is why "just make it an agent" is not free. You trade a fixed runtime you can reason about for a variable one you have to put limits around. I wrote more about those limits in [loop engineering patterns](/notes/2026-06-12-loop-engineering-patterns).

## When to use which

![A two by two map. Fixed steps with little judgment: plain automation. Fixed steps with judgment inside each: AI workflow. Open-ended with a lot of decision making and tool use: AI agent. Open-ended with nothing to act on: chat or search. A hybrid zone sits between workflow and agent.](/assets/images/agents-vs-workflows-when-to-use.svg)

**Use an AI agent when the task is complex, open-ended, and needs decisions and tool use.** In practice, use one when:

- You cannot list the steps in advance, because they depend on what the first few steps find.
- The task needs several tools, chosen and ordered case by case.
- Recovering from surprises matters more than identical behaviour every run.
- Being slower and costlier per run is acceptable, because the alternative is a human doing it.

Examples: research across many sources, debugging and code changes, incident investigation, a data question that needs exploring tables before you know what to query.

**Use an AI workflow when the steps are known and you need the result to be reliable.** In practice:

- The task repeats with the same shape: extract, classify, summarise, route, notify.
- You need predictable cost and latency, or you run it at high volume.
- Someone has to audit or sign off on how a result was produced.
- A wrong action is expensive, and "escalate to a human" is an acceptable fallback.

Examples: invoice and contract extraction, ticket triage, a daily market summary, compliance checks against a fixed rule set.

And if the task has fixed steps *and* no judgment, you do not need an LLM at all. A script is cheaper and never hallucinates.

The default I use: **start with a workflow, and promote one step to an agent only when that step keeps hitting cases the fixed logic cannot handle.**

## Combine both: workflow skeleton, agent judgment

The choice is rarely all one or all the other. The systems that work best use **a workflow for the structured steps and let an agent handle the decision making, dynamic actions and tool use** inside one bounded step.

![A workflow runs trigger, intake, classify, an agent step, validate, an approval gate and deliver. The agent step is a bounded think, act, observe loop with tools, a 15-step budget and a 3-minute timeout. A dashed path from validate back into the agent retries once with the error. The workflow owns order, retries, budgets, logging and approvals; the agent owns decisions, dynamic actions and tool choice.](/assets/images/agents-vs-workflows-hybrid.svg)

Split the responsibilities like this:

- **The workflow owns the skeleton.** When the agent runs, what it receives, how long it may run, how many steps it gets, what happens to its output, who must approve risky actions, and what gets logged.
- **The agent owns the judgment.** Inside its box it decides which tools to call, in what order, and how to recover when something unexpected comes back.
- **Code checks the agent's output before anything leaves the box.** A schema check, a rule check, and on failure one retry with the error fed back, then escalation. The agent never has the last word on a side effect.

The refund case from earlier becomes: the workflow takes in the ticket, classifies it, and hands refund tickets to an agent with read-only order and policy tools. The agent works out *which* order and *whether* it qualifies, and returns a proposed refund. Code validates it, a human approves anything over a threshold, and the workflow sends the reply. You keep the agent's ability to get past a typo, and the workflow's guarantee that money only moves the way you designed.

This is the same pattern most agentic coding setups have settled on. A CI pipeline is a workflow; the coding agent is one step in it; tests and review gates sit around it ([CI/CD for agentic workflows](/notes/2026-05-24-cicd-agentic-ai-workflows)). The [trinary agents](/notes/2026-10-20-from-agent-rig-to-trinary-agents) setup is the same idea again: a fixed plan, work and review sequence, with an agent doing the open-ended work inside each role.

**Workflows give you reliability. Agents give you intelligence. Combined, the workflow decides where the agent is allowed to be smart, and that gives you a system that is both reliable and intelligent.**
