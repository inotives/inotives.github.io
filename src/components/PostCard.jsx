import { Link } from 'react-router-dom'

export default function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="block p-6 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-white mb-2">{post.title}</h2>
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
            {post.date && <time>{post.date}</time>}
            {post.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {post.summary && (
            <p className="text-gray-400 text-sm">{post.summary}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
