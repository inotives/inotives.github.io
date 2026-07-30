---
title: "From Loop Engineering to Graph Engineering"
date: 2026-07-30
tags: [ai, agents, graph-engineering, langgraph, workflows, loop-engineering]
series: building-ai-systems
summary: "Graph engineering is the shift from one open-ended agent loop to explicit agent workflows made of nodes, edges, state, retries, and human checkpoints. It gives teams more control over AI systems without removing the parts where agents still need freedom."
---

# From Loop Engineering to Graph Engineering

Loop engineering was a good frame for the first wave of useful agents.

The idea was simple:

```text
give the agent a goal
let it inspect context
let it call tools
let it evaluate progress
repeat until done or blocked
```

That pattern still works. Coding agents, research agents, and data-debugging agents all need loops. They have to read, try, fail, inspect, revise, and try again.

But production teams are running into the limits of one big loop.

An open-ended loop is flexible, but it is hard to reason about:

```text
Where can the agent go next?
When should it stop?
Which steps are deterministic?
Where does a human need to approve?
What state is preserved?
What happens after a crash?
Which path caused the bad output?
```

Graph engineering is the next correction.

Instead of treating an AI workflow as one loop, you model it as a graph:

```text
nodes       units of work
edges       allowed transitions
state       shared memory passed through the workflow
conditions  routing rules
cycles      retry, revise, review, and resume paths
```

The agent still gets to reason. It just reasons inside a workflow that has shape.

## Who is championing this

The clearest champion of the current "graph engineering" wave is the LangChain/LangGraph team.

In July 2026, Sydney Runkle and Harrison Chase published "3 Years of Graph Engineering with LangGraph." Their framing is useful because it does not pretend graphs are new. LangGraph has represented agents as graphs for years. What changed is that the term caught up with the production pattern.

LangGraph's core pitch is direct:

```text
agent workflows need control
agent workflows need cycles
agent workflows need durable state
agent workflows need human checkpoints
agent workflows need observability
```

This is different from older DAG workflow tools. Airflow-style DAGs are acyclic. Agent systems often need cycles:

```text
retry a tool call
ask the user for missing context
revise an answer after critique
rerun a failing check
pause for approval
resume after a human decision
```

LlamaIndex has moved in a similar direction with Workflows, an event-driven way to orchestrate steps and events in agentic applications. The broader trend is not one tool. It is the recognition that AI systems need explicit control flow, not only prompts and loops.

## Loop engineering vs graph engineering

Loop engineering asks:

```text
What should the agent keep doing until the task is done?
```

Graph engineering asks:

```text
What are the valid states and transitions of this AI workflow?
```

The difference matters.

Loop:

```text
planner -> tool call -> observation -> planner -> tool call -> observation
```

Graph:

```text
receive request
-> classify task
-> gather context
-> choose path
-> run specialist agent
-> validate output
-> human review if risky
-> publish or revise
```

The loop is still inside the graph. A node can contain an agent loop. The graph defines where that loop is allowed to sit and what happens before and after it.

That is the new practical pattern:

```text
graphs outside
loops inside nodes
```

## How graph engineering works

A graph-based AI workflow usually has four pieces.

First, state.

State is the structured object that moves through the workflow:

```text
user request
task type
retrieved context
tool results
draft answer
validation result
approval status
error history
final output
```

Second, nodes.

A node does one piece of work:

```text
classify_request
fetch_context
run_sql_query
draft_response
critique_response
request_human_approval
publish_result
```

A node can be boring code, an LLM call, a tool call, or a full agent.

Third, edges.

Edges decide where the workflow goes next:

```text
if task is analytics -> query_metric
if task is code change -> repo_inspection
if validation passes -> publish
if validation fails -> revise
if risk is high -> human_review
```

Fourth, persistence.

Production workflows need to survive crashes, pauses, retries, and human delays. Durable state is what lets a workflow resume instead of starting from scratch.

## A simple example

Imagine a stakeholder asks:

```text
Why did BTC volume drop yesterday?
```

A loop-only agent may:

```text
guess tables
write SQL
inspect results
write explanation
maybe check freshness
maybe forget metric definition
```

A graph-engineered workflow can enforce the path:

```text
receive_question
-> classify_as_metric_investigation
-> resolve_metric_definition
-> check_metric_freshness
-> query_semantic_layer
-> decompose_change
-> validate_sources
-> draft_answer
-> attach_provenance
```

If freshness fails:

```text
check_metric_freshness
-> refuse_or_warn
-> suggest_retry_after_pipeline_run
```

If the metric is ambiguous:

```text
resolve_metric_definition
-> ask_clarifying_question
```

This is the value of the graph. The system no longer relies on the model remembering every safety rule in a prompt.

## What graph engineering solves

It solves control.

You can decide where the agent has freedom and where the system is deterministic.

Example:

```text
deterministic: only query approved semantic metrics
agentic: explain the metric movement in plain language
deterministic: block if freshness is stale
agentic: suggest likely causes to investigate
```

It solves auditability.

The workflow path becomes visible:

```text
question received
metric resolved
freshness checked
query executed
validation passed
answer generated
```

It solves recovery.

If a node fails, rerun that node or route to an error path. Do not rerun the whole agent from scratch.

It solves human-in-the-loop.

Risky actions can pause:

```text
agent proposes database correction
-> reviewer approves
-> backfill request created
```

It solves multi-agent coordination.

Different agents can be nodes:

```text
research agent
coding agent
data analyst agent
reviewer agent
documentation agent
```

The graph defines how they hand work to each other.

## What it brings to the table

Graph engineering gives builders a middle ground.

Pure deterministic workflow:

```text
safe, predictable, too rigid
```

Pure agent loop:

```text
flexible, powerful, hard to control
```

Graph-engineered workflow:

```text
structured path with agentic work inside selected nodes
```

This is useful for real company workflows:

```text
customer support triage
software change review
financial report generation
analytics investigation
security alert enrichment
data quality remediation
```

For crypto and financial data, this matters because many workflows need both reasoning and control.

Example:

```text
agent can investigate stale CoinGecko prices
agent can summarize affected reports
agent can propose a backfill
agent cannot mutate production data without review
```

That is a graph problem.

## Why agents as nodes is the new part

Graphs are not new.

State machines are not new.

Workflow engines are not new.

What feels new in 2026 is what we can put inside a node.

Earlier graph workflows often had nodes like:

```text
call LLM
call retriever
call tool
format answer
```

Now a node can be a capable agent run:

```text
coding agent inspects repo and opens PR
data agent queries semantic layer and writes analysis
research agent gathers sources and drafts memo
reviewer agent checks output against policy
```

The graph is no longer only orchestrating small LLM calls. It is orchestrating agents.

That is the useful shift from loop engineering to graph engineering.

## Common pitfalls

Pitfall: turning every workflow into a giant graph.

Some tasks are still better as one loop. Deep research, open-ended debugging, and exploratory coding often need freedom. A graph with 40 nodes can become a brittle maze.

Pitfall: confusing graph with DAG.

Agent workflows often need cycles. If the framework cannot handle retries, revision, pausing, and resuming, it will fight the problem.

Pitfall: hiding all logic inside nodes.

If every node is "call big agent," the graph does not add much. Use graph edges to encode real policy and control.

Pitfall: no state design.

Bad state becomes a shared junk drawer. Good state is typed, explicit, and small enough to inspect.

Pitfall: no observability.

If you cannot see node transitions, tool calls, validation results, and human approvals, the graph is only decorative.

## When to use graph engineering

Use it when the workflow has known structure:

```text
approval gates
retry paths
validation steps
different task routes
specialist agents
human review
audit requirements
partial recovery
```

Examples:

```text
AI data quality review queue
agent-assisted analytics over production marts
documentation PR generator
financial report validation assistant
customer support escalation workflow
security triage and enrichment
```

Stay with a simpler loop when:

```text
the task is exploratory
the valid path is unknown
the output does not trigger external side effects
the workflow is cheap to restart
```

Graph engineering is not a prize for maturity. It is a tool for control.

## How I would design one

Start with the smallest useful graph:

```text
intake
-> classify
-> execute
-> validate
-> finish
```

Then add branches only when a real branch exists:

```text
if needs data -> data_agent
if needs code -> coding_agent
if needs approval -> human_review
if validation fails -> revise
if unsafe -> refuse
```

Keep node contracts explicit:

```text
input state
output state
allowed tools
failure modes
retry policy
owner
logs
```

The graph should make the workflow easier to inspect, not harder.

## The rule

Loop engineering taught us how to make agents keep working.

Graph engineering teaches us where that work is allowed to go.

The graph does not remove the loop. It contains it.

That is why the pattern is useful: agents get freedom inside nodes, while the system gets control over transitions, state, review, and recovery.

For serious AI workflows, that tradeoff is the whole game.

## References

- [3 Years of Graph Engineering with LangGraph](https://www.langchain.com/blog/3-years-of-graph-engineering-with-langgraph)
- [Building LangGraph: Designing an Agent Runtime from first principles](https://www.langchain.com/blog/building-langgraph)
- [LangGraph multi-agent workflows](https://www.langchain.com/blog/langgraph-multi-agent-workflows)
- [LangGraph workflows and agents](https://langchain-ai.github.io/langgraph/agents/tools/)
- [LlamaIndex Workflows](https://docs.llamaindex.org.cn/en/stable/understanding/workflows/)
- [Loop Engineering Without Going Broke](/posts/2026-07-01-loop-engineering-without-going-broke)
- [Loop Engineering Effectiveness](/posts/2026-06-27-loop-engineering-effectiveness)
- [Plan vs React Agent Patterns](/posts/2026-07-02-plan-vs-react-agent-patterns)
