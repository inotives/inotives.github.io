import { Link } from 'react-router-dom'
import dashboards from '../data/dashboards'

export default function Dashboards() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Dashboards</h1>
      <p className="text-gray-400 mb-8">
        Real-time crypto dashboards powered by public exchange APIs. No backend required.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dashboards.map((d) => (
          <Link
            key={d.id}
            to={`/dashboards/${d.id}`}
            className="group p-5 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400">
              {d.name}
            </h2>
            <p className="text-sm text-gray-400 mb-3">{d.description}</p>
            <div className="flex gap-2 flex-wrap">
              {d.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
