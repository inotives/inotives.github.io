import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPostsBySeries } from '../utils/content'
import { formatShort } from '../utils/dates'
import { SERIES_META } from '../utils/series'
import PostCard from '../components/PostCard'
import SeriesModel from '../components/SeriesModel'

function SeriesIndex() {
  const stacks = useMemo(
    () =>
      Object.entries(SERIES_META).map(([slug, meta]) => ({
        key: slug,
        label: meta.title,
        posts: getPostsBySeries(slug).slice().reverse(),
      })),
    []
  )

  return (
    <div className="page-stack">
      <header>
        <h1 className="page-title">Series</h1>
        <p className="section-copy">Notes that build on each other. Read them in order.</p>
      </header>
      <SeriesModel stacks={stacks} className="series-model-wide" />
      <ol className="ledger">
        {stacks.map(({ key, label, posts }) => (
          <li key={key} className="ledger-row">
            <div className="ledger-date">{posts.length} notes</div>
            <div>
              <h2 className="ledger-title">
                <Link to={`/series/${key}`}>{label}</Link>
              </h2>
              <p className="ledger-summary">{SERIES_META[key].description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function SeriesPage() {
  const { slug } = useParams()
  const [hoveredSlug, setHoveredSlug] = useState(null)
  const meta = SERIES_META[slug]
  // Series read in publishing order, oldest first
  const posts = useMemo(() => getPostsBySeries(slug).slice().reverse(), [slug])
  const stacks = useMemo(() => [{ key: slug, label: meta?.title, posts }], [slug, meta, posts])

  if (!slug) return <SeriesIndex />

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
      <header className="series-hero">
        <div>
          <Link to="/series" className="back-link">
            All series
          </Link>
          <h1 className="page-title">{meta.title}</h1>
          <p className="section-copy">
            {meta.description}
            {posts.length > 0 &&
              ` ${posts.length} ${posts.length === 1 ? 'note' : 'notes'}, from ${formatShort(posts[0].date)} to ${formatShort(posts[posts.length - 1].date)}.`}
          </p>
        </div>
        {posts.length > 0 && (
          <SeriesModel stacks={stacks} highlightSlug={hoveredSlug} onHoverSlug={setHoveredSlug} />
        )}
      </header>

      {posts.length === 0 ? (
        <p className="empty-state">
          No notes in this series yet. Notes with <code>series: {slug}</code> in their
          frontmatter will appear here.
        </p>
      ) : (
        <ol className="ledger ledger-numbered">
          {posts.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              highlighted={post.slug === hoveredSlug}
              onHover={setHoveredSlug}
            />
          ))}
        </ol>
      )}
    </div>
  )
}
