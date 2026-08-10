import { Link, useParams } from 'react-router-dom'
import { getPostsBySeries } from '../utils/content'
import PostCard from '../components/PostCard'

const SERIES_META = {
  'building-ai-systems': {
    title: 'Building AI Systems That Scale',
    description:
      'Notes on designing, operating, and cost-controlling agentic AI systems in production. Covers loop prevention, token budgeting, human-in-the-loop design, and the architectural patterns that separate working deployments from expensive failures.',
    label: 'ai-systems',
  },
  'data-engineering': {
    title: 'Data Engineering',
    description:
      'Notes on building and operating data pipelines, ELT stacks, data modeling, and the infrastructure that turns raw data into something useful.',
    label: 'data-engineering',
  },
  'data-engineering-in-30-days': {
    title: 'Data Engineering in 30 Days',
    description:
      'A practical learning path from SQL and files to reliable pipelines, warehouses, and AI-ready data systems. Each entry takes one concept far enough to build with it.',
    label: '30-day-learning-path',
  },
}

export default function SeriesPage() {
  const { slug } = useParams()
  const meta = SERIES_META[slug]
  const posts = getPostsBySeries(slug)

  if (!meta) {
    return (
      <div className="page-stack">
        <section className="manual-section">
          <Link to="/notes" className="back-link">
            &larr; Back to notes
          </Link>
          <h1 className="page-title">Series not found</h1>
          <p className="empty-state">
            Unknown series slug: <code>{slug}</code>
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="manual-section">
        <Link to="/notes" className="back-link">
          &larr; Back to notes
        </Link>
        <p className="label">Series / {meta.label}</p>
        <h1 className="page-title">{meta.title}</h1>
        {meta.description && (
          <p className="section-copy">{meta.description}</p>
        )}
      </section>

      <section className="manual-section">
        <p className="label">Series / entries</p>
        <h2 className="section-title">Articles</h2>

        {posts.length === 0 ? (
          <p className="empty-state">
            No articles in this series yet. Articles with{' '}
            <code>series: {slug}</code> in their frontmatter will appear here.
          </p>
        ) : (
          <>
            <p className="notes-count">
              {posts.length} {posts.length === 1 ? 'article' : 'articles'}
            </p>
            <div className="record-list">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
