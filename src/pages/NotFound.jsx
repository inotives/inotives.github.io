import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="hero-manual">
      <p className="label">Error / missing route</p>
      <h1 className="page-title">404</h1>
      <p className="dek">Page not found.</p>
      <div className="ascii-rule" />
      <Link to="/" className="button-link">
        &larr; Back to home
      </Link>
    </div>
  )
}
