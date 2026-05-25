import { Link } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import PostCard from '../components/PostCard'

export default function Home() {
  const recentPosts = getAllPosts().slice(0, 3)

  return (
    <div className="page-stack">
      <section className="hero-manual">
        <p className="label">Data · AI (Harnesses | Skills | Workflows) · Crypto-Currencies · Stocks · Fintech </p>
        <h1 className="page-title">inoTives</h1>
        <p className="dek">
          My personal sites that host and store my own understanding to 
          Data systems, AI harnesses, skills, and workflows for crypto-currency,
          fintech, and traditional stock market research, monitoring, and
          automation.
        </p>
        <div className="ascii-rule" />
      </section>

      <section className="record-grid">
        <Link
          to="/projects"
          className="record"
        >
          <div className="record-meta">
            <span>01</span>
            <span>Project index</span>
          </div>
          <h2 className="record-title">Projects</h2>
          <p className="record-copy">
            Project records, experiments, and build notes.
          </p>
        </Link>

        <Link
          to="/notes"
          className="record"
        >
          <div className="record-meta">
            <span>02</span>
            <span>Notes</span>
          </div>
          <h2 className="record-title">Notes</h2>
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
            <Link to="/notes" className="button-link">
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
