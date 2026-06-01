import { Link } from 'react-router-dom'
import {
  getAdhocResearchReports,
  getStockPreOpenReports,
  getStockWeeklyReports,
} from '../utils/content'

export default function Projects() {
  const publicRepos = [
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
      id: 'agent-scheduler',
      name: 'agent-scheduler',
      url: 'https://github.com/inotives/agent-scheduler',
      tags: ['Python', 'AI agents', 'scheduler', 'orchestration'],
      description:
        'A Python-based scheduler for agentic workflows. It coordinates queued agent jobs, tracks execution state, and gives AI agents a more structured way to run recurring or deferred work.',
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

  const adhocReports = getAdhocResearchReports()
  const researchReports = getStockPreOpenReports()
  const weeklyReports = getStockWeeklyReports()

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

      <section className="manual-section">
        <p className="label">Projects / public repos</p>
        <h2 className="section-title">Public Repos</h2>
        <div className="record-grid record-grid-two">
          {publicRepos.map((project) => (
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
              <h3 className="record-title">{project.name}</h3>
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
        </div>
      </section>

      <section className="manual-section">
        <p className="label">Projects / research reports</p>
        <h2 className="section-title">Research Reports</h2>
        <p className="section-copy">
          Agent-generated market research covering stocks, crypto markets,
          macroeconomic context, FX pricing, gold, and other cross-asset signals
          used for monitoring, analysis, and decision support.
        </p>
        <div className="record-grid record-grid-two">
          <Link
            to="/projects/research-stocks-pro-open-price"
            className="record"
          >
            <div className="record-meta">
              <span>{researchReports.length} reports</span>
              <span>Stocks / Pre-open / Agent research</span>
            </div>
            <h3 className="record-title">
              Stock Market Pre-Opening Price Estimation
            </h3>
            <p className="record-copy">
              A dated collection of pre-market stock research reports generated
              by my stock analysis agents before the market opens.
            </p>
            <div className="tag-row mt-4">
              {['Stocks', 'Pre-open', 'Agent research'].map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
          <Link to="/projects/research-stocks-weekly-summary" className="record">
            <div className="record-meta">
              <span>{weeklyReports.length} reports</span>
              <span>Stocks / Weekly / Agent research</span>
            </div>
            <h3 className="record-title">Weekly Stock Market Summary</h3>
            <p className="record-copy">
              A week-by-week archive of generated stock market summaries
              covering broad market context, sector movement, notable names, and
              next-week watchpoints.
            </p>
            <div className="tag-row mt-4">
              {['Stocks', 'Weekly', 'Agent research'].map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
          <Link to="/projects/researches-adhoc" className="record">
            <div className="record-meta">
              <span>{adhocReports.length} reports</span>
              <span>Adhoc / Research / Agent research</span>
            </div>
            <h3 className="record-title">Adhoc Researches</h3>
            <p className="record-copy">
              A general archive of generated research HTML reports that are not
              part of the scheduled stock pre-open or weekly summary streams.
            </p>
            <div className="tag-row mt-4">
              {['Adhoc', 'Research', 'Agent research'].map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
