import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getStockPreOpenReports } from '../utils/content'

const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildReportCalendar(reports) {
  const reportByDate = new Map(reports.map((report) => [report.date, report]))
  const end = new Date()
  end.setHours(0, 0, 0, 0)

  const start = new Date(end.getTime() - 364 * DAY_MS)
  start.setDate(start.getDate() - start.getDay())

  const weeks = []
  let cursor = new Date(start)

  while (cursor <= end || weeks.length < 53) {
    const week = []

    for (let day = 0; day < 7; day += 1) {
      const date = new Date(cursor)
      const key = formatDate(date)
      week.push({
        date: key,
        day,
        report: reportByDate.get(key) || null,
        inRange: date <= end && date >= start,
      })
      cursor = new Date(cursor.getTime() + DAY_MS)
    }

    weeks.push(week)
  }

  const months = []
  weeks.forEach((week, index) => {
    const firstDay = week[0]
    const date = new Date(`${firstDay.date}T00:00:00`)
    if (date.getDate() <= 7) {
      months.push({
        label: MONTH_LABELS[date.getMonth()],
        column: index + 1,
      })
    }
  })

  return { weeks, months }
}

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

export default function StockPreOpenProject() {
  const [search, setSearch] = useState('')
  const reports = getStockPreOpenReports()
  const filteredReports = reports.filter((report) =>
    reportMatchesQuery(report, search)
  )
  const { weeks, months } = buildReportCalendar(reports)
  const latestReport = reports[0]

  return (
    <div className="page-stack">
      <section className="manual-section">
        <Link to="/projects" className="back-link">
          &larr; Back to projects
        </Link>
        <p className="label">Projects / research reports</p>
        <h1 className="page-title">Stock Pre-Open Price Research</h1>
        <p className="section-copy">
          A research workflow where stock analysis agents prepare pre-market
          reports before the opening bell. The reports estimate possible opening
          price behavior using market context, recent price action, news
          signals, and structured agent review steps.
        </p>
      </section>

      <section className="manual-section">
        <p className="label">Workflow</p>
        <h2 className="section-title">How Reports Are Computed</h2>
        <div className="record-grid record-grid-two">
          <div className="record">
            <h3 className="record-title">Market Setup</h3>
            <p className="record-copy">
              Agents review pre-market movement, previous close behavior,
              volatility, volume context, and broader market direction before
              assigning opening-price scenarios.
            </p>
          </div>
          <div className="record">
            <h3 className="record-title">Signal Review</h3>
            <p className="record-copy">
              The workflow combines structured inputs with agent reasoning to
              flag likely drivers, risk factors, and names that need closer
              attention before the session starts.
            </p>
          </div>
        </div>
        <div className="record-list mt-4">
          <Link
            to="/notes/2026-05-15-stock-market-close-summary-detailed-steps"
            className="record"
          >
            <div className="record-meta">
              <span>Methodology</span>
              <span>Market close / detailed steps</span>
            </div>
            <h3 className="record-title">Stock Market Close Summary</h3>
            <p className="record-copy">
              The post-close analysis workflow that builds the technical,
              options, macro, sentiment, and next-session setup used as the
              anchor for pre-open research.
            </p>
          </Link>
          <Link
            to="/notes/2026-05-15-pre-market-summary-pipeline"
            className="record"
          >
            <div className="record-meta">
              <span>Methodology</span>
              <span>Pre-market / pipeline</span>
            </div>
            <h3 className="record-title">Pre-Market Summary Pipeline</h3>
            <p className="record-copy">
              The two-step pipeline that turns prior close research and
              overnight market data into opening-price scenarios, intraday
              paths, monitoring checklists, and generated HTML reports.
            </p>
          </Link>
        </div>
      </section>

      <section className="manual-section">
        <p className="label">Report activity</p>
        <h2 className="section-title">Research Reports</h2>
        <p className="section-copy">
          Each highlighted square links to a generated pre-market research
          report. New report files added under the stock research directory will
          appear here after the site content index is rebuilt.
        </p>

        <div className="contribution-panel">
          <div className="contribution-summary">
            <span>{reports.length} reports in the last year</span>
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
          <div className="contribution-map" aria-label="Available report dates">
            <div className="contribution-months">
              {months.map((month) => (
                <span
                  key={`${month.label}-${month.column}`}
                  style={{ gridColumn: month.column }}
                >
                  {month.label}
                </span>
              ))}
            </div>
            <div className="contribution-body">
              <div className="contribution-weekdays" aria-hidden="true">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>
              <div className="contribution-grid">
                {weeks.map((week, weekIndex) =>
                  week.map((day) => {
                    const title = day.report
                      ? `${day.date}: report available`
                      : `${day.date}: no report`
                    const className = day.report
                      ? 'contribution-cell has-report'
                      : 'contribution-cell'

                    if (day.report) {
                      return (
                        <a
                          key={day.date}
                          href={day.report.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={className}
                          title={title}
                          aria-label={title}
                          style={{
                            gridColumn: weekIndex + 1,
                            gridRow: day.day + 1,
                          }}
                        />
                      )
                    }

                    return (
                      <span
                        key={day.date}
                        className={className}
                        title={title}
                        aria-label={title}
                        style={{
                          gridColumn: weekIndex + 1,
                          gridRow: day.day + 1,
                        }}
                      />
                    )
                  })
                )}
              </div>
            </div>
            <div className="contribution-legend" aria-hidden="true">
              <span>Less</span>
              <span className="contribution-cell" />
              <span className="contribution-cell has-report" />
              <span>More</span>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="text"
            placeholder="Search reports by date, title, or tag..."
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
            <p className="empty-state">No research reports found.</p>
          )}
        </div>
      </section>
    </div>
  )
}
