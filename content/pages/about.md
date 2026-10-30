---
title: "About me"
---

# About me

I'm Toni Lim, an AI and data lead working across crypto, fintech, operations, compliance, and product.

Applied AI Engineer and Data Operations Lead with over a decade of experience in regulated fintech and web3. I design and deliver end-to-end AI-powered solutions: from multi-agent architectures and LLM-orchestrated workflows to production data infrastructure, for enterprise clients operating under strict compliance regimes.

View my [resume](/resume), or find me on [LinkedIn](https://www.linkedin.com/in/inotives) and [GitHub](https://github.com/inotives).

## What I do

I build clean data systems for messy operational problems. My work spans data pipelines, analytics models, compliance reporting, internal dashboards, onchain risk monitoring, and decision-support tools for regulated crypto platforms.

I started as a software developer in Singapore, moved into crypto after discovering Bitcoin, and spent nine years at itBit/Paxos across technical support, tech operations, data analysis, and senior data analyst roles. More recently at Flowdesk, I led data operations work across crypto operations, vendor integrations, regulatory reporting, and internal data platform initiatives.

I use AI tools daily to speed up SQL and Python development, debugging, research, documentation, knowledge management, and reusable workflow design.

## Flowdesk — Lead Data Operations

**May 2025 – June 2026 · Singapore**

At Flowdesk, I served as Lead Data Operations across Singapore, Dubai, and EU regulatory environments. My work spanned AI-powered solutions, high-throughput crypto data infrastructure, and compliance systems.

**AI and agent architecture:**
- Architected an MCP-based AI agent layer over 5 fragmented enterprise data sources (Salesforce, Fireblocks, Chainalysis, Elliptic, NetSuite), enabling internal clients to access unified operational data through a single conversational AI endpoint
- Integrated Claude, Codex, and AI-assisted workflows to accelerate data prototyping, code reviews, and technical documentation
- Designed and delivered an AI-assisted prototyping pipeline using Claude Code and Codex, enabling clients to go from concept to working data model in 1–2 days — down from a 14-day sprint cycle
- Delivered a custom AI-powered dashboard solution to leadership that replaced legacy Looker workflows, eliminating $118K in annual tooling costs
- Engineered a multi-agent AI workflow architecture that cut AI infrastructure costs by 77%

**Data infrastructure:**
- Scoped and delivered high-throughput data pipeline solutions integrating 6+ vendor APIs (Chainalysis, Elliptic, TRM Labs, Fireblocks, Sumsub, Salesforce) into BigQuery and ClickHouse
- Built Python and Dagster pipelines for Fireblocks, Salesforce, Dotfile, Chainalysis, Elliptic, TRM Labs, CoinMarketCap, and CoinGecko data
- Created dbt models for operational, compliance, blockchain, and reporting datasets
- Architected scalable client data models to satisfy global regulatory frameworks (VARA, MiCA, MAS)

**Compliance and risk:**
- Built real-time risk dashboards and automated alerting systems using Chainalysis, Elliptic, and TRM Labs data
- Optimized KYT screening logic and transaction routing, reducing redundant external vendor checks while maintaining 100% risk coverage
- Designed data models for crypto networks, wallets, and assets serving as the primary technical contact for regulatory reporting

## Paxos — Senior Data Analyst and Operations

**March 2015 – July 2024 · Singapore**

Across nine years at Paxos (and its predecessor itBit), I moved from technical operations into senior data analysis, working on regulated crypto exchange operations, product launches, regulatory reporting, and blockchain analytics.

**Stablecoin launches:**
- Played a key role as main analyst in the successful product launch of multiple stablecoins — PAXG, USDP, BUSD, PYUSD, and USDL — with a combined market cap of approximately $1B
- Delivered data modeling, market analysis, and dashboards for the launch of PYUSD and USDL on Ethereum and Solana
- Provided critical regulatory data to NYDFS and FinCEN during the secure wind-down of the $24B BUSD ecosystem

**Data platform:**
- Scaled the data platform by migrating from Sisense to a modern stack (Snowflake, dbt, Airflow, Looker, Tableau)
- Built and maintained analytics models in Snowflake and dbt
- Created dashboards and reporting workflows with Looker, Streamlit, Dune Analytics, FlipsideCrypto, and Sisense
- Automated reporting and operational workflows with Python, Pandas, Polars, Airbyte, Selenium, and Scrapy

**Regulatory reporting:**
- Engineered automated regulatory reporting pipelines ensuring 100% compliance with Singapore's MAS (PSA) and IRAS
- Prepared regulatory reporting datasets for MAS, DFS, FinCEN, and IRAS requirements
- Managed daily payment processing of fiat and crypto with average daily volume exceeding $50M USD at peak

**Blockchain and operations:**
- Integrated blockchain data from Ethereum, Solana, Polygon, Bitcoin, and third-party compliance vendors
- Ingested core blockchain data to provide deep visibility into product performance
- Optimized token withdrawal workflows, reducing blockchain gas and network fees by approximately 30%
- Managed private keys and hardware wallets, executing secure offline multi-sig operations

## Before crypto — Web and data visualization

Before focusing on crypto data systems, I worked as a software engineer and web application developer across ERP, CMS, CRM, e-commerce, inventory, mobile, API, and data visualization projects.

- Built web applications with JavaScript, AngularJS, Node.js, PHP, Python, MySQL, and MongoDB
- Developed 3D and data visualization prototypes using Three.js, WebGL, D3.js, and Highstock.js
- Created automation and quality-testing scripts at Autodesk using Python and Sikuli
- Worked on energy visualization and building-management prototypes at NTU

## Projects I'm building

I build tools that solve problems I have actually encountered in production. Most of them are open source.

- **[Agent Rig](https://github.com/inotives/agent-rig)** — Filesystem-first agent workspaces. A TypeScript CLI that scaffolds a `.agent-rig/` workspace into any project, so a planner, worker and reviewer loop runs on the AI subscriptions you already have, with workflow state in SQLite or Markdown.
- **[Trinary Agents](https://github.com/inotives/trinary-agents)** — A project-manager, worker and reviewer workflow packaged as agent skills. Feature ideas become dependency-aware tasks that workers build, reviewers verify and you approve, with durable Markdown handoffs. It grew out of Agent Rig.
- **[InoAI](https://github.com/inotives/inoai)** — A local Discord bridge to your own signed-in coding-agent CLI (Codex, Claude Code or OpenCode), keeping conversations, shared memory and scheduled tasks in local SQLite.
- **Sparkling** (private) — A gamified learning app for kids, where a tiny voxel robot helps them learn Math, Science, English and Chinese.
- **AgentOS** (private) — My personal agentic OS and second brain, organised into Apps, Routines, Memory and Skills in plain Markdown.

Earlier open-source work, such as OpenVAIA, strata-memory and barebone-agents, is listed on the [Projects](/projects) page, along with the study guides and training material I've written.

## AI workflow design

I use AI tools as part of my regular operating model, not as a side experiment. My workflow focuses on making analysis, engineering, and documentation faster without losing context or quality.

- Multi-agent architectures with plan-and-execute patterns for complex, multi-step tasks
- Claude Code and Codex workflows for SQL, Python, debugging, and repository navigation
- Reusable skills and harnesses for documentation, research, and knowledge-base work
- MCP server design for unifying fragmented enterprise data sources
- Agent memory systems for preserving context across sessions and team members

## Focus areas

- **Crypto operations:** Wallets, assets, addresses, exchange activity, stablecoins, token launches, and onchain transaction analysis
- **Compliance data:** KYT efficiency, Travel Rule readiness, regulatory reporting, risk monitoring, and investigation workflows
- **Data platforms:** Pipelines, dbt models, dashboards, internal admin tools, and trusted datasets for operations and leadership
- **AI workflows:** Claude Code skills, Codex workflows, agent knowledge bases, documentation systems, and analysis harnesses
- **Market research:** Crypto-currency, fintech, and traditional stock market monitoring

## Tech stack

- **Data engineering:** Python, Dagster, Prefect, Airbyte, dbt, SQL, Pandas, Polars, NumPy
- **Warehouses and databases:** BigQuery, ClickHouse, Snowflake, PostgreSQL, Cloud SQL, MySQL, MongoDB, SQLite, DuckDB
- **Analytics and dashboards:** Looker, Grafana, Streamlit, Sisense, Dune Analytics, FlipsideCrypto, Kibana
- **Crypto and compliance data:** Fireblocks, Salesforce, Dotfile, Chainalysis, Elliptic, TRM Labs, CoinMarketCap, CoinGecko
- **Frontend and tooling:** React, Vite, Tailwind CSS, Node.js, D3.js, Three.js
- **AI and knowledge workflows:** Claude, Codex, OpenCode, Obsidian, Markdown, GitHub Pages

## This site

inoTives is my personal workspace for data systems, AI-assisted workflows, crypto-currency research, fintech notes, and market tooling. I use it as a public notebook for technical write-ups, personal research, project records, and AI/data workflow experiments.

It is a React SPA with Markdown-based content authoring, build-time content indexing, notes search and filtering, and static GitHub Pages deployment. All content lives as Markdown files that get indexed at build time. The source code is available on [GitHub](https://github.com/inotives/inotives.github.io).
