// Career timeline: one row per company, one bar per role, built from the
// role dates in resume.md
export default function ResumeTimeline({ companies, matchesRole, onSelect }) {
  const roles = companies.flatMap((c) => c.roles).filter((r) => r.start)
  if (roles.length === 0) return null

  const now = new Date()
  const current = now.getFullYear() + now.getMonth() / 12
  const from = Math.floor(Math.min(...roles.map((r) => r.start)))
  const to = Math.ceil(Math.max(...roles.map((r) => r.end ?? current)))
  const span = to - from
  const pct = (year) => `${((year - from) / span) * 100}%`
  const ticks = []
  // stop a year short of the edge so the last label isn't clipped
  for (let y = from; y < to; y += 2) ticks.push(y)

  return (
    <section className="resume-timeline" aria-label="Career timeline">
      <div className="resume-timeline-scroll">
        <div className="resume-timeline-chart">
          {companies.map((company) => (
            <div key={company.name} className="resume-timeline-row">
              <span className="resume-timeline-label">{company.name}</span>
              <div className="resume-timeline-track">
                {company.roles
                  .filter((role) => role.start)
                  .map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={`resume-timeline-bar ${matchesRole(role) ? '' : 'is-dim'}`}
                      style={{
                        left: pct(role.start),
                        width: `calc(${(((role.end ?? current) - role.start) / span) * 100}% - 2px)`,
                      }}
                      title={`${role.title}, ${role.range}`}
                      aria-label={`${role.title} at ${company.name}, ${role.range}`}
                      onClick={() => onSelect(role.id)}
                    />
                  ))}
              </div>
            </div>
          ))}
          <div className="resume-timeline-row" aria-hidden="true">
            <span />
            <div className="resume-timeline-axis">
              {ticks.map((year) => (
                <span key={year} style={{ left: pct(year) }}>
                  {year}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
