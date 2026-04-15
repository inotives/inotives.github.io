import { useParams, Link } from 'react-router-dom'
import dashboards from '../data/dashboards'
import DashboardEmbed from '../components/DashboardEmbed'

export default function DashboardView() {
  const { id } = useParams()
  const dashboard = dashboards.find((d) => d.id === id)

  if (!dashboard) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-white mb-4">Dashboard not found</h1>
        <Link to="/dashboards" className="text-blue-400 hover:underline">
          &larr; Back to dashboards
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/dashboards" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to dashboards
      </Link>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">{dashboard.name}</h1>
        <a
          href={dashboard.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Open in new tab &nearr;
        </a>
      </div>
      <DashboardEmbed url={dashboard.url} title={dashboard.name} />
    </div>
  )
}
