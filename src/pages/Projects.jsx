import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdhocResearchReports,
  getStockPreOpenReports,
  getStockWeeklyReports,
} from '../utils/content'
import { ACTIVE_PROJECTS, EARLIER_PROJECTS } from '../data/projects'
import { formatShort, toIsoDate } from '../utils/dates'
import ProjectEmblems from '../components/ProjectEmblems'

// Last push date for each public repo, read live from the GitHub API.
// Missing dates (rate limit, offline) simply aren't shown.
function useLastPushed(repos) {
  const [pushed, setPushed] = useState({})

  useEffect(() => {
    let cancelled = false
    repos.forEach((repo) => {
      fetch(`https://api.github.com/repos/${repo}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data?.pushed_at) {
            setPushed((prev) => ({ ...prev, [repo]: toIsoDate(new Date(data.pushed_at)) }))
          }
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [repos])

  return pushed
}

const PUBLIC_REPOS = ACTIVE_PROJECTS.filter((p) => p.repo).map((p) => p.repo)

function ActiveProject({ project, pushed }) {
  const url = project.repo && `https://github.com/${project.repo}`
  return (
    <article className="project-card" data-project={project.id}>
      <div className="project-emblem" data-emblem={project.emblem} />
      <div className="project-body">
        <header className="project-head">
          <h3 className="project-name">{project.name}</h3>
          <p className="project-status">
            <span className="project-live">Building now</span>
            <span>{project.private ? 'Private repo' : 'Public repo'}</span>
            {pushed && <span>Updated {formatShort(pushed)}</span>}
            {project.buildsOn && <span>Builds on {project.buildsOn}</span>}
          </p>
        </header>
        <p className="project-tagline">{project.tagline}</p>
        <p className="record-copy">{project.description}</p>

        <ol className="project-steps" aria-label={`How ${project.name} works`}>
          {project.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="project-foot">
          <div className="tag-row">
            {project.stack.map((tech) => (
              <span key={tech} className="tag">
                {tech}
              </span>
            ))}
          </div>
          {url ? (
            <a href={url} className="text-link" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
          ) : (
            <span className="project-private-note">Source is private</span>
          )}
        </div>
      </div>
    </article>
  )
}

export default function Projects() {
  const pushed = useLastPushed(PUBLIC_REPOS)
  const adhocReports = getAdhocResearchReports()
  const researchReports = getStockPreOpenReports()
  const weeklyReports = getStockWeeklyReports()

  return (
    <div className="page-stack">
      <header>
        <h1 className="page-title">Projects</h1>
        <p className="section-copy">
          What I&apos;m building now, earlier experiments, and the research my market agents
          publish. Hover a project to see it work.
        </p>
      </header>

      <section>
        <div className="section-head">
          <h2 className="section-title">Building now</h2>
          <span className="notes-count">{ACTIVE_PROJECTS.length} projects</span>
        </div>
        <div className="project-list">
          {ACTIVE_PROJECTS.map((project) => (
            <ActiveProject
              key={project.id}
              project={project}
              pushed={project.repo ? pushed[project.repo] : null}
            />
          ))}
        </div>
        <ProjectEmblems />
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">Earlier projects</h2>
          <span className="notes-count">No longer actively developed</span>
        </div>
        <ul className="earlier-list">
          {EARLIER_PROJECTS.map((project) => (
            <li key={project.id}>
              <a href={project.url} target="_blank" rel="noopener noreferrer">
                {project.name}
              </a>
              <p>{project.description}</p>
              <span>{project.tags.join(', ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="section-title">Research reports</h2>
        <p className="section-copy">
          Agent-generated market research covering stocks, crypto markets,
          macroeconomic context, FX pricing, gold, and other cross-asset signals
          used for monitoring, analysis, and decision support.
        </p>
        <div className="record-grid">
          <Link to="/projects/research-stocks-pro-open-price" className="record">
            <div className="record-meta">
              <span>{researchReports.length} reports</span>
            </div>
            <h3 className="record-title">Stock market pre-opening price estimation</h3>
            <p className="record-copy">
              A dated collection of pre-market stock research reports generated
              by my stock analysis agents before the market opens.
            </p>
          </Link>
          <Link to="/projects/research-stocks-weekly-summary" className="record">
            <div className="record-meta">
              <span>{weeklyReports.length} reports</span>
            </div>
            <h3 className="record-title">Weekly stock market summary</h3>
            <p className="record-copy">
              A week-by-week archive of generated stock market summaries
              covering broad market context, sector movement, notable names, and
              next-week watchpoints.
            </p>
          </Link>
          <Link to="/projects/researches-adhoc" className="record">
            <div className="record-meta">
              <span>{adhocReports.length} reports</span>
            </div>
            <h3 className="record-title">Ad hoc research</h3>
            <p className="record-copy">
              A general archive of generated research HTML reports that are not
              part of the scheduled stock pre-open or weekly summary streams.
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
