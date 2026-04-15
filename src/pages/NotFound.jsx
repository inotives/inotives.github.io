import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="text-center py-20">
      <h1 className="text-6xl font-bold text-white mb-4">404</h1>
      <p className="text-gray-400 mb-8">Page not found.</p>
      <Link to="/" className="text-blue-400 hover:underline">
        &larr; Back to home
      </Link>
    </div>
  )
}
