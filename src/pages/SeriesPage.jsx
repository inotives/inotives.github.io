import { Link, useParams } from 'react-router-dom'
import { getPostsBySeries } from '../utils/content'
import { formatShort } from '../utils/dates'
import { SERIES_META } from '../utils/series'
import PostCard from '../components/PostCard'

function SeriesIndex() {
  return (
    <div className="page-stack">
      <header>
        <h1 className="page-title">Series</h1>
        <p className="section-copy">Notes that build on each other. Read them in order.</p>
      </header>
      <ol className="ledger">
        {Object.entries(SERIES_META).map(([slug, meta]) => {
          const count = getPostsBySeries(slug).length
          return (
            <li key={slug} className="ledger-row">
              <div className="ledger-date">{count} notes</div>
              <div>
                <h2 className="ledger-title">
                  <Link to={`/series/${slug}`}>{meta.title}</Link>
                </h2>
                <p className="ledger-summary">{meta.description}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function SeriesPage() {
  const { slug } = useParams()
  if (!slug) return <SeriesIndex />

  const meta = SERIES_META[slug]
  // Series read in publishing order, oldest first
  const posts = getPostsBySeries(slug).slice().reverse()

  if (!meta) {
    return (
      <div className="page-stack">
        <header>
          <Link to="/series" className="back-link">
            All series
          </Link>
          <h1 className="page-title">Series not found</h1>
          <p className="empty-state">
            There is no series called <code>{slug}</code>. Pick one from the series list.
          </p>
        </header>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <header>
        <Link to="/series" className="back-link">
          All series
        </Link>
        <h1 className="page-title">{meta.title}</h1>
        <p className="section-copy">
          {meta.description}
          {posts.length > 0 &&
            ` ${posts.length} ${posts.length === 1 ? 'note' : 'notes'}, from ${formatShort(posts[0].date)} to ${formatShort(posts[posts.length - 1].date)}.`}
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="empty-state">
          No notes in this series yet. Notes with <code>series: {slug}</code> in their
          frontmatter will appear here.
        </p>
      ) : (
        <ol className="ledger ledger-numbered">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </ol>
      )}
    </div>
  )
}
