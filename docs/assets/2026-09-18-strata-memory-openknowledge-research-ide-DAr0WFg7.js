var e=`---
title: "Strata Memory + OpenKnowledge: A Research IDE for Agent Knowledge"
date: 2026-09-18
tags: [agent-memory, openknowledge, open-knowledge-format, strata-memory, github, research-workflow]
series: building-ai-systems
summary: "OpenKnowledge turns a Markdown research space into an AI-native editing and collaboration environment. Combined with Strata Memory's tiered, reviewable vault, it creates a practical path from raw research to durable agent knowledge without making an editor the source of truth."
---

I have been drawn to the LLM-wiki pattern associated with Andrej Karpathy for a simple reason: it keeps knowledge visible. A person can open a Markdown file, see why a claim exists, correct it, and follow its links. An agent can do the same without being handed an opaque vector-store result and asked to trust it.

That idea is behind my own [Strata Memory](https://github.com/inotives/strata-memory): tiered, durable memory with source links, reviewable promotion, a rebuildable index, and rules for conflict or deletion. It answers the question, “What should this agent be allowed to remember?”

[OpenKnowledge](https://github.com/inkeep/open-knowledge) answers a different question: “How should humans and agents work on the Markdown knowledge base before that knowledge becomes durable?”

The distinction matters. A rich editor should make research easier. It should not quietly become a second, unreviewed memory system.

## The pairing: a research workbench and a durable vault

OpenKnowledge is a local Markdown editor and AI-native wiki that can open an existing folder. Its repository describes a WYSIWYG editor, file navigation, search, graph views, integrated AI editing, MCP and skills, plus optional Git/GitHub-based sharing. The underlying files remain Markdown and MDX, rather than being locked inside the editor. [OpenKnowledge repository](https://github.com/inkeep/open-knowledge)

That makes it a strong fit for a Strata-based workflow:

| Concern | OpenKnowledge | Strata Memory |
| --- | --- | --- |
| Main job | Capture, shape, link, inspect, and review research | Retain only durable, attributable agent knowledge |
| Primary material | Notes, source extracts, research drafts, specifications | Raw evidence, atomic facts, promoted summaries, deterministic guards |
| Human experience | Markdown editor, search, backlinks, terminal, AI side-by-side editing | Reviewable promotion and traceability over time |
| Agent experience | MCP/CLI access with document structure, links, and lint advisories | Retrieval from canonical records with provenance, supersession, and tombstones |
| Git role | Branches, optional GitHub sharing, collaboration on drafts | History and review record for promoted knowledge |

![OpenKnowledge is the research workbench where sources become structured drafts; reviewed knowledge is promoted into Strata Memory's tiered vault and retrieved by agents with provenance.](/assets/images/strata-memory-openknowledge-workflow.png)

The useful boundary is this: OpenKnowledge owns the *research experience*. Strata owns the *memory lifecycle*. They can both work with the same file-first philosophy without becoming the same product.

## Why Google’s Open Knowledge Format belongs in the middle

Google Cloud’s [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format) gives the wiki pattern a portable minimum contract: a directory of Markdown files with YAML frontmatter. It is deliberately vendor-neutral. A person, an agent, a data-catalog export, a static site, or a search index can produce or consume it.

OKF does not replace a memory lifecycle. It says how portable knowledge should be represented. Strata decides how a claim moves from raw evidence to a durable memory record. OpenKnowledge helps authors keep the files readable and structurally consistent while the work is still in progress.

This is the division I want:

\`\`\`text
source material
  -> research note in an OKF-shaped Markdown workspace
  -> review, links, frontmatter checks, and Git history
  -> explicit promotion into the Strata vault
  -> agent retrieval with source and lifecycle controls
\`\`\`

OKF v0.2 requires a small conformance floor: non-reserved documents have parseable YAML frontmatter with a non-empty \`type\`. It also provides conventions for indexes, links, provenance, verification, status, and staleness. The format does not need a central service or proprietary SDK. [OKF specification](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)

That is a healthy constraint. I can begin with a research folder that both tools understand, then add Strata-specific lifecycle fields only where they earn their keep.

## A practical project layout

I would keep research and durable memory as separate Git repositories, or at least separate worktrees with a strict promotion boundary. Research changes frequently. Durable memory should not be rewritten because someone rearranged notes or tried a new prompt.

\`\`\`text
agent-knowledge/
├── research-workspace/                 # OpenKnowledge project
│   ├── index.md
│   ├── sources/
│   ├── concepts/
│   ├── investigations/
│   ├── decisions/
│   └── .ok/
│       ├── schemas/
│       └── templates/
│
└── strata-vault/                       # Strata Memory canonical store
    ├── 0_inbox/                        # source captures and unreviewed material
    ├── 1_facts/                        # atomic, source-linked claims
    ├── 1_5_aggregation/                # proposed merges and contradictions
    ├── 2_episodes/                     # project and investigation context
    ├── 3_continuity/                   # curated operating knowledge
    └── 4_guards/                       # deterministic rules and policies
\`\`\`

The exact folder names are less important than the rule: a source capture is not an agent instruction, and a research draft is not a durable fact. Strata’s tiers make that distinction explicit. OpenKnowledge makes the draft stage much less painful to maintain.

## What OpenKnowledge adds to the research stage

The feature list is unusually complete for this job. The interesting parts are not the visual polish. They remove the small bits of friction that normally cause a Markdown wiki to decay.

### A Markdown editor with a terminal beside it

Research often needs both prose and command output. A person might inspect a repository, run a data check, ask an agent to compare documentation, then write down what was actually learned. Switching among a terminal, an editor, and an agent chat is manageable for one task; it gets messy across weeks of investigation.

OpenKnowledge includes a built-in terminal and can connect to agent harnesses through MCP, CLI, and its AI-editing surfaces. That lets the research workspace stay visible while an agent performs bounded work. The agent can read linked documents, use the workspace structure, and return a draft for review instead of writing an untraceable answer into a chat history. [OpenKnowledge overview](https://openknowledge.ai/docs/get-started/overview)

For example, an investigation into a new data provider might end as a draft like this:

\`\`\`yaml
---
type: Research
title: "Provider X historical-market-data evaluation"
status: draft
sources:
  - id: provider-docs
    title: "Provider X API documentation"
    resource: https://example.com/docs
verified: 2026-09-18
promotion_target: "strata-vault/1_facts/provider-x.md"
---
\`\`\`

The body records the test method, observed limits, open questions, and links to related concepts. A human decides whether any conclusion is ready for the vault.

### Folder templates instead of ritual copying

Most knowledge bases become inconsistent because every new note starts blank. The first author remembers to add provenance fields; the tenth does not. Then the retrieval path has to guess which documents are trustworthy.

OpenKnowledge supports folder-level templates under \`.ok/templates/\`. Its current model keeps each document’s frontmatter explicit on disk rather than secretly inheriting it from a parent folder. That is the right trade-off for a Git-managed knowledge base: a reviewer can see the fields that will travel with a file. [OpenKnowledge templates and folder metadata](https://openknowledge.ai/docs/changelog/v0.9.0)

I would create small templates for source capture, investigation, decision record, and promotion proposal. A promotion proposal should include the intended Strata tier, sources, confidence, review owner, and expiry or re-check date when the subject can drift.

### YAML frontmatter that agents can validate

Frontmatter only helps when it is consistent. OpenKnowledge can apply standard JSON Schema rules to frontmatter, show problems while editing, expose those rules to agents, and emit lint advisories when an agent writes a document that does not satisfy a governing schema. [OpenKnowledge frontmatter schemas](https://openknowledge.ai/docs/advanced/content-rules/frontmatter)

This is where the pairing becomes operational rather than aesthetic. A research agent should not have to remember, from a prompt alone, that a security decision needs an owner, sources, a review date, and a status. The workspace can state the contract mechanically.

The schema should remain small. Requiring \`type\`, \`status\`, \`sources\`, and \`verified\` is useful. Creating thirty metadata fields before anyone has searched the vault twice is a reliable way to make people stop writing.

### GitHub collaboration without giving up local files

OpenKnowledge can optionally use Git/GitHub for sync and team sharing. That is valuable for a research group because the native unit of review remains a file diff. A teammate can see a changed claim, its cited source, its frontmatter, and the links affected by the edit.

I would still keep the workflow conservative:

1. An agent creates or updates a \`draft\` research document on a branch.
2. A human reviews source links, frontmatter, and conclusions in GitHub.
3. The approved conclusion is promoted into the Strata vault through a separate, explicit change.
4. Strata indexes the promoted document; the original research link remains part of the evidence trail.

GitHub is the collaboration and review surface. It should not be the hot retrieval path for an agent handling a live request. Strata can rebuild its local indexes from the canonical files and apply its own tombstone, supersession, and guardrail rules before retrieval.

## What I would not merge together

It is tempting to point every agent directly at the research workspace and call it memory. That creates three problems.

First, drafts acquire accidental authority. A confident-looking note about an API or policy becomes an agent answer before anyone checks it.

Second, tool configuration can become an unreviewed security boundary. OpenKnowledge supports project configuration, MCP, and skills. Teams should decide what belongs in the shared repository and what stays local to a contributor’s machine. The project’s sharing mode is a deployment decision, not a formatting preference.

Third, search results can flatten trust. A keyword match in an old investigation should not outrank an approved current fact merely because it has more words. Strata’s source links, lifecycle tiers, supersession, and deterministic guards exist to keep those states distinct.

OpenKnowledge’s own documentation makes a compatible privacy point: optional semantic search is local-cache based, off by default, and may send queries and matching text to a configured provider when enabled. Treat that as a conscious per-project choice, especially in a private company vault. [OpenKnowledge agentic search](https://openknowledge.ai/docs/reference/agentic-search)

## A small first implementation

The first version does not need a migration of the entire Strata vault.

1. Create one \`research-workspace\` repository and open it in OpenKnowledge.
2. Add two templates: \`research\` and \`promotion-proposal\`.
3. Add one frontmatter schema that requires type, status, and sources.
4. Use the built-in terminal and an approved agent harness to produce drafts from named sources.
5. Promote only reviewed claims into a small Strata namespace, preserving the research-document link.
6. Review the failure cases after a month: missing sources, bad links, stale proposals, confusing metadata, and accidental direct writes.

If this works, add OKF conformance checks to the research repository. OpenKnowledge ships an OKF starter pack and plugin that can scaffold the bundle and warn when edits would be hard for another OKF consumer to read. [OpenKnowledge OKF workflow](https://openknowledge.ai/docs/workflows/supporting-open-knowledge-format)

## Why this feels like the next level

The LLM-wiki idea has always been more convincing than “put everything in a vector database.” Plain files, links, a map, and good habits are enough to make knowledge navigable. But habits alone do not give a team an editor, templates, schema feedback, terminal work, agent access, or a Git-native review loop.

OpenKnowledge follows the idea through the parts that are usually left to improvised tooling. Strata Memory keeps the equally important line between research material and durable agent memory. OKF gives the files a portable contract between them.

That combination is what I want for a research-specific IDE: Markdown remains the asset, Git remains the review history, OpenKnowledge makes investigation faster, and Strata decides what an agent should carry forward.

## References

- [OpenKnowledge repository](https://github.com/inkeep/open-knowledge)
- [OpenKnowledge documentation](https://openknowledge.ai/docs/get-started/overview)
- [OpenKnowledge: agentic search](https://openknowledge.ai/docs/reference/agentic-search)
- [OpenKnowledge: frontmatter schemas](https://openknowledge.ai/docs/advanced/content-rules/frontmatter)
- [OpenKnowledge: supporting OKF](https://openknowledge.ai/docs/workflows/supporting-open-knowledge-format)
- [Google Cloud Open Knowledge Format specification](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)
- [Strata Memory](https://github.com/inotives/strata-memory)
`;export{e as default};