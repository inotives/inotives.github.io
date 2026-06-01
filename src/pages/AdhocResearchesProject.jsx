import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdhocResearchReports } from '../utils/content'

function fuzzyIncludes(value, query) {
  const target = value.toLowerCase()
  const search = query.toLowerCase().trim()
  if (!search) return true
  if (target.includes(search)) return true

  let cursor = 0
  for (const char of search) {
    cursor = target.indexOf(char, cursor)
    if (cursor === -1) return false
    cursor += 1
  }

  return true
}

function reportMatchesQuery(report, query) {
  const searchable = [
    report.date,
    report.name,
    report.filename,
    report.description,
    ...report.tags,
  ].join(' ')

  return fuzzyIncludes(searchable, query)
}

export default function AdhocResearchesProject() {
  const [search, setSearch] = useState('')
  const reports = getAdhocResearchReports()
  const filteredReports = reports.filter((report) =>
    reportMatchesQuery(report, search)
  )
  const latestReport = reports[0]

  return (
    <div className="page-stack">
      <section className="manual-section">
        <Link to="/projects" className="back-link">
          &larr; Back to projects
        </Link>
        <p className="label">Projects / research reports</p>
        <h1 className="page-title">Adhoc Researches</h1>
        <p className="section-copy">
          A collection of generated research reports that sit outside the
          scheduled stock daily and weekly research streams. Files added under
          the adhoc researches directory appear here after the content index is
          rebuilt.
        </p>
      </section>

      <section className="manual-section">
        <p className="label">Report activity</p>
        <h2 className="section-title">Adhoc Research Reports</h2>
        <p className="section-copy">
          These HTML reports are served directly from the static reports
          archive and listed from the generated content index.
        </p>

        <div className="contribution-panel">
          <div className="contribution-summary">
            <span>{reports.length} adhoc reports</span>
            {latestReport && (
              <a
                href={latestReport.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Latest: {latestReport.date || latestReport.filename}
              </a>
            )}
          </div>
        </div>

        <div className="toolbar">
          <input
            type="text"
            placeholder="Search adhoc reports by date, title, filename, or tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input"
          />
        </div>

        <div className="record-list">
          {filteredReports.map((report) => (
            <a
              key={report.id}
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="record"
            >
              <div className="record-meta">
                <span>{report.date || 'Undated'}</span>
                <span>{report.tags.join(' / ')}</span>
              </div>
              <h3 className="record-title">{report.name}</h3>
              <p className="record-copy">{report.description}</p>
              <div className="tag-row mt-4">
                <span className="tag">{report.filename}</span>
              </div>
            </a>
          ))}
          {filteredReports.length === 0 && (
            <p className="empty-state">No adhoc research reports found.</p>
          )}
        </div>
      </section>
    </div>
  )
}
