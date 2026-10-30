// Projects shown on /projects. `active` projects are what I'm building now;
// `earlier` ones are kept for reference but no longer developed.

export const ACTIVE_PROJECTS = [
  {
    id: 'agent-rig',
    name: 'Agent Rig',
    repo: 'inotives/agent-rig',
    emblem: 'loop',
    tagline: 'Filesystem-first agent workspaces for Claude, Codex, OpenCode and custom tools.',
    description:
      'A TypeScript CLI that scaffolds a .agent-rig/ workspace into any project, where agent profiles, shared context, workflow records and handoff logs live as local files. You run the planner, worker and reviewer loop with the AI subscriptions you already have, so nothing moves into a hosted system.',
    steps: [
      'agent-rig init scaffolds the workspace into your project',
      'Planner, worker and reviewer run in your own Claude, Codex or OpenCode',
      'Workflow state stays in SQLite or Markdown, version-controlled with the code',
    ],
    stack: ['TypeScript', 'Node.js', 'SQLite', 'Markdown', 'npm'],
  },
  {
    id: 'trinary-agents',
    name: 'Trinary Agents',
    repo: 'inotives/trinary-agents',
    emblem: 'dag',
    buildsOn: 'Agent Rig',
    tagline: 'Feature ideas become dependency-aware tasks that workers build, reviewers verify and you approve.',
    description:
      'An agent-harness-agnostic project-manager, worker and reviewer workflow packaged as skills. Plans, tasks and handoffs are ordinary Markdown files, so they stay readable across Codex, Claude, Pi, OpenCode and other agents, with a live dashboard over the work.',
    steps: [
      'You approve the plan the project manager drafts',
      'Workers build tasks in dependency order',
      'Reviewers verify independently, with durable Markdown handoffs',
    ],
    stack: ['Agent skills', 'Python', 'Markdown', 'Dashboard'],
  },
  {
    id: 'inoai',
    name: 'InoAI',
    repo: 'inotives/inoai',
    emblem: 'bridge',
    tagline: 'A local Discord bridge to your own signed-in coding-agent CLI.',
    description:
      'Connects a Discord bot to Codex, Claude Code or OpenCode already signed in on your machine. It drives the CLI you use instead of calling a model API, keeps conversations and shared memory in local SQLite, and runs owner-only scheduled tasks with a small local UI to manage them.',
    steps: [
      'Mention @inoai in Discord to start a thread',
      'Your signed-in CLI does the work, with owner approval for commands',
      'SQLite keeps sessions, daily recaps and shared memory',
    ],
    stack: ['TypeScript', 'Node.js', 'Discord', 'SQLite'],
  },
  {
    id: 'sparkling',
    name: 'Sparkling',
    private: true,
    emblem: 'robot',
    tagline: 'A gamified learning app for kids, starring a tiny voxel robot.',
    description:
      'Kids learn Math, Science, English and Chinese alongside their Sparkling to earn sparks and level up each subject, then spend sparks to feed, dress up and evolve their robot across 20 species. Parents run the family: they create kid accounts, follow progress and manage the learning content and the shop.',
    steps: [
      'Kids answer lessons and missions in four subjects',
      'Sparks feed, dress and evolve their Sparkling',
      'Parents manage accounts, content and rewards',
    ],
    stack: ['TypeScript', 'three.js', 'Hono', 'Postgres', 'Docker'],
  },
  {
    id: 'agentos',
    name: 'AgentOS',
    private: true,
    emblem: 'layers',
    tagline: 'A personal agentic OS and second brain, in plain Markdown.',
    description:
      'My personal operating system for working with agents, organised on four levels: Apps, Routines, Memory and Skills. Notes, routines and skills are plain Markdown with no vector database, and a local dashboard sits over the whole workspace.',
    steps: [
      'Apps and connectors bring outside tools in',
      'Routines run scheduled work against Memory',
      'Skills and agents act on it, shown in a local dashboard',
    ],
    stack: ['Claude Code', 'Markdown', 'OpenKnowledge', 'Node.js'],
  },
  {
    id: 'inotives-site',
    name: 'inoTives site',
    repo: 'inotives/inotives.github.io',
    emblem: 'site',
    tagline: 'This site: a public notebook for data, AI agents and market research.',
    description:
      'A React and Vite static site with three.js scenes. Every note, series and page is a Markdown file written in Obsidian, indexed at build time, and deployed to GitHub Pages by GitHub Actions. The 3D publishing history on the home page and in this emblem comes from that index.',
    steps: [
      'Notes and pages are written as Markdown in Obsidian',
      'A build step indexes the content and Vite bundles the app',
      'GitHub Actions deploys every push to GitHub Pages',
    ],
    stack: ['React', 'Vite', 'three.js', 'Tailwind CSS', 'Markdown', 'GitHub Actions'],
  },
]

export const EARLIER_PROJECTS = [
  {
    id: 'strata-memory',
    name: 'Strata Memory',
    url: 'https://github.com/inotives/strata-memory',
    tags: ['AI agents', 'memory', 'SQLite', 'CLI'],
    description:
      'A three-tier memory system for AI agents. Markdown files are canonical; SQLite is a rebuildable FTS5 index. Draft, knowledge and intelligence tiers with safe promotion via CLI.',
  },
  {
    id: 'openvaia',
    name: 'OpenVAIA',
    url: 'https://github.com/inotives/openvaia',
    tags: ['AI agents', 'Docker', 'Postgres', 'trading'],
    description:
      'A dockerized multi-agent platform on a custom async Python runtime, with persona-based agents, DB-driven skills, hybrid Postgres and pgvector memory, multi-channel messaging and crypto trading workflows.',
  },
  {
    id: 'barebone-agents',
    name: 'barebone-agents',
    url: 'https://github.com/inotives/barebone-agents',
    tags: ['Rust', 'AI agents', 'MCP', 'Discord'],
    description:
      'A local-first, LLM-agnostic agent harness in Rust: personas, skills, tools, scheduling, MCP integrations, CLI and Discord channels, with SQLite persistence.',
  },
  {
    id: 'agent-scheduler',
    name: 'agent-scheduler',
    url: 'https://github.com/inotives/agent-scheduler',
    tags: ['Python', 'AI agents', 'scheduler'],
    description:
      'A Python scheduler for agentic workflows that queues agent jobs, tracks execution state, and runs recurring or deferred work.',
  },
  {
    id: 'agent-pipe',
    name: 'agent-pipe',
    url: 'https://github.com/inotives/agent-pipe',
    tags: ['Python', 'data pipeline', 'SQLite'],
    description:
      'A local data pipeline CLI with SQLite-backed job scheduling and run history, built with Agent Rig across 5 phases and 25 tasks.',
  },
  {
    id: 'market-pipe',
    name: 'market-pipe',
    url: 'https://github.com/inotives/market-pipe',
    tags: ['Python', 'market data', 'ingestion'],
    description:
      'Standardised ingestion and retrieval of stock and crypto market data, so agents can pull it without a custom integration per source.',
  },
  {
    id: 'felts',
    name: 'Felts',
    url: 'https://github.com/inotives/felts',
    tags: ['Python', 'dbt', 'Postgres', 'Prefect'],
    description:
      'Financial ELT stacks: extracts crypto, stock and macro data, lands it as raw evidence, and models it with dbt on Postgres, orchestrated by Prefect.',
  },
  {
    id: 'agentic-workflows',
    name: 'Agentic Workflows',
    url: 'https://github.com/inotives/agentic-workflows',
    tags: ['AI workflows', 'skills', 'scripts'],
    description:
      'My day-to-day scripts, workflows and skills for agentic development as a data engineer and analyst.',
  },
]
