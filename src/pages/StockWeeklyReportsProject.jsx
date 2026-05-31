import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getStockWeeklyReports } from '../utils/content'

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
    report.description,
    ...report.tags,
  ].join(' ')

  return fuzzyIncludes(searchable, query)
}

export default function StockWeeklyReportsProject() {
  const [search, setSearch] = useState('')
  const reports = getStockWeeklyReports()
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
        <h1 className="page-title">Weekly Stock Market Summary</h1>
        <p className="section-copy">
          A weekly research archive where stock analysis agents summarize broad
          market context, sector rotation, notable stock moves, risk signals,
          and watchpoints for the next trading week.
        </p>
      </section>

      <section className="manual-section">
        <p className="label">Report activity</p>
        <h2 className="section-title">Weekly Reports</h2>
        <p className="section-copy">
          Weekly report files added under the stock weekly reports directory
          will appear here after the site content index is rebuilt.
        </p>

        <div className="contribution-panel">
          <div className="contribution-summary">
            <span>{reports.length} weekly reports</span>
            {latestReport && (
              <a
                href={latestReport.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Latest: {latestReport.date}
              </a>
            )}
          </div>
        </div>

        <div className="toolbar">
          <input
            type="text"
            placeholder="Search weekly reports by week, title, or tag..."
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
                <span>{report.date}</span>
                <span>{report.tags.join(' / ')}</span>
              </div>
              <h3 className="record-title">{report.name}</h3>
              <p className="record-copy">{report.description}</p>
            </a>
          ))}
          {filteredReports.length === 0 && (
            <p className="empty-state">No weekly reports found.</p>
          )}
        </div>
      </section>
    </div>
  )
}
