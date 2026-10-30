import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div>
      <h1 className="page-title">Page not found</h1>
      <p className="dek">This address doesn&apos;t match any page. It may have moved.</p>
      <p>
        <Link to="/" className="text-link">
          Go to the home page
        </Link>
      </p>
    </div>
  )
}
