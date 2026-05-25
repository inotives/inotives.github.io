export default function Projects() {
  const projects = [
    {
      id: 'agent-knowledge',
      name: 'Agent Knowledge',
      url: 'https://github.com/inotives/agent-knowledge',
      tags: ['AI agents', 'memory', 'CLI', 'knowledge workflows'],
      description:
        'A persistent-memory system for AI agents. It captures session history through CLI hooks, turns conversations into draft knowledge, and supports human-curated markdown knowledge bases, skills, and agent workflows.',
    },
    {
      id: 'barebone-agents',
      name: 'barebone-agents',
      url: 'https://github.com/inotives/barebone-agents',
      tags: ['Rust', 'AI agents', 'MCP', 'Discord'],
      description:
        'A local-first, LLM-agnostic AI agent harness written in Rust. It runs multiple agents with personas, skills, tools, task scheduling, MCP integrations, CLI and Discord channels, and SQLite-backed conversation and task persistence.',
    },
    {
      id: 'openvaia',
      name: 'OpenVAIA',
      url: 'https://github.com/inotives/openvaia',
      tags: ['AI agents', 'Docker', 'Postgres', 'trading'],
      description:
        'A dockerized multi-agent AI platform powered by the custom async Python inotagent runtime. It supports persona-based agents, DB-driven skills, hybrid Postgres and pgvector memory search, multi-channel messaging, an admin UI, and crypto trading workflows.',
    },
    {
      id: 'agentic-workflows',
      name: 'Agentic Workflows',
      url: 'https://github.com/inotives/agentic-workflows',
      tags: ['AI workflows', 'data engineering', 'skills', 'scripts'],
      description:
        'My day-to-day collection of scripts, workflows, and skills for agentic development as a data engineer and data analyst. It captures practical patterns for working with AI agents across data, automation, and analysis tasks.',
    },
    {
      id: 'inotives-github-pages',
      name: 'inoTives GitHub Pages',
      url: 'https://github.com/inotives/inotives.github.io',
      tags: ['GitHub Pages', 'Markdown', 'Obsidian', 'CI/CD'],
      description:
        'This personal site, built as a React and Vite static app with Markdown content authored through Obsidian. GitHub Actions rebuilds the site and deploys the generated Pages artifact whenever content or app changes are pushed.',
    },
  ]

  return (
    <div className="page-stack">
      <section className="manual-section">
        <p className="label">Index / projects</p>
        <h1 className="page-title">Projects</h1>
        <p className="section-copy">
          Project records, experiments, and build notes from my data, AI, and
          crypto workflow experiments.
        </p>
      </section>

      <section className="record-grid record-grid-two">
        {projects.map((project) => (
          <a
            key={project.id}
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="record"
          >
            <div className="record-meta">
              <span>{project.id}</span>
              <span>{project.tags.join(' / ')}</span>
            </div>
            <h2 className="record-title">{project.name}</h2>
            <p className="record-copy">{project.description}</p>
            <div className="tag-row mt-4">
              {project.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </section>
    </div>
  )
}
