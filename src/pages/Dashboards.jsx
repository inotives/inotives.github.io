import { Link } from 'react-router-dom'
import dashboards from '../data/dashboards'

export default function Dashboards() {
  return (
    <div className="page-stack">
      <section className="manual-section">
        <p className="label">Index / live systems</p>
        <h1 className="page-title">Dashboards</h1>
        <p className="section-copy">
          Real-time crypto dashboards powered by public exchange APIs. No backend required.
        </p>
      </section>

      <section className="record-grid record-grid-two">
        {dashboards.map((d) => (
          <Link
            key={d.id}
            to={`/dashboards/${d.id}`}
            className="record"
          >
            <div className="record-meta">
              <span>{d.id}</span>
              <span>{d.tags.join(' / ')}</span>
            </div>
            <h2 className="record-title">{d.name}</h2>
            <p className="record-copy">{d.description}</p>
            <div className="tag-row mt-4">
              {d.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
