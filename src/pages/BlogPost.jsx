import { useParams, Link } from 'react-router-dom'
import { usePost } from '../hooks/useMarkdown'
import { getAllPosts } from '../utils/content'
import MarkdownRenderer from '../components/MarkdownRenderer'

export default function BlogPost() {
  const { slug } = useParams()
  const { post, loading } = usePost(slug)

  // Get prev/next posts
  const allPosts = getAllPosts()
  const currentIndex = allPosts.findIndex((p) => p.slug === slug)
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null

  if (loading) {
    return <p className="text-gray-400">Loading...</p>
  }

  if (!post) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-white mb-4">Post not found</h1>
        <Link to="/blog" className="text-blue-400 hover:underline">
          &larr; Back to blog
        </Link>
      </div>
    )
  }

  return (
    <article>
      <Link to="/blog" className="text-sm text-gray-400 hover:text-white mb-6 inline-block">
        &larr; Back to blog
      </Link>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-3">{post.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {post.date && <time>{post.date}</time>}
          {post.tags.length > 0 && (
            <div className="flex gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <MarkdownRenderer content={post.content} />

      {/* Prev / Next navigation */}
      <nav className="mt-12 pt-8 border-t border-gray-800 flex justify-between gap-4">
        <div className="flex-1">
          {prevPost && (
            <Link
              to={`/blog/${prevPost.slug}`}
              className="group block"
            >
              <span className="text-xs text-gray-500 uppercase tracking-wide">Previous</span>
              <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                &larr; {prevPost.title}
              </p>
            </Link>
          )}
        </div>
        <div className="flex-1 text-right">
          {nextPost && (
            <Link
              to={`/blog/${nextPost.slug}`}
              className="group block"
            >
              <span className="text-xs text-gray-500 uppercase tracking-wide">Next</span>
              <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                {nextPost.title} &rarr;
              </p>
            </Link>
          )}
        </div>
      </nav>
    </article>
  )
}
