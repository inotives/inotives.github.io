import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatLong, formatShort, parseDate, toIsoDate } from '../utils/dates'

const WEEKDAY_LABELS = ['', 'Tue', '', 'Thu', '', 'Sat', '']

// Monday-first weekday index (0 = Monday)
function weekday(date) {
  return (date.getDay() + 6) % 7
}

export default function PublishingHeatmap({ posts }) {
  const byDay = useMemo(() => {
    const map = {}
    posts.forEach((post) => {
      if (post.date) (map[post.date] ||= []).push(post)
    })
    return map
  }, [posts])

  const [selectedDay, setSelectedDay] = useState(posts[0]?.date)

  const { cells, months } = useMemo(() => {
    const dates = Object.keys(byDay).sort()
    if (dates.length === 0) return { cells: [], months: [] }

    const today = parseDate(toIsoDate(new Date()))
    const start = parseDate(dates[0])
    start.setDate(start.getDate() - weekday(start))
    const end = new Date(today)
    end.setDate(end.getDate() + (6 - weekday(end)))

    const cells = []
    const months = []
    let week = 0
    let lastMonth = -1
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      if (weekday(day) === 0) {
        if (day.getMonth() !== lastMonth && day.getDate() <= 7) {
          months.push({ week, label: day.toLocaleDateString('en-GB', { month: 'short' }) })
          lastMonth = day.getMonth()
        }
        week++
      }
      const iso = toIsoDate(day)
      cells.push({ iso, count: byDay[iso]?.length || 0, future: day > today })
    }
    return { cells, months }
  }, [byDay])

  if (cells.length === 0) return null

  const selectedPosts = byDay[selectedDay] || []

  return (
    <section className="heatmap" aria-label="Publishing history">
      <div className="heatmap-scroll">
        <div className="heatmap-grid">
          <span />
          <div className="heatmap-months">
            {months.map(({ week, label }) => (
              <span key={`${week}-${label}`} style={{ gridColumn: `${week + 1} / span 4` }}>
                {label}
              </span>
            ))}
          </div>
          <div className="heatmap-days">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="heatmap-cells">
            {cells.map(({ iso, count, future }) => {
              if (future) return <span key={iso} className="heat-cell is-future" />
              if (!count) {
                return <span key={iso} className="heat-cell" title={`${formatShort(iso)}: no notes`} />
              }
              return (
                <button
                  key={iso}
                  type="button"
                  className="heat-cell"
                  data-level={Math.min(count, 3)}
                  aria-pressed={iso === selectedDay}
                  aria-label={`${formatLong(iso)}, ${count} ${count === 1 ? 'note' : 'notes'}`}
                  onClick={() => setSelectedDay(iso)}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="heatmap-foot">
        <span>Each square is a day. Pick one to see what I wrote.</span>
        <span className="heatmap-legend" aria-hidden="true">
          Fewer
          <i className="heat-cell" />
          <i className="heat-cell" data-level="1" />
          <i className="heat-cell" data-level="2" />
          <i className="heat-cell" data-level="3" />
          More
        </span>
      </div>

      {selectedPosts.length > 0 && (
        <div key={selectedDay} className="day-pick" aria-live="polite">
          <h2>{formatLong(selectedDay)}</h2>
          {selectedPosts.map((post) => (
            <Link key={post.slug} to={`/notes/${post.slug}`}>
              {post.title}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
