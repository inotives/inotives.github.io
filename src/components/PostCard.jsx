import { Link } from 'react-router-dom'
import { formatShort, isRecent } from '../utils/dates'

export default function PostCard({ post }) {
  return (
    <li className="ledger-row">
      <div className="ledger-date">
        {post.date && <time dateTime={post.date}>{formatShort(post.date)}</time>}
        {post.date && isRecent(post.date) && (
          <>
            <br />
            <span className="badge-new">New</span>
          </>
        )}
      </div>

      <div>
        <h3 className="ledger-title">
          <Link to={`/notes/${post.slug}`}>{post.title}</Link>
        </h3>

        {post.summary && <p className="ledger-summary">{post.summary}</p>}

        {post.tags.length > 0 && (
          <div className="ledger-tags">
            {post.tags.map((tag, i) => (
              <span key={tag}>
                {i > 0 && ', '}
                <Link to={`/notes?tag=${encodeURIComponent(tag)}`}>{tag}</Link>
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}
