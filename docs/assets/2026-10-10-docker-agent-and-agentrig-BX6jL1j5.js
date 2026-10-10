var e=`---
title: "Docker Agent and AgentRig: from local agent loops to deployable teams"
date: 2026-10-10
tags: [ai-agents, docker-agent, agent-rig, a2a, mcp, multi-agent-systems, developer-tools]
summary: "What Docker Agent provides, how it compares with our filesystem-first AgentRig, where an adapter could improve the rig, and how A2A could connect specialist agent teams across project boundaries."
series: building-ai-systems
---

Our [AgentRig](https://github.com/inotives/agent-rig) started from a local problem: agents need a project workspace, a task brief, a role, a handoff path, and a reviewer that can inspect the result. The workspace is filesystem-first. The task history stays close to the project. Profiles describe roles such as planner, worker, reviewer, researcher, writer, and designer.

Docker Agent starts from a different problem. How do you define and run a team of specialized agents as a reusable configuration?

Docker describes Docker Agent as an open-source framework for building teams of specialized AI agents. A YAML configuration defines a root agent, its sub-agents, their instructions, models, and tools. Docker Agent can run the team locally and package the configuration as an OCI artifact for sharing. [Docker Agent's official documentation](https://docs.docker.com/ai/docker-agent/) is the source for those capabilities.

The two projects overlap around multi-agent work, but they are not the same product. One is closer to a team runtime and distribution format. The other is closer to a project workflow and control plane.

![Docker Agent and AgentRig comparison](/assets/images/docker-agent-agentrig-comparison.svg)

## What Docker Agent is

Docker Agent lets a user define a root agent and a set of specialist sub-agents. The root agent receives the task, decides when to delegate, and coordinates the responses. Each agent can have its own model, instructions, context, and tools.

The configuration is declarative:

\`\`\`yaml
agents:
  root:
    model: some-model
    description: Coordinator
    instruction: |
      Decide which specialist should handle each part of the task.
    sub_agents: [investigator, reviewer]

  investigator:
    model: another-model
    description: Specialist investigator
    instruction: |
      Analyze the problem and return findings with evidence.
\`\`\`

The important design choice is the team boundary. A root agent can delegate to focused agents rather than carrying every role in one context. The official example uses an investigator and a fixer: one diagnoses a problem and the other implements the change.

Docker Agent also supports external tools through MCP toolsets. That gives an agent access to capabilities without putting every tool implementation inside the agent configuration.

## A small Docker Agent team in YAML

The smallest useful example for our AgentRig comparison is an investigator, a fixer, and a reviewer. The root agent receives the task and delegates to the specialists.

\`\`\`yaml
agents:
  root:
    model: openai/gpt-5-mini
    description: Engineering task coordinator
    instruction: |
      Understand the task, delegate investigation and implementation,
      then ask the reviewer to check the result before reporting back.
    sub_agents: [investigator, fixer, reviewer]

  investigator:
    model: openai/gpt-5-mini
    description: Root-cause investigator
    instruction: |
      Inspect the available project context, identify the likely root cause,
      and return concise findings with evidence. Do not edit files.
    toolsets:
      - type: filesystem

  fixer:
    model: openai/gpt-5-mini
    description: Minimal fix implementer
    instruction: |
      Implement only the approved fix. Keep the change narrow and report
      which files changed and which checks were run.
    toolsets:
      - type: filesystem
      - type: shell

  reviewer:
    model: openai/gpt-5-mini
    description: Change reviewer
    instruction: |
      Review the proposed result against the task. Look for regressions,
      missing checks, and scope creep. Return approval or concrete findings.
    toolsets:
      - type: filesystem
\`\`\`

Save it as \`agent-rig-debugger.yaml\`, then run it with the Docker Agent CLI:

\`\`\`shell
docker agent run agent-rig-debugger.yaml
\`\`\`

This configuration describes the Docker Agent team. It does not create an AgentRig task, write a handoff record, or decide whether a project change is accepted. AgentRig can remain the outer workflow that supplies the brief and records the result.

The team can also be shared as an OCI artifact, using the workflow documented by Docker:

\`\`\`shell
docker agent share push ./agent-rig-debugger.yaml example/agent-rig-debugger
docker agent run example/agent-rig-debugger:latest
\`\`\`

Treat the YAML as a versioned team definition. Keep project-specific context, task history, and approval records in the AgentRig workspace rather than baking them into the shared artifact.

## How Docker Agent compares with AgentRig

AgentRig is a TypeScript CLI for scaffolding a filesystem-first agent workspace into a project. It creates a project-local \`.agent-rig/\` area for agents, shared context, workflow records, findings, handoffs, and launch instructions. Its central unit is the project task and the loop around that task.

Docker Agent's central unit is the agent team definition and its runtime delegation. AgentRig's central unit is the project workspace and its governed work history.

| Concern | Docker Agent | AgentRig |
|---|---|---|
| Main object | Agent team configuration | Project workspace and task |
| Delegation | Root agent to sub-agents | Planner, worker, reviewer loop |
| Persistence | Agent context and runtime outputs | Filesystem context, tasks, findings, handoffs |
| Distribution | OCI artifact share and pull | CLI scaffolding and project repository |
| Tools | Built-in tools and MCP toolsets | Project-local tools and profiles |
| Primary boundary | Reusable team runtime | Project workflow and review |

This is a useful complement rather than a winner-takes-all comparison. Docker Agent can provide a portable specialist team. AgentRig can provide the task board, project context, handoff record, and review boundary around that team.

## Where Docker Agent could improve AgentRig

The smallest useful integration is an execution adapter.

AgentRig already knows how to create a task, assign a role, run a worker, ask for review, and record a handoff. Instead of making every profile depend on one local agent command, an AgentRig task could optionally launch a Docker Agent team as its worker backend.

\`\`\`text
AgentRig task
  → select execution backend
  → local worker or Docker Agent team
  → collect findings and artifacts
  → return to reviewer
  → write handoff and task state
\`\`\`

That keeps the current workflow intact. Docker Agent supplies team delegation. AgentRig supplies project state and acceptance rules.

The adapter should be deliberately small. It needs to pass a bounded task brief, selected project context, and the expected output contract. It should not mount the entire machine or silently give the Docker team access to every project file.

## Deploy one team for several projects

Docker Agent configurations can be shared as OCI artifacts. That creates a possible team deployment model: publish a versioned specialist team once, then pull it into separate project workspaces.

![Deploying Docker Agent teams for AgentRig projects](/assets/images/docker-agent-team-deployment.svg)

\`\`\`text
team configuration repository
        ↓
OCI registry
        ├── Project A Docker Agent team
        └── Project B Docker Agent team

each project keeps its own AgentRig workspace
\`\`\`

The important boundary is what gets shared. Share the team definition, role instructions, tool declarations, and version. Do not automatically share each project's task history, findings, private context, or approval records.

This also makes upgrades manageable. A team can pin version \`1.2\` while projects test \`1.3\` separately. The team configuration becomes a release artifact instead of a copied YAML file that drifts across repositories.

Container packaging does not solve governance by itself. The runtime still needs bounded mounts, scoped tools, explicit network access, and a clear policy for where outputs are written. A container is an isolation mechanism, not a permission model for the knowledge inside it.

## A2A is a different boundary from MCP

MCP connects an agent to tools and data. A2A connects one agent application to another agent application.

The Agent2Agent protocol is designed for interoperability between opaque agentic applications. Its official materials describe agent discovery through Agent Cards, JSON-RPC 2.0 over HTTP(S), synchronous requests, streaming through SSE, asynchronous push notifications, and exchange of text, files, and structured JSON.

![MCP and A2A boundaries around Docker Agent and AgentRig](/assets/images/docker-agent-a2a-boundary.svg)

In plain terms:

\`\`\`text
MCP: “Agent, use this tool.”
A2A: “Agent, collaborate with this other agent.”
\`\`\`

An Agent Card tells a client what a remote agent can do and how to connect to it. The client does not need to know the remote agent's internal model, prompt, or workflow implementation. That opacity is useful when different teams own different agents.

Docker Agent's documented integration points include MCP toolsets and sharing agent configurations. This article treats A2A as a possible adapter boundary around AgentRig or Docker Agent, not as a claim that Docker Agent natively implements A2A.

## A proposed AgentRig-to-Docker boundary

An AgentRig root or reviewer could call a remote specialist through an A2A adapter:

1. AgentRig creates a task and selects a specialist capability.
2. The adapter discovers the remote agent's Agent Card.
3. AgentRig sends a bounded task with project context and an output contract.
4. The remote agent returns a task status, findings, files, or structured artifacts.
5. AgentRig records the result in the local task and handoff flow.

The remote agent remains opaque. AgentRig does not need to reproduce its internal delegation. It needs a stable contract for request, progress, result, failure, and cancellation.

That seam could connect:

- an incident investigator to an AgentRig reviewer;
- a security specialist to a code-change task;
- a data-quality specialist to an ingestion workflow;
- a documentation team to a knowledge-base maintenance task;
- a deployment specialist to a release approval workflow.

The integration should return evidence, not only prose. A result might include a status, summary, affected files, proposed patch, test output, and links to supporting records.

## A real-time team usage pattern

Imagine an AgentRig task: “Investigate the failing integration test and prepare a minimal fix.”

The project workspace creates the task and gives the worker the relevant files. AgentRig delegates diagnosis to a Docker Agent investigator. The investigator can call its configured tools and hand the findings to a fixer. A reviewer then checks the result before the task is marked complete.

![Animated Docker Agent team loop](/assets/images/docker-agent-live-team-loop.svg)

The animated SVG shows the intended flow:

\`\`\`text
AgentRig task
  → Docker Agent investigator
  → fixer
  → reviewer
  → AgentRig handoff and task result
\`\`\`

A2A becomes useful when the specialist team is remote or owned by another group. Streaming status can show that the investigator is still working. Push notifications can report completion or a request for clarification. Artifacts can carry a patch, report, or structured finding back to the project workflow.

The project record should remain durable even if the remote agent disappears. Real-time transport is for coordination. AgentRig's task and handoff records are for resuming work later.

## Where this could help our rig

There are three realistic directions.

### Add Docker Agent as an execution backend

This is the smallest step. Keep AgentRig's existing task and reviewer model, then add a backend that runs a versioned Docker Agent configuration. It gives profiles a richer delegation option without changing the project record format.

### Publish reusable team profiles

AgentRig profiles and Docker Agent YAML solve related configuration problems. We could define a small mapping between an AgentRig role and a Docker Agent team, then publish approved team configurations through a registry.

The mapping should not erase the distinction between a role and a team. A reviewer profile might invoke a review team, while the AgentRig task still decides whether the result is accepted.

### Add an A2A adapter later

A2A is the larger architectural step. It would let AgentRig delegate to agents outside the local project or outside the local runtime. That is useful when teams provide specialist agents as shared services.

It also adds real distributed-systems problems: authentication, authorization, timeouts, retries, cancellation, artifact size, idempotency, observability, and versioned Agent Cards. Build this after the local Docker Agent backend proves useful.

## What not to merge blindly

Docker Agent and AgentRig should not be combined into one giant abstraction. Keep the seams visible:

- Docker Agent defines and runs a specialized agent team.
- AgentRig owns project tasks, context, handoffs, and review.
- MCP exposes tools and data to an agent.
- A2A exposes an agent capability to another agent application.
- The project repository remains the source for code and durable workflow evidence.

The likely failure mode is a remote team that can act but cannot explain what it changed, or a local task board that records a result without preserving its evidence. The adapter needs bounded context, explicit artifacts, and a review state.

## The practical next step

Do not replace AgentRig first. Add one Docker Agent execution backend behind the existing worker interface and run it on a narrow class of tasks, such as investigation followed by review.

Measure whether the team configuration improves delegation, repeatability, and isolation. If it does, package the team for reuse. Add A2A only when a real remote-agent boundary exists.

Docker Agent gives us a credible direction for distributing specialist teams. AgentRig gives us the project discipline those teams still need.

## References

- [Docker Agent official documentation](https://docs.docker.com/ai/docker-agent/)
- [Docker Agent GitHub repository](https://github.com/docker/docker-agent)
- [Docker Agent configuration reference](https://docs.docker.com/ai/docker-agent/configuration/overview/)
- [Docker Agent MCP tools](https://docs.docker.com/ai/docker-agent/tools/mcp/)
- [Docker Agent share agent teams](https://docs.docker.com/ai/docker-agent/#share-agent-teams)
- [AgentRig official repository](https://github.com/inotives/agent-rig)
- [Agent2Agent protocol](https://a2a-protocol.org/latest/)
- [A2A protocol GitHub repository](https://github.com/a2aproject/A2A)
- [Model Context Protocol](https://modelcontextprotocol.io/)
`;export{e as default};