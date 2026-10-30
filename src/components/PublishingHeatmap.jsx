import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatLong, formatShort, parseDate, toIsoDate } from '../utils/dates'
import Heatmap3D from './Heatmap3D'

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

  // Years that have notes, newest first; each shows as a full Jan–Dec calendar
  const years = useMemo(
    () => [...new Set(Object.keys(byDay).map((d) => Number(d.slice(0, 4))))].sort((a, b) => b - a),
    [byDay]
  )
  const yearCounts = useMemo(() => {
    const counts = {}
    posts.forEach((p) => p.date && (counts[p.date.slice(0, 4)] = (counts[p.date.slice(0, 4)] || 0) + 1))
    return counts
  }, [posts])
  const [year, setYear] = useState(years[0])
  const [selectedDay, setSelectedDay] = useState(posts[0]?.date)
  // Falls back to the flat grid when WebGL or the three.js CDN is unavailable
  const [flat, setFlat] = useState(false)
  const showFlat = useCallback(() => setFlat(true), [])

  const { cells, months } = useMemo(() => {
    if (!year) return { cells: [], months: [] }

    const today = parseDate(toIsoDate(new Date()))
    const start = parseDate(`${year}-01-01`)
    start.setDate(start.getDate() - weekday(start))
    const end = parseDate(`${year}-12-31`)
    end.setDate(end.getDate() + (6 - weekday(end)))

    const cells = []
    const months = []
    let week = 0
    let lastMonth = -1
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      if (weekday(day) === 0) {
        if (day.getMonth() !== lastMonth && day.getDate() <= 7 && day.getFullYear() === year) {
          months.push({ week, label: day.toLocaleDateString('en-GB', { month: 'short' }) })
          lastMonth = day.getMonth()
        }
        week++
      }
      const iso = toIsoDate(day)
      // padding days outside the year, and days still to come, draw as empty slots
      const blank = day > today || day.getFullYear() !== year
      cells.push({ iso, count: blank ? 0 : byDay[iso]?.length || 0, future: blank })
    }
    return { cells, months }
  }, [byDay, year])

  function chooseYear(next) {
    setYear(next)
    // jump to the latest day with notes in that year
    const latest = Object.keys(byDay)
      .filter((d) => d.startsWith(String(next)))
      .sort()
      .pop()
    if (latest) setSelectedDay(latest)
  }

  if (cells.length === 0) return null

  const selectedPosts = byDay[selectedDay] || []

  return (
    <section className="heatmap" aria-label="Publishing history">
      <div className="heatmap-years" role="group" aria-label="Show year">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            className={`tag ${y === year ? 'tag-active' : ''}`}
            aria-pressed={y === year}
            onClick={() => chooseYear(y)}
          >
            {y}
            <small>{yearCounts[y]} notes</small>
          </button>
        ))}
      </div>
      {!flat ? (
        <Heatmap3D
          cells={cells}
          months={months}
          selectedDay={selectedDay}
          onSelect={setSelectedDay}
          onFail={showFlat}
        />
      ) : (
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
      )}

      <div className="heatmap-foot">
        <span>
          {flat
            ? 'Each square is a day. Pick one to see what I wrote.'
            : 'Each bar is a day, taller with more notes. Pick one to see what I wrote.'}
        </span>
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
