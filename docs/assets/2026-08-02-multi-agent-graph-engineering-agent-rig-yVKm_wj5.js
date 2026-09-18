var e=`---
title: "Multi-Agent Graph Engineering Is a Workflow, Not a Swarm"
date: 2026-08-02
tags: [ai-agents, graph-engineering, multi-agent-systems, agent-rig]
summary: "Multi-agent graph engineering is the design of roles, transitions, and control points around real work. AgentRig applies it with a planner-worker-reviewer graph, Markdown task files, explicit returns, and lightweight loop observability."
series: building-ai-systems
---

# Multi-Agent Graph Engineering Is a Workflow, Not a Swarm

The phrase "multi-agent graph" can make a team reach for a coordinator, a delegation protocol, and five specialists before it has a task worth splitting. That is the wrong starting point.

Graph engineering is useful because it asks a harder question: which transitions are allowed between pieces of work, and who owns them? In a multi-agent system, the nodes include agents, routers, deterministic checks, task records, and human approval points.

That view fits AgentRig well. Its planner, worker, and reviewer are not a conversation between three personalities. They are a small operational graph with durable state.

## Start with the work graph

An agent graph should describe work that must happen, not a cast of characters you hope will be productive. For a software task, AgentRig's core graph is deliberately plain:

\`\`\`text
             +---------------------------+
             | planner                   |
             | creates ordered task files |
             +-------------+-------------+
                           |
                           v
                    dependency-ready
                           |
                           v
             +-------------+-------------+
             | worker                    |
             | changes and verifies work |
             +-------------+-------------+
                           |
                    status: review
                           |
                           v
             +-------------+-------------+
             | reviewer                  |
             | accepts or returns work   |
             +------+------+-------------+
                    |      |
             accepted|      |returned
                    v      v
                  done   worker
\`\`\`

The arrows matter more than the labels. A worker cannot skip from a vague request to done. A reviewer does not silently rewrite the task. A returned task has a defined destination. The graph is small enough to hold in your head and strict enough to keep a continuous loop from making up its own process.

## AgentRig's task file is the shared edge

Most multi-agent demos pass messages through an orchestrator's private state. That works until a run needs inspection, a human wants to intervene, or a new process takes over.

AgentRig treats Markdown task files as canonical state. The planner creates the task. The worker updates its status and records evidence. The reviewer adds a decision or a return. The CLI can derive the queue from those files without a separate database that might disagree with the work itself.

In graph terms, the task file is the durable edge between nodes. It carries the output that lets the next node act:

\`\`\`yaml
id: task-0042
status: review
depends_on: [task-0041]
goal: Make provider ticker ingestion idempotent
verification:
  - uv run pytest tests/test_ticker_ingestion.py
notes:
  - Raw records remain append-only; conflict handling belongs in staging.
next_action: reviewer_inspect
\`\`\`

This is less glamorous than an agent-to-agent protocol. It is also easier to debug. A human can open the file. A failed loop can restart from it. A reviewer has an artifact to inspect instead of a summary generated from a disappearing conversation.

## The planner is a graph designer, not a task generator

Planning is where the topology becomes real. A good plan does more than divide a request into smaller tickets. It defines dependencies, acceptance conditions, and the order in which evidence becomes available.

For example, a task to add a new market-data provider might become:

\`\`\`text
task-1: define provider contract and seed data
task-2: add extraction and raw persistence
task-3: model staging and mart data
task-4: review live ingest and dbt evidence
\`\`\`

The order prevents task-3 from guessing the provider's raw shape and prevents task-4 from reviewing a structural parse as if it were a live-data result. The planner has drawn a graph where each result unlocks the evidence needed by the next node.

This is the useful extension of graph engineering for multi-agent work: dependencies should be based on information flow, not on the number of agents available.

## Keep routing deterministic until it cannot be

The temptation in a multi-agent graph is to use a model as the router. Let the coordinator decide which specialist should work next. Let the worker decide whether review is necessary. Let the reviewer choose a new plan.

That flexibility has a cost. You now need to debug the routing decision as well as the task.

AgentRig's worker-reviewer loop starts with a deterministic rule: review work first; otherwise select the next dependency-ready task. A lock prevents two loops from claiming the same queue. The worker sets a task to \`in_progress\`; a reviewer moves it forward or returns it.

That is a good default. Use an LLM router only when the queue really contains work that cannot be classified with task metadata. Even then, constrain its output to a small set of valid transitions. "Choose the next step" is not a graph edge.

## A reviewer is a control node

In a swarm model, review often becomes another agent that comments in prose. In a work graph, the reviewer is a control node. It verifies the claimed outcome and chooses one of two transitions: accept or return.

A return should be structured enough that the worker can recover without replaying the whole run:

\`\`\`yaml
status: returned
finding: Retry inserts duplicate provider records
evidence: Same snapshot creates two rows for one provider record ID
root_cause: Shared insert path has no conflict target
required_fix: Make the shared insert idempotent
verification: Ingest the same snapshot twice and inspect the raw table
next_action: worker_fix_and_verify
\`\`\`

This keeps the graph honest. A reviewer cannot turn a bounded review into an untracked redesign. A worker cannot claim completion without satisfying the returned condition. The task moves through an explicit cycle until the reviewer accepts it or a human changes the scope.

## Human gates belong where consequence concentrates

Not every edge needs human approval. Requiring it everywhere turns the graph into a slow chat application.

Put gates before consequential actions: applying a production backfill, publishing a release, changing access control, or deleting data. The gate should receive a checkpoint with the action, scope, evidence, and rollback path. It should return a limited decision such as approve, reject, or narrow scope.

\`\`\`text
review accepted -> approval required -> production action
                                      |
                                      +-> rejected -> planner or worker
\`\`\`

This matches the enterprise concern in TrueFoundry's graph-engineering guide: the orchestrator owns topology, while sensitive model and tool actions need governance at the structural points where consequence is highest. AgentRig already has a practical place for the first half of that idea. Its task state and reviewer boundary identify the edges that deserve a human gate.

## Observability should answer graph questions

An agent trace can be impressive and still leave the operator stuck. The useful questions are smaller:

- What will the loop do next?
- Which task is currently claimed?
- Did the latest worker run reach review?
- Did the reviewer accept or return it?

AgentRig's loop observability keeps this compact. Its status reports derive the lock state, next loop action, and latest worker and reviewer run summaries from existing files. It does not need a new dashboard or a second state store to answer ordinary operational questions.

For a larger system, add stable \`graph_id\`, \`run_id\`, and \`node_id\` values to every model and tool call. Those IDs let you join the orchestrator's execution record with latency, cost, policy, and tool logs. The topology remains the source of truth; telemetry explains what happened at each node.

## The graph should stay smaller than the problem

Do not add a researcher, coordinator, architect, implementer, tester, and critic just because those roles sound sensible. Add a node only when it owns a distinct transition, needs a different authority, or produces evidence another node cannot safely infer.

For AgentRig, the basic planner-worker-reviewer graph is enough for many repository tasks. It has a durable queue, an execution node, a control node, and a human boundary when needed. That is already more reliable than one open-ended loop.

Extend it when the work demands it. Add a deterministic validation node when tests are expensive or shared. Add a security reviewer when a separate approval boundary is real. Add parallelism only when tasks have no dependency edge and the queue can safely coordinate claims.

Graph engineering is not the art of building a large agent organization. It is the discipline of making the next permitted action obvious.

## References

- [Graph Engineering for Multi-Agent Systems: Architecture, Governance, and Observability](https://www.truefoundry.com/blog/graph-engineering-enterprise-guide)
- [AgentRig](https://github.com/inotives/agent-rig)
- [From Loop Engineering to Graph Engineering](/posts/graph-engineering-ai-workflows)
- [The Checkpoint Is the Real Agent Interface](/posts/checkpoints-are-the-real-agent-interface)
- [A Review Return Needs a Schema](/posts/a-review-return-needs-a-schema)
`;export{e as default};