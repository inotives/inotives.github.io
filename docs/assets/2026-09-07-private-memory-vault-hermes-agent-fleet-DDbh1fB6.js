var e=`---
title: "A Private Memory Vault for a Hermes Agent Fleet"
date: 2026-09-07
tags: [ai-agents, agent-memory, hermes-agent, strata-memory, github, mcp, privacy]
summary: "A concrete design for giving multiple Hermes agents durable shared memory without sharing their session databases: Strata Markdown as the canonical vault, local indexes for retrieval, MCP tools for access, and a private GitHub workflow for review and history."
series: building-ai-systems
---

# A Private Memory Vault for a Hermes Agent Fleet

One Hermes agent can remember a preference. A fleet needs to remember a decision.

Those are different jobs.

Hermes has useful built-in persistent memory: small profile-scoped \`MEMORY.md\` and \`USER.md\` files injected at session start. That is the right place for an agent’s local operating facts and a user’s communication preferences. It is deliberately bounded. Hermes also warns against pointing multiple agent processes at the same home directory, because concurrent writers would create shared state that neither agent clearly owns.

The answer is not a shared Hermes home. It is a separate, private knowledge vault that every Hermes profile can search and contribute to through a controlled workflow.

This is the design I would use: Strata Memory supplies canonical Markdown, a local rebuildable index, validation, and a draft-to-durable lifecycle. A private GitHub repository supplies history, review, and cross-machine distribution. Hermes reaches the vault through a small MCP sidecar rather than a fork of Hermes itself.

## Two kinds of memory, two ownership models

Keep the distinction explicit.

| Memory | Owner | Example | Storage |
| --- | --- | --- | --- |
| Hermes local memory | one Hermes profile | "This agent uses the staging database by default" | profile-scoped \`MEMORY.md\` and \`USER.md\` |
| Shared fleet knowledge | the private agent fleet | "Provider X sends delayed final prices during its daily maintenance window" | reviewed Strata Markdown in a private Git repository |
| Session state | one task or conversation | tool calls, pending approvals, intermediate reasoning | Hermes session database and workflow store |

Do not pour all three into one database. Session state changes quickly and can contain sensitive conversation material. Personal memory is short and profile-specific. Shared knowledge should be durable, attributable, searchable, and safe for another agent to act on next month.

For a crypto-data fleet, this means the research agent can learn a provider’s documented maintenance window, the operations agent can confirm it after an incident, and a reporting agent can retrieve the approved convention later. None of them needs the others’ private chat history or unfinished scratch work.

## The architecture: Git stores truth, Strata accelerates retrieval

\`\`\`text
Hermes research profile ─┐
Hermes operations profile ─┼─> Strata memory MCP sidecar ─> local vault checkout
Hermes reporting profile ─┘                                  |
                                                                  v
                                                    private GitHub memory repository
                                                                  |
                                               protected main + validation + review
\`\`\`

The private GitHub repository contains the Markdown vault. It does not contain the Strata index database, embedding cache, raw conversation exports, API keys, or agent session database.

Strata already follows the right source-of-truth model: Markdown is canonical; its SQLite index is derived and rebuildable with \`strata refresh\`. Every Hermes host can keep its own local index. That avoids treating a synchronised SQLite file as shared infrastructure and avoids Git conflicts in a database journal.

Each Hermes profile should also have its own vault checkout or Git worktree. Sharing a checkout creates a new kind of concurrency bug: two agents can overwrite each other’s working tree, index, or merge state. Separate checkouts are cheap. Lost knowledge is not.

## Give the vault a small, intentional information architecture

Use Strata’s tiers to distinguish provisional discovery from reusable knowledge:

\`\`\`text
1_draft/inbox/hermes-research/       candidate observations from research work
1_draft/inbox/hermes-operations/     findings from incidents and operations
2_knowledge/projects/                verified system facts and project decisions
2_knowledge/providers/               external provider behavior and contracts
3_intelligence/workflows/            reusable operating procedures and playbooks
3_intelligence/agent-profiles/       fleet-wide agent roles and safe defaults
\`\`\`

An item becomes shared knowledge only when it has enough context for another agent to use safely. A durable entry needs a source, date, scope, confidence or review status, and a correction path.

For example, this is weak memory:

\`\`\`text
Provider X is often late. Be careful.
\`\`\`

This is reusable knowledge:

\`\`\`yaml
title: "Provider X final-price maintenance window"
source: provider-status-page-2026-09-07
observed_at: 2026-09-07
scope: market-data/provider-x
status: reviewed
\`\`\`

\`\`\`text
Provider X publishes preliminary prices at 02:00 UTC and finalises its daily
batch by 02:20 UTC. Do not classify rows observed before 02:25 UTC as stale
without a second source. The operations owner confirmed this after incident INC-1042.
\`\`\`

The difference is not writing style. It is whether the next agent can understand when the rule applies and who can correct it.

## Start with an MCP sidecar, not a Hermes fork

Hermes can connect to external MCP servers. That makes a sidecar the smallest useful integration.

The proposed server wraps the local Strata CLI and a constrained file layer. Its first toolset should stay small:

\`\`\`text
memory_search(query, scope, limit)
memory_read(path)
memory_capture_draft(title, content, tags, evidence)
memory_status()
\`\`\`

\`memory_search\` calls \`strata search --json\` and returns a bounded set of excerpts with paths, source metadata, and review status. It should never inject an entire vault into the model context.

\`memory_read\` accepts only a path returned by search and only inside approved shared rooms. This blocks a model from treating the filesystem as a general discovery interface.

\`memory_capture_draft\` writes to the calling profile’s inbox. It records the agent profile, task ID, source links, and evidence. It does not write directly to \`2_knowledge\` or \`3_intelligence\`.

\`memory_status\` shows the local Git revision, index freshness, current branch, and validation state. This matters when an agent needs to explain whether it retrieved current fleet knowledge or an older local checkout.

A proposed Hermes configuration looks like this:

\`\`\`yaml
mcp_servers:
  strata_memory:
    command: "/opt/hermes-memory/strata-memory-mcp"
    args: ["--vault", "/srv/hermes-memory-vault"]
\`\`\`

The adapter is new code. Hermes and Strata do not ship this exact server today. Keeping it external means it can evolve without changing Hermes’s session lifecycle or the Strata core.

## Read freely, promote carefully

The fleet should use a one-way knowledge flow:

\`\`\`text
agent discovers something
  -> writes a profile-scoped draft
  -> validation and review
  -> promotion into durable shared room
  -> pull and local Strata refresh on other Hermes hosts
  -> later agents retrieve the reviewed entry
\`\`\`

The key rule is that retrieval is cheap, but promotion is deliberate.

An agent can capture a completed work summary or a correction from a user. It should skip credentials, raw customer messages, private tokens, speculative conclusions, and transient tool output. A research agent’s hypothesis becomes fleet knowledge only after it has evidence and a review decision.

For the first version, require human approval for promotion. Later, a trusted curator agent can propose promotion, but the GitHub pull request should still show the exact Markdown diff and validation output. A reviewer needs to see what will become permanent before it reaches every agent.

## Let each Hermes profile contribute through GitHub, within a draft boundary

Each Hermes profile can have its own GitHub identity and access to the private vault repository. That makes contribution a normal part of agent work: an agent learns something useful, creates a draft branch, commits the evidence-backed note, and opens a pull request for the human reviewer.

Use a GitHub App installation or a dedicated bot identity for each profile or trust tier. Install it only on the memory repository and grant only the permissions needed to read contents, create branches, write draft files, and open pull requests. Do not give an agent a personal access token that also reaches unrelated repositories, organisation settings, or the user’s account.

The contribution path should be explicit:

\`\`\`text
Hermes operations profile
  -> capture draft through the Strata MCP tool
  -> branch: draft/hermes-operations/INC-1042
  -> commit: 1_draft/inbox/hermes-operations/provider-x-window.md
  -> pull request with source, task ID, and validation output
  -> human reviewer promotes the entry into 2_knowledge or 3_intelligence
  -> protected main merge makes it visible to the fleet
\`\`\`

This gives every observation an author and a review trail. It also means an agent can contribute from any Hermes host that has its own checkout and credential, without sharing a filesystem or a Hermes home directory.

GitHub repository permissions do not enforce a safe Markdown path by themselves. A bot that can write repository contents can still attempt to edit a durable knowledge file. Enforce the draft boundary twice:

- the MCP sidecar writes only under the calling profile's \`1_draft/inbox/\` path;
- a pull-request check rejects agent-authored changes outside that path;
- \`main\` is protected from direct agent pushes;
- human review and CODEOWNERS are required for changes to \`2_knowledge/\` and \`3_intelligence/\`.

The human reviewer is not a bottleneck for every note. They are the point at which a candidate observation becomes a fleet-wide operating rule. A rejected draft stays useful evidence of what the agent saw; it simply does not become default guidance for other agents.

## Use GitHub as a ledger and review surface, not a hot path

GitHub gives the fleet four useful properties:

- commit history answers when a fact changed and why;
- pull requests make proposed knowledge reviewable;
- branch protection can require checks and restrict direct pushes;
- every Hermes host can recover the same canonical vault revision.

It should not sit inside every inference turn. An agent reads its local checkout and local Strata index. A sync worker or explicit lifecycle step pulls durable changes, refreshes the local index, and records the revision. Capturing every sentence from every chat as a Git commit would create noise, merge conflicts, and a long-lived privacy problem.

Use one branch per promotion. Agent drafts should be append-only and namespaced by profile, which makes conflicts rare. Durable edits to a shared rule deserve a pull request because they can change behavior across the fleet.

The repository’s \`main\` branch should require the validation workflow:

\`\`\`text
strata normalize --check
strata doctor
strata link-review
strata tag-review
strata room-review
strata privacy-review
\`\`\`

GitHub branch protection can require reviews and status checks before merge. For a private memory vault, that is a better default than trusting every agent process with direct write access to the fleet’s long-term beliefs.

## Privacy needs a design, not a disclaimer

Private GitHub is necessary but insufficient. The vault can still be copied, a token can be exposed, or a well-meaning agent can commit more personal data than another agent needs.

Set policy before the first capture:

\`\`\`text
never commit API keys, passwords, access tokens, or private keys
never commit raw customer conversations or full tool dumps
store identifiers only when they are essential to a durable operating rule
link to a protected source system instead of copying sensitive records
label entries with scope, owner, source, and retention expectation
run privacy review before a pull request can merge
\`\`\`

Keep private user preferences in Hermes’s profile-scoped \`USER.md\` unless there is a clear fleet-wide reason to share them. A support agent does not need a research agent’s conversation preferences. Scope is a retrieval and write concern, not a frontmatter field that the model is free to ignore.

## A real fleet workflow

Imagine three Hermes profiles during a market-data incident.

The operations profile detects that Provider X has stopped publishing final prices. It captures a draft with the failing run ID, timestamps, status-page link, and affected marts. The research profile confirms the provider’s maintenance announcement and adds a source. The reporting profile continues to produce an incomplete report, rather than treating preliminary prices as final.

A data steward reviews the combined proposal. They promote a durable provider-maintenance rule into \`2_knowledge/providers/\` and update a controlled workflow in \`3_intelligence/workflows/\`. GitHub records the change. Other Hermes hosts pull the revision and refresh their local Strata index.

The next day, each agent can retrieve the same approved rule. None of them needs access to the incident channel, the raw provider payload, or the other agents’ local session files.

## Test it as a multi-agent system

The initial acceptance tests should be boring and strict:

\`\`\`text
Agent A captures a draft; Agent B cannot retrieve it before promotion.
After merge and sync, Agent B retrieves the approved entry with its source.
Deleting a local Strata index and running refresh restores search results.
An entry containing a mock secret fails privacy validation.
Two profiles create drafts concurrently without a Git conflict.
An expired or superseded rule is ranked below the current reviewed rule.
\`\`\`

Add a retrieval evaluation too. Give a Hermes agent an incident question with one relevant approved rule, one stale rule, and several unrelated notes. It should return the right rule, disclose the source and date, and avoid treating a draft as durable guidance.

## The smallest useful first milestone

Do not start by automatically extracting memory from every Hermes conversation. Start with one private vault, one Hermes profile, one read-only MCP server, and one manually reviewed promotion path.

When that works, add draft capture for a second agent. Then add GitHub Actions validation and protected merges. Only after those boundaries are boring should you consider a native Hermes memory-provider plugin that injects selected Strata excerpts at session start.

The goal is not an agent that remembers everything. It is a private fleet that can retain the right things, explain where they came from, and correct them without leaving a trail of unowned chat history.

## References

- [Strata Memory repository](https://github.com/inotives/strata-memory)
- [Hermes Agent persistent memory documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)
- [Hermes Agent MCP documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
- [GitHub: protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub: authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [One Memory Core, Many Agent Harnesses: What Portability Actually Requires](/notes/2026-08-29-portable-agent-memory-across-harnesses)
- [TencentDB Agent Memory and Strata Memory: Two Different Takes on Long-Term Agent Context](/notes/2026-08-26-tencentdb-agent-memory-vs-strata-memory)
`;export{e as default};