var e=`---
title: "n8n: The Low-Code Platform With 195K GitHub Stars That Isn't What You Think"
date: 2026-07-03
tags: [n8n, workflow-automation, low-code, business-automation, ai-agents]
series: data-engineering
summary: "n8n is the most starred workflow tool on GitHub (195K stars). But it is not open source — it uses the Sustainable Use License (fair-code). Visual drag-and-drop editor, 400+ integrations, built-in AI agents. Used by Microsoft, Meta, NVIDIA. Targets business users, not data engineers. Here's what it actually does, what it can't do, and why it complements rather than competes with Airflow/Prefect/Kestra."
---

# n8n: The Low-Code Platform With 195K GitHub Stars That Isn't What You Think

n8n (pronounced "n-eight-n") is a low-code workflow automation platform created in 2019 by Jan Oberhauser. The name stands for "nodemation" (node + automation). 195,017 GitHub stars, 59,022 forks, TypeScript (91M lines). The license is Sustainable Use License (fair-code, NOT open source) — free for internal business use, but not OSI-approved. You can self-host it, but you cannot resell it.

400+ integrations. Built-in AI agents. MCP (Model Context Protocol) support. A community template library of 10,000+ workflows. Used by Microsoft, Meta, NVIDIA, Dell, Mercedes-Benz, Vodafone.

The critical distinction: n8n is not a competitor to Airflow, Prefect, or Kestra. It serves a completely different audience.

## How n8n works

You drag nodes from a sidebar onto a canvas. You connect them with lines. You configure each node with forms. No code required for basic automations. Code steps (JavaScript/Python) are available when low-code is not enough.

\`\`\`
[Webhook Trigger] → [Google Sheets: Read Row] → [IF: Amount > 1000]
                                                    → Yes → [Slack: Notify Manager]
                                                    → No → [Slack: Notify Team]
\`\`\`

**Core concepts:**

| Concept | Description |
|---------|-------------|
| Workflow | A chain of connected nodes that automate a process |
| Node | A single step in a workflow (integration, logic, code) |
| Trigger | What starts a workflow (webhook, schedule, event) |
| Connection | Links between nodes that pass data |
| Expression | JavaScript expressions that transform data between nodes |
| Credential | Stored authentication for external services |

**Key differences from engineering orchestrators:**

| Aspect | n8n | Airflow/Prefect/Kestra |
|--------|-----|----------------------|
| Authoring | Visual drag-and-drop | Code (Python/YAML) |
| Target user | Business users | Data engineers |
| Learning curve | Minutes | Hours to days |
| Complexity | Simple to moderate | Moderate to complex |
| Code requirement | Optional | Required |

## Scalability

n8n scales differently from engineering orchestrators. It is not designed for petabyte-scale data processing.

| Dimension | Capability |
|-----------|-----------|
| Concurrent Executions | 5 (Starter) to 200+ (Enterprise) |
| Workflows | Unlimited |
| Executions | 2.5K/mo (Starter) to custom (Enterprise) |

Self-hosted scaling: run on Docker/Kubernetes, use queue mode (Redis) for multi-worker setups. Cloud scaling: n8n Cloud handles infrastructure, upgrade plans for more capacity.

**Scalability limits:** Cloud plans have execution limits (2.5K/mo Starter, 40K/mo Business). Visual editor becomes hard to manage for complex workflows (50+ nodes). Not designed for petabyte-scale data processing. Single-tenant architecture in self-hosted.

## Enterprise options and licensing

| Dimension | Self-Hosted (Community) | Cloud (Starter/Pro) | Business (Self-Hosted) | Enterprise |
|-----------|------------------------|--------------------|-----------------------|------------|
| Cost | Free | $20-50/mo | $800/mo | Contact Sales |
| License | Sustainable Use | Sustainable Use | Sustainable Use | Sustainable Use + EE |
| SSO/SAML/LDAP | No | No | Yes | Yes |
| Version Control (Git) | No | No | Yes | Yes |
| Environments | No | 2 (dev/prod) | Multiple | Multiple |
| External Secrets | No | No | No | Yes |

**The licensing catch:** n8n uses the Sustainable Use License, which is NOT open source. Free for internal business use and non-commercial purposes. Cannot redistribute for commercial purposes. Enterprise features (SSO, RBAC, Git version control) require paid plans. This is different from Apache 2.0 (Airflow, Prefect, Spark, Kestra).

## Integrations and AI features

400+ built-in integrations:

| Category | Examples |
|----------|---------|
| Cloud Storage | Google Drive, Dropbox, OneDrive, Box, S3 |
| Communication | Slack, Discord, Telegram, Email, Microsoft Teams |
| CRM | Salesforce, HubSpot, Pipedrive, Freshsales |
| Databases | PostgreSQL, MySQL, MongoDB, Redis, Airtable, Supabase |
| E-commerce | Shopify, WooCommerce, Stripe, PayPal |
| Project Management | Jira, Asana, Trello, Notion, Monday.com |
| Marketing | Mailchimp, ActiveCampaign, Google Analytics, Facebook |
| Developer | GitHub, GitLab, Jenkins, PagerDuty, Sentry |
| AI/ML | OpenAI, Anthropic, Google Gemini, Hugging Face, Ollama |

**AI capabilities (major differentiator):**

| Feature | Description |
|---------|-------------|
| AI Agent node | Build autonomous AI agents with tools and memory |
| RAG workflows | Retrieval-augmented generation with vector stores |
| MCP support | Model Context Protocol server and client |
| AI Workflow Builder | Generate workflows from natural language prompts |
| LLM nodes | OpenAI, Anthropic, Google, local models (Ollama) |
| Memory | Conversation memory, vector store integration |

n8n provides an MCP server that allows AI assistants (Claude Desktop, Claude Code, Codex CLI) to interact with n8n workflows. This makes n8n a backend for AI-powered automation.

## n8n vs engineering orchestrators

n8n operates at a different layer than Airflow/Prefect/Kestra:

\`\`\`
Business Automation (n8n)
  Connect SaaS apps
  Automate business processes
  No-code / low-code
  400+ integrations

Data Engineering (Airflow/Prefect/Kestra)
  Orchestrate data pipelines
  Schedule complex jobs
  Code-first (Python/YAML)
  Scale to petabytes
\`\`\`

| Dimension | n8n | Airflow | Prefect | Kestra |
|-----------|-----|---------|---------|--------|
| Target user | Business users | Data engineers | Data engineers | Engineers |
| Authoring | Visual drag-and-drop | Python DAGs | Python decorators | YAML |
| Coding | Optional (JS/Python) | Required | Required | Not required |
| Integrations | 400+ (SaaS focus) | 80+ providers | 50+ integrations | 1,700+ plugins |
| License | Sustainable Use (fair-code) | Apache 2.0 | Apache 2.0 | Apache 2.0 |
| Scale | Hundreds of workflows | Thousands of DAGs | Hundreds of flows | Millions of workflows |
| Data processing | Light (JSON) | Heavy (Spark, etc.) | Medium | Heavy |

## Where n8n fits and where it doesn't

| Use Case | n8n | Engineering Orchestrator |
|----------|-----|------------------------|
| Send Slack message when form submitted | Perfect | Overkill |
| Sync Salesforce contacts to Google Sheets | Perfect | Overkill |
| Run dbt models after Fivetran sync | Possible but awkward | Perfect |
| Orchestrate Spark jobs at petabyte scale | Cannot do this | Perfect |
| Build AI agent that reads emails and drafts replies | Perfect | Not designed for this |
| Schedule nightly ETL across 50 data sources | Possible but limited | Perfect |

**Choose n8n when:** non-technical users need to build automations, connecting SaaS tools (CRM, marketing, e-commerce), rapid prototyping of business processes, AI-powered automation (agents, RAG), small to medium business automation needs.

**Choose something else when:** data pipeline orchestration (Airflow, Prefect, Kestra), complex engineering workflows, need Apache 2.0 license, petabyte-scale data processing, multi-language team (Kestra).

## Open questions

- How does n8n's Sustainable Use License affect commercial use cases compared to Apache 2.0?
- What are the performance limits of n8n's visual editor for complex workflows (100+ nodes)?
- How does n8n's AI Agent capability compare to dedicated agent frameworks (LangChain, CrewAI)?
- What is the cost comparison between n8n Cloud ($800/mo Business) and self-hosting Airflow on MWAA?

---

## References

1. n8n GitHub Repository: https://github.com/n8n-io/n8n
2. n8n Documentation: https://docs.n8n.io/
3. n8n Build Guide: https://docs.n8n.io/build/
4. n8n Pricing: https://n8n.io/pricing/
5. n8n License: https://docs.n8n.io/choose-n8n/faircode-license
`;export{e as default};