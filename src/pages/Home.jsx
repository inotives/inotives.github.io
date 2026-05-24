import { Link } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import PostCard from '../components/PostCard'

export default function Home() {
  const recentPosts = getAllPosts().slice(0, 3)

  return (
    <div className="page-stack">
      <section className="hero-manual">
        <p className="label">FIG_000 / market manual</p>
        <h1 className="page-title">inoTives</h1>
        <p className="dek">
          Crypto dashboards, build notes, and project records in one technical
          workspace.
        </p>
        <div className="ascii-rule" />
      </section>

      <section className="record-grid">
        <Link
          to="/dashboards"
          className="record"
        >
          <div className="record-meta">
            <span>01</span>
            <span>Live systems</span>
          </div>
          <h2 className="record-title">Dashboards</h2>
          <p className="record-copy">
            Live crypto monitoring and exchange metrics.
          </p>
        </Link>

        <Link
          to="/blog"
          className="record"
        >
          <div className="record-meta">
            <span>02</span>
            <span>Notes</span>
          </div>
          <h2 className="record-title">Blog</h2>
          <p className="record-copy">
            Notes, tutorials, and write-ups.
          </p>
        </Link>

        <Link
          to="/portfolio"
          className="record"
        >
          <div className="record-meta">
            <span>03</span>
            <span>Build log</span>
          </div>
          <h2 className="record-title">Portfolio</h2>
          <p className="record-copy">
            Projects and things I've built.
          </p>
        </Link>
      </section>

      {recentPosts.length > 0 && (
        <section className="manual-section">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="label">Latest entries</p>
              <h2 className="section-title">Recent Notes</h2>
            </div>
            <Link to="/blog" className="button-link">
              View all
            </Link>
          </div>
          <div className="record-list">
            {recentPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
