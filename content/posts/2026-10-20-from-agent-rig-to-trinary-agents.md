---
title: "From AgentRig to Trinary Agents: moving my workflow into a skill"
date: 2026-10-20
tags: [ai-agents, agent-rig, trinary-agents, subagents, agentic-workflows, developer-tools]
summary: "Why I extracted my planner-worker-reviewer workflow from an installed CLI into a portable agent skill, replaced live SQLite workflow state with Markdown records, and added a read-only dashboard."
series: building-ai-systems
---

I built [AgentRig](https://github.com/inotives/agent-rig) because I wanted more than a coding assistant. I wanted a small development team: one role to plan, another to implement, and a reviewer who would check the result before I accepted it.

AgentRig gave that workflow structure. It scaffolded agent profiles and a project workspace, tracked tasks and handoffs, and gave me commands and a board for checking progress. For a while, that was exactly the system I needed.

Then a few rough edges started shaping the next version. The answer was not to add another layer to AgentRig. It was to ask which parts of the workflow needed a separate tool at all.

![Dark side-by-side diagram comparing my earlier SQLite and headless-CLI AgentRig setup with the host-managed subagent and Markdown workflow in Trinary Agents](/assets/images/agent-rig-vs-trinary-agents.svg)

## The first rig solved a real problem

My original setup used a CLI to manage the team workflow. It gave me a place to define roles, select work, pass handoffs between agents, and inspect task status. I committed the workflow database to Git so I had recoverable snapshots.

That recovery path mattered. When SQLite occasionally became corrupted, I could return to the last committed version instead of losing the whole task history. But a recoverable snapshot is not the same as a reliable live store. The current database was still awkward to inspect, and Git could not give me a useful line-by-line diff of its binary state. If I had uncommitted updates, those were not protected by an earlier commit.

There was also friction in how I launched the agents. I had wrapped headless agent CLIs in scripts. Changes to Apple’s permissions model made that route harder to use reliably on my Mac, so I moved toward the main agent managing worker and reviewer sub-agents through the host’s built-in delegation features.

That change shifted the boundary. The host already knew how to start a child agent and return its result. I began to wonder why my workflow needed a separate runtime to own those calls as well.

## Keep the workflow, remove machinery I no longer needed

The valuable part was the method: agree on a plan, break it into tasks, respect dependencies, implement one task, review it independently, record the outcome, and keep me in control of approval. The CLI and database were one way to implement that method, but they were not the method itself.

In the new setup, the main agent takes the project-manager role. It uses the active coding harness to call worker and reviewer sub-agents. The rules and templates live in a skill, and the durable record lives in ordinary Markdown files in the target repository.

This is a lighter installation model, not “no installation.” I still add the Trinary Agents skill to the coding environment. What I no longer need for the core workflow is a globally installed orchestration CLI and a separate live database to coordinate these roles.

## What Trinary Agents records

[Trinary Agents](https://github.com/inotives/trinary-agents) uses a project-root `trinary-workspace/` for feature plans, task briefs, and handoffs. The feature plan captures the agreed scope and acceptance conditions. Each task README carries its status and dependency metadata in YAML frontmatter, with the detailed task brief in the Markdown body. Worker, reviewer, project-manager, and human-response handoffs are timestamped files that are appended rather than rewritten.

That gives the workflow a clear owner: the project manager changes task status and decides what to dispatch next. A worker records what it changed and which checks it ran. A separate reviewer records a verdict and evidence. The manager processes that verdict, updates the task, and only then moves to the next task in dependency order. Trinary Agents deliberately dispatches one task at a time, even when more than one task is ready.

The skill also keeps human approvals in the loop. It does not start implementation just because an idea was mentioned. The plan and the task breakdown need explicit approval before work is dispatched. At the end, I still make the final acceptance decision.

```text
trinary-workspace/
├── README.md                         # Project identity and workspace purpose
└── features/<feature-id>/
    ├── README.md                     # Approved feature plan and acceptance
    └── tasks/<task-id>/
        ├── README.md                 # Status, dependencies, scope, checks
        └── handoffs/                 # Append-only role and human records
```

The files are easy to read in an editor, diff in a pull request, or restore from Git. They are also available to different coding-agent hosts without converting task state into a database-specific format.

## The dashboard is a view, not another database

Markdown files are the source of truth, but a folder of task records is not the easiest way to answer “what is blocked?” or “what is waiting for review?” That is why I added a dashboard generator.

The generator reads task frontmatter and handoff files, then produces a local HTML dashboard with task lanes, dependencies, progress, and recent handoff activity. The dashboard is read-only. If a status or dependency changes, the project manager updates the Markdown record and regenerates the view. The board never becomes a second source of truth that can drift away from the task files.

![Dark diagram showing Trinary Agents Markdown plans, task files, and append-only handoffs as canonical records that feed a generated read-only dashboard](/assets/images/trinary-agents-markdown-dashboard.svg)

## The trade-off is simpler state, not zero discipline

Markdown made my workflow easier to inspect and recover, but it does not provide database transactions or automatic concurrency control. Two agents editing the same record could still conflict. Trinary Agents avoids much of that risk by assigning status changes to the project manager, keeping handoffs append-only, and dispatching one task at a time. Git commits create useful checkpoints, but they do not make careless concurrent edits safe.

The skill also relies on the active harness having usable sub-agent support. If a host cannot run a separate worker and reviewer, the independent review gate cannot be performed as designed. The workflow should say so plainly instead of pretending that a single agent reviewing its own changes is independent.

The dashboard has a smaller limit: it is a generated snapshot. It needs to be rebuilt when task metadata changes. That is a reasonable trade for a view that can be opened locally without a database server or hosted dashboard service.

## AgentRig and Trinary Agents have different jobs

This move is not a claim that AgentRig is obsolete or that SQLite is always the wrong choice. The current AgentRig project is still a fuller workspace scaffold, with configurable agent profiles, task commands, workflow storage, and a read-only task board. Its README currently describes SQLite as the default for new workspaces and also supports choosing Markdown storage. The project has also evolved toward planner-managed worker and reviewer agents.

Trinary Agents is the narrower option. It packages a planning, dependency, implementation, independent-review, and handoff process as a skill, then uses the host’s sub-agent mechanism and Markdown files already in the project. If I need a CLI to scaffold and administer a configurable agent workspace, AgentRig fits. If I want the main agent to manage a small approved workflow with transparent project files, Trinary Agents is simpler for me.

The useful shift was separating the team’s working agreement from the machinery that happened to run it. I kept the planner-worker-reviewer discipline, moved execution to the host’s sub-agents, made Markdown the durable record, and generated a dashboard from those records. That gave me more room to shape the workflow without carrying an extra runtime I no longer needed.

## References

- [AgentRig repository](https://github.com/inotives/agent-rig)
- [AgentRig workflow storage decision](https://github.com/inotives/agent-rig/blob/main/docs/adr/0004-sqlite-is-canonical-after-workflow-migration.md)
- [AgentRig planner-manager and worker-reviewer contract](https://github.com/inotives/agent-rig/blob/main/docs/phases/phase-26-planner-manager-worker-reviewer-contract.md)
- [Trinary Agents repository](https://github.com/inotives/trinary-agents)
- [Trinary Agents skill workflow and workspace contract](https://github.com/inotives/trinary-agents/blob/main/skills/trinary-agents/SKILL.md)
