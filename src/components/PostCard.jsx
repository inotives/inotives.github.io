import { Link } from 'react-router-dom'

export default function PostCard({ post }) {
  return (
    <Link
      to={`/notes/${post.slug}`}
      className="record"
    >
      <div className="record-meta">
        {post.date && <time>{post.date}</time>}
        {post.tags.length > 0 && <span>{post.tags.join(' / ')}</span>}
      </div>

      <h2 className="record-title">{post.title}</h2>

      {post.summary && (
        <p className="record-copy">{post.summary}</p>
      )}

      {post.tags.length > 0 && (
        <div className="tag-row mt-4">
          {post.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
