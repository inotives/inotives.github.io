var e=`---
title: "Portfolio"
---

# Portfolio

Applied AI Engineer and Data Operations Lead with over a decade of experience in regulated fintech and web3. I design and deliver end-to-end AI-powered solutions: from multi-agent architectures and LLM-orchestrated workflows to production data infrastructure, for enterprise clients operating under strict compliance regimes.

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

## Open Source Projects

I build tools that solve problems I have actually encountered in production.

**[OpenVAIA](https://github.com/inotives/openvaia) — Multi-Agent AI Platform**
Python, TypeScript, Postgres, pgvector. Production-grade agentic platform with custom async runtime, hybrid FTS + pgvector memory, 100+ skill library, multi-channel inbox (Discord, Slack, Telegram), and pluggable LLM backends (Anthropic, OpenAI, Google, Groq).

**[agent-rig](https://github.com/inotives/agent-rig) — Multi-Agent Workspace CLI**
TypeScript. Filesystem-first CLI scaffolding auditable, version-controlled multi-agent workspaces with zero API lock-in. Supports solo, swarm, supervisor-worker, and coder-reviewer agent patterns. Published on npm.

**[strata-memory](https://github.com/inotives/strata-memory) — Agentic Memory System**
Rust, SQLite. Local-first three-tier memory system (draft → knowledge → intelligence) with SQLite FTS5 indexing and semantic search for long-running agentic workflows.

## AI Workflow Design

I use AI tools as part of my regular operating model, not as a side experiment. My workflow focuses on making analysis, engineering, and documentation faster without losing context or quality.

- Multi-agent architectures with plan-and-execute patterns for complex, multi-step tasks
- Claude Code and Codex workflows for SQL, Python, debugging, and repository navigation
- Reusable skills and harnesses for documentation, research, and knowledge-base work
- MCP server design for unifying fragmented enterprise data sources
- Agent memory systems for preserving context across sessions and team members

## Web and Data Visualization

Before focusing on crypto data systems, I worked as a software engineer and web application developer across ERP, CMS, CRM, e-commerce, inventory, mobile, API, and data visualization projects.

- Built web applications with JavaScript, AngularJS, Node.js, PHP, Python, MySQL, and MongoDB
- Developed 3D and data visualization prototypes using Three.js, WebGL, D3.js, and Highstock.js
- Created automation and quality-testing scripts at Autodesk using Python and Sikuli
- Worked on energy visualization and building-management prototypes at NTU

## inoTives Site

This site itself is a small project: a React SPA with Markdown-based content authoring, build-time content indexing, notes search and filtering, and static GitHub Pages deployment. All content — articles, notes, portfolio — lives as Markdown files that get indexed at build time.
`;export{e as default};