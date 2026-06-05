import { useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePost } from '../hooks/useMarkdown'
import { getAllPosts } from '../utils/content'
import MarkdownRenderer from '../components/MarkdownRenderer'

function slugifyHeading(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`"'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getTableOfContents(content) {
  if (!content) return []

  const headings = []
  const headingPattern = /^(#{2,3})\s+(.+)$/gm
  let match

  while ((match = headingPattern.exec(content)) !== null) {
    const text = match[2].replace(/[#`*_[\]()]/g, '').trim()
    if (!text) continue
    headings.push({
      id: slugifyHeading(text),
      level: match[1].length,
      text,
    })
  }

  return headings
}

export default function Note() {
  const { slug } = useParams()
  const { post, loading } = usePost(slug)
  const commentsRef = useRef(null)

  // Get prev/next posts
  const allPosts = getAllPosts()
  const currentIndex = allPosts.findIndex((p) => p.slug === slug)
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null
  const tableOfContents = getTableOfContents(post?.content)

  useEffect(() => {
    const el = commentsRef.current
    if (!el) return

    el.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', 'inotives/inotives.github.io')
    script.setAttribute('data-repo-id', 'MDEwOlJlcG9zaXRvcnkxNzMyMTU4NTY=')
    script.setAttribute('data-category', 'General')
    script.setAttribute('data-category-id', 'DIC_kwDOClMQcM4C-ijm')
    script.setAttribute('data-mapping', 'url')
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'bottom')
    script.setAttribute('data-theme', 'dark')
    script.setAttribute('data-lang', 'en')
    script.setAttribute('crossorigin', 'anonymous')
    script.async = true
    el.appendChild(script)
  }, [slug])

  if (loading) {
    return <p className="empty-state">Loading...</p>
  }

  if (!post) {
    return (
      <div>
        <h1 className="section-title">Post not found</h1>
        <Link to="/notes" className="back-link">
          &larr; Back to notes
        </Link>
      </div>
    )
  }

  return (
    <article>
      <Link to="/notes" className="back-link">
        &larr; Back to notes
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

      <div className="article-layout">
        <MarkdownRenderer content={post.content} />

        {tableOfContents.length > 0 && (
          <aside className="article-toc" aria-labelledby="article-toc-title">
            <h2 id="article-toc-title">On This Page</h2>
            <nav aria-label="On this page">
              {tableOfContents.map((heading) => (
                <a
                  key={`${heading.id}-${heading.text}`}
                  className={heading.level === 3 ? 'article-toc-link is-nested' : 'article-toc-link'}
                  href={`#${heading.id}`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>

      <div ref={commentsRef} className="giscus-comments" />

      <nav className="article-nav">
        <div>
          {prevPost && (
            <Link
              to={`/notes/${prevPost.slug}`}
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
              to={`/notes/${nextPost.slug}`}
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
