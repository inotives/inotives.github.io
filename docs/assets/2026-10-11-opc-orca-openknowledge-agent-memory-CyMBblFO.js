var e=`---
title: "Building a one-person company with Orca, OpenKnowledge, and agent memory"
date: 2026-10-11
tags: [ai-agents, agentic-memory, openknowledge, orca, one-person-company, multi-agent-systems, agent-rig]
summary: "A practical design for a one-person company that uses Orca to coordinate role-based agents, OpenKnowledge to store durable company memory, and Claude, Codex, OpenCode, or other CLI agents to execute the work."
series: building-ai-systems
---

A one-person company does not have to mean one person doing every task.

It can mean one person setting direction while a small fleet of agents handles research, operations, documentation, customer work, engineering, and administration. That fleet only becomes useful when every agent can answer the same questions:

- Who are we?
- What do we do?
- How do we do it?
- Who owns each responsibility?
- Where are we now?
- What must we never do?

Those answers need a durable home. They should not live only in chat history or inside one agent's context window.

![One-person company agentic operating system](/assets/images/opc-agentic-operating-system.svg)

This article proposes an operating model built from three layers: Orca for fleet coordination, OpenKnowledge for the company wiki and agentic memory, and CLI agents such as Claude, Codex, OpenCode, or Antigravity for execution. AgentRig fits at the end as the project-local workflow and review layer.

## What is a one-person company?

A one-person company, or OPC, is a business operated by one owner who may use software, contractors, automation, and agents to perform work that would otherwise require a larger team.

The legal form varies by country. This article uses OPC as an operating model, not legal or tax advice. The useful question is not whether the company has one employee. It is how one owner can create clear responsibilities without pretending that an agent has human authority.

The owner remains accountable for direction, commitments, approvals, and risk. Agents can hold roles, execute procedures, and produce recommendations. They should not silently become the company.

## The memory problem comes before the agent fleet

Without shared memory, every agent starts from a partial picture. The strategy agent knows one version of the business. The operations agent has another. A research agent may create a useful note that nobody can find later.

The usual response is to write more prompts. That only moves the problem into a longer instruction file. A better response is to create a company memory that is structured, searchable, reviewable, and local to the business.

OpenKnowledge is a natural fit for this layer. Its official repository describes it as an AI-native Markdown editor and LLM wiki with desktop and web interfaces, agentic search, MCP and skills integrations, and optional Git/GitHub sync. It can open an existing folder of Markdown or MDX files and help agents work with that knowledge.

The important point is the storage model: the company memory remains understandable as files. Agents can search and author it through the supported integrations, while the owner can inspect the same pages directly.

## The OPC memory structure

The memory structure should answer the six questions at the top of the article. The folders are not decorative categories. Each one is a boundary for a different kind of decision.

![OpenKnowledge memory structure for a one-person company](/assets/images/opc-openknowledge-memory-structure.svg)

\`\`\`text
company-memory/
├── AGENTS.md
├── Owner/
│   ├── AGENTS.md
│   ├── Boss.md
│   └── CTO.md
├── Branding/Company/
│   ├── AGENTS.md
│   └── company-profile.md
├── Business/
│   ├── AGENTS.md
│   ├── products/
│   ├── channels/
│   └── customers/
├── BAU/
│   ├── AGENTS.md
│   ├── procedures/
│   └── checklists/
├── Skills/
│   ├── AGENTS.md
│   └── skill-catalog.md
├── Roles/
│   ├── AGENTS.md
│   ├── strategist.md
│   ├── operator.md
│   └── reviewer.md
└── Memo/
    ├── AGENTS.md
    ├── research/
    ├── ideas/
    └── decisions/
\`\`\`

The names can change. The separation should remain.

### \`AGENTS.md\` in every folder

Each folder gets a local \`AGENTS.md\` that explains what the folder is for, which rules apply, what a page should contain, and what an agent must not change without approval.

The nearest \`AGENTS.md\` gives an agent local instructions. A root file explains company-wide behavior. A folder file narrows it to a domain.

For example, \`BAU/AGENTS.md\` might say that procedures must include an owner, trigger, inputs, steps, expected result, failure path, and review date. \`Roles/AGENTS.md\` might require every role definition to include scope, skills, reporting line, tone, guardrails, and acceptance criteria.

These files are navigation and policy together. They tell an agent how to read the rest of the memory.

### \`Owner/\`: authority and accountability

\`Owner/\` describes the people who are responsible for the company and the agent fleet. A \`Boss.md\` file can define the owner's priorities, decision rights, approval boundaries, and communication preferences. A \`CTO.md\` file can define technical authority and escalation paths.

The files should describe roles and responsibilities, not become a secret store. Keep sensitive values outside the wiki and reference the approved process for accessing them.

### \`Branding/Company/\`: identity

This folder records the company identity agents need in order to communicate consistently: brand language, company description, public positioning, visual references, and durable company facts.

It answers “who are we?” without forcing every agent prompt to repeat the same background.

### \`Business/\`: current commercial reality

\`Business/\` stores the active business lines, products, channels, customer context, and current commercial assumptions. It answers “what do we do?” and “where are we now?”

Keep current state separate from historical research. A current product brief should not be confused with an old idea that was never launched.

### \`BAU/\`: how the company keeps operating

Business-as-usual procedures describe recurring work: opening the day, handling an order, publishing content, reviewing an account, supporting a customer, or closing a weekly cycle.

Each procedure should be executable by a role agent but reviewable by the owner. Include the trigger, expected inputs, steps, success criteria, failure path, and last review. A procedure without a failure path is only a happy-path note.

### \`Skills/\`: the shared capability catalog

Centralize reusable skills here. Role definitions can point to the catalog rather than copying the same skill instructions into every agent configuration.

This makes updates easier. A change to a shared skill can be reviewed once, then picked up by the role agents that use it. The tradeoff is blast radius: skill changes need an owner and a clear compatibility note.

### \`Roles/\`: the fleet's operating contracts

Roles are where the company defines who does what. A role file should include:

- job scope and reporting line;
- skills it may use;
- tasks it may perform;
- actions it must not take;
- communication tone;
- approval requirements;
- acceptance criteria;
- expected outputs and handoff format.

An agent CLI is assigned a role. The role is not the agent's identity in the model-provider sense. It is the company's operating contract for that assignment.

### \`Memo/\`: working memory and history

Research, ideas, decision notes, experiments, and meeting summaries belong in \`Memo/\`. This area can be more fluid than \`Business/\` or \`BAU/\`, but it still needs status.

Mark a memo as draft, reviewed, accepted, superseded, or archived. Otherwise agents will treat an untested idea as a current business rule.

## Orca as the communication layer

Orca describes itself as an ADE for working with a fleet of parallel agents. It supports running coding agents with the user's own subscriptions and presents desktop, mobile, and remote runtime options. Its repository lists support for agents including Claude Code, Codex, OpenCode, and others.

In this OPC design, Orca is the fleet coordinator. It assigns a task to a role agent, starts parallel work when appropriate, shows progress, and collects results.

![Orca coordinating role agents through OpenKnowledge](/assets/images/opc-orca-role-communication.svg)

Orca should not become the company's memory by accident. The communication layer can carry a task, a question, a status update, or an artifact. The durable company memory should be written back to OpenKnowledge as Markdown with an owner, status, scope, and review context.

That gives the fleet a clean split:

\`\`\`text
Orca
  → communication, dispatch, parallel work, status

OpenKnowledge
  → company memory, search, authoring, reviewable files

Role agent CLI
  → execution using the assigned role and skills
\`\`\`

## A memory-aware Orca workflow

Suppose the owner asks, “Review this new opportunity and tell me whether it fits the current business.”

1. Orca assigns the work to a strategy or research role.
2. The agent reads the nearest \`AGENTS.md\` and its role definition.
3. It searches \`Branding/Company/\` for identity and \`Business/\` for current context.
4. It reads relevant \`Skills/\` and follows the research procedure in \`BAU/\` if one exists.
5. It writes a draft finding into \`Memo/\` with status and sources.
6. A reviewer role checks the finding against the role's acceptance criteria.
7. The owner approves, rejects, or asks for another pass.
8. The accepted outcome updates the relevant business page and leaves the research memo linked as evidence.

The agent does not need every file. It needs the right path through the memory.

## How agents create and index new memory

An agent should write memory through the OpenKnowledge-supported MCP and skills workflow, or through the normal Markdown editing path that the repository supports. The process should preserve the page lifecycle:

\`\`\`text
agent discovers a reusable fact
  → draft Markdown page
  → add owner, status, scope, and source
  → run structure and link checks
  → owner or role reviewer approves
  → OpenKnowledge indexes the page
  → other agents can search and reuse it
\`\`\`

The index is a view over the files. The files remain inspectable and versionable. If the index is rebuilt, the memory does not disappear.

## Guardrails for an OPC fleet

The owner needs a few hard boundaries:

- agents read the nearest \`AGENTS.md\` before editing;
- agents write drafts before publishing company-wide rules;
- external commitments require owner approval unless explicitly delegated;
- role agents cannot silently change another role's definition;
- generated output is not treated as canonical source material;
- current business state is separated from research and ideas;
- every important page has an owner and review status;
- procedures include failure paths and escalation routes;
- shared skills are versioned and reviewed for blast radius;
- agents report uncertainty instead of inventing company policy.

The goal is not to make a one-person company bureaucratic. It is to stop a fast agent fleet from turning an undocumented assumption into an operating rule.

## Where AgentRig fits

AgentRig is the project-local workflow layer. Its official repository describes a filesystem-first TypeScript CLI that scaffolds \`.agent-rig/\` workspaces, keeps shared context and workflow records near the project, and supports profiles, tasks, handoffs, and worker/reviewer patterns while letting users run subscription tools such as Claude, Codex, or OpenCode.

![OpenKnowledge, Orca, and AgentRig integration](/assets/images/opc-agentrig-integration.svg)

The combined model is:

\`\`\`text
OpenKnowledge
  → company-wide memory and role/skill definitions

Orca
  → fleet communication and parallel agent coordination

Claude / Codex / OpenCode / Antigravity
  → role execution

AgentRig
  → project task, local context, handoff, and review evidence
\`\`\`

An Orca-dispatched role can open an AgentRig project task when the work touches code or another bounded project. The agent reads company policy from OpenKnowledge, reads project-local rules from AgentRig, performs the work, and writes the result into the project handoff. Only the reviewed, reusable outcome is promoted back into company memory.

That avoids two bad extremes. The company wiki does not need every transient project log. The project workspace does not need to copy the entire company memory into every task.

## The smallest useful OPC setup

Start with one owner, three roles, and one recurring workflow:

\`\`\`text
Owner
  ├── Strategy / research role
  ├── Operations role
  └── Reviewer role

Orca → dispatches the roles
OpenKnowledge → stores the memory
AgentRig → tracks project work
\`\`\`

Add more roles when a repeated responsibility has a clear procedure and acceptance test. Do not create a role because a name sounds useful. A role needs a scope, a skill set, an output contract, and a human escalation path.

The one-person company is still one person's responsibility. Orca makes the fleet easier to coordinate. OpenKnowledge makes the company easier to remember. AgentRig makes project work easier to audit and resume.

## References

- [Orca official repository](https://github.com/stablyai/orca)
- [OpenKnowledge official repository](https://github.com/inkeep/open-knowledge)
- [OpenKnowledge documentation](https://openknowledge.ai/docs)
- [AgentRig official repository](https://github.com/inotives/agent-rig)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)
- [OpenAI Codex](https://github.com/openai/codex)
- [OpenCode](https://github.com/anomalyco/opencode)
`;export{e as default};