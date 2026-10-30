import { Link } from 'react-router-dom'
import { formatShort, isRecent } from '../utils/dates'
import { commonTags, postTags } from '../utils/tags'

// Rows show a note's most widely used tags; the full list is on the note itself
const ROW_TAGS = 3

export default function PostCard({ post, highlighted = false, onHover }) {
  return (
    <li
      className={`ledger-row ${highlighted ? 'is-highlighted' : ''}`}
      onMouseEnter={onHover && (() => onHover(post.slug))}
      onMouseLeave={onHover && (() => onHover(null))}
    >
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
            {commonTags(post, ROW_TAGS).map((tag, i) => (
              <span key={tag}>
                {i > 0 && ', '}
                <Link to={`/notes?tag=${encodeURIComponent(tag)}`}>{tag}</Link>
              </span>
            ))}
            {postTags(post).length > ROW_TAGS && (
              <span className="ledger-tags-more"> +{postTags(post).length - ROW_TAGS}</span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
