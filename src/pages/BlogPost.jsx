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
    return <p className="empty-state">Loading...</p>
  }

  if (!post) {
    return (
      <div>
        <h1 className="section-title">Post not found</h1>
        <Link to="/blog" className="back-link">
          &larr; Back to blog
        </Link>
      </div>
    )
  }

  return (
    <article>
      <Link to="/blog" className="back-link">
        &larr; Back to blog
      </Link>

      <header className="article-header">
        <p className="label">Entry / notes</p>
        <h1 className="article-title">{post.title}</h1>
        <div className="record-meta">
          {post.date && <time>{post.date}</time>}
          {post.tags.length > 0 && (
            <div className="tag-row">
              {post.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <MarkdownRenderer content={post.content} />

      <nav className="article-nav">
        <div>
          {prevPost && (
            <Link
              to={`/blog/${prevPost.slug}`}
              className="article-nav-link"
            >
              <span>Previous</span>
              <p>
                &larr; {prevPost.title}
              </p>
            </Link>
          )}
        </div>
        <div>
          {nextPost && (
            <Link
              to={`/blog/${nextPost.slug}`}
              className="article-nav-link"
            >
              <span>Next</span>
              <p>
                {nextPost.title} &rarr;
              </p>
            </Link>
          )}
        </div>
      </nav>
    </article>
  )
}
