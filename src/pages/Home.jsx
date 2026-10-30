import { Link } from 'react-router-dom'
import { getAllPosts, getPostsBySeries } from '../utils/content'
import { formatShort } from '../utils/dates'
import { SERIES_META } from '../utils/series'
import PostCard from '../components/PostCard'
import PublishingHeatmap from '../components/PublishingHeatmap'

const PROJECT_LINKS = [
  {
    to: '/projects/research-stocks-pro-open-price',
    name: 'Stock pre-open estimates',
    note: 'Pre-market research from my stock analysis agents',
  },
  {
    to: '/projects/research-stocks-weekly-summary',
    name: 'Weekly market summary',
    note: 'Sector movement, notable names, next-week watchpoints',
  },
  {
    to: '/projects/researches-adhoc',
    name: 'Ad hoc research',
    note: 'One-off agent research reports',
  },
]

const OTHER_LINKS = [
  { to: '/about', name: 'About me', note: 'Work experience, open source and tech stack' },
  { to: '/certification-guides', name: 'Certification guides', note: 'Study notes for technology certifications' },
]

export default function Home() {
  const posts = getAllPosts()
  const recentPosts = posts.slice(0, 7)
  const firstDate = posts[posts.length - 1]?.date

  return (
    <div className="page-stack">
      <section className="home-hero">
        <div>
          <h1 className="wordmark">inoTives</h1>
          <p className="dek">
            Working notes on data engineering, AI agent workflows, and research
            tools for crypto and stock markets.
          </p>
        </div>
        {firstDate && (
          <p className="hero-stat">
            <strong>{posts.length}</strong>
            notes since {formatShort(firstDate)}
          </p>
        )}
      </section>

      <PublishingHeatmap posts={posts} />

      <div className="home-split">
        <section>
          <div className="section-head">
            <h2 className="section-title">Latest notes</h2>
            <Link to="/notes" className="text-link">
              All {posts.length} notes
            </Link>
          </div>
          <ol className="ledger">
            {recentPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </ol>
        </section>

        <aside className="rail">
          <section>
            <h2 className="section-title">Series</h2>
            <ul>
              {Object.entries(SERIES_META).map(([slug, meta]) => {
                const seriesPosts = getPostsBySeries(slug)
                return (
                  <li key={slug}>
                    <Link to={`/series/${slug}`} className="rail-item">
                      <b>{meta.title}</b>
                      <span>
                        {seriesPosts.length} notes
                        {seriesPosts[0] && `, latest ${formatShort(seriesPosts[0].date)}`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <div className="section-head">
              <h2 className="section-title">Projects</h2>
              <Link to="/projects" className="text-link">
                All projects
              </Link>
            </div>
            <ul>
              {PROJECT_LINKS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="rail-item">
                    <b>{item.name}</b>
                    <span>{item.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="section-title">Also here</h2>
            <ul>
              {OTHER_LINKS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="rail-item">
                    <b>{item.name}</b>
                    <span>{item.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
