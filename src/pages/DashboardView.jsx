import { useParams, Link } from 'react-router-dom'
import dashboards from '../data/dashboards'
import DashboardEmbed from '../components/DashboardEmbed'

export default function DashboardView() {
  const { id } = useParams()
  const dashboard = dashboards.find((d) => d.id === id)

  if (!dashboard) {
    return (
      <div>
        <h1 className="section-title">Dashboard not found</h1>
        <Link to="/dashboards" className="back-link">
          &larr; Back to dashboards
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/dashboards" className="back-link">
        &larr; Back to dashboards
      </Link>
      <div className="article-header flex items-end justify-between gap-4">
        <div>
          <p className="label">Dashboard / {dashboard.id}</p>
          <h1 className="article-title">{dashboard.name}</h1>
          <p className="section-copy">{dashboard.description}</p>
        </div>
        <a
          href={dashboard.url}
          target="_blank"
          rel="noopener noreferrer"
          className="button-link"
        >
          Open in new tab
        </a>
      </div>
      <DashboardEmbed url={dashboard.url} title={dashboard.name} />
    </div>
  )
}
