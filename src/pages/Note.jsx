import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePost } from '../hooks/useMarkdown'
import { getAllPosts, getPostMeta } from '../utils/content'
import { formatLong } from '../utils/dates'
import { SERIES_META } from '../utils/series'
import { postTags } from '../utils/tags'
import MarkdownRenderer from '../components/MarkdownRenderer'

const WORDS_PER_MINUTE = 220
// sticky header height plus a little breathing room
const HEADING_OFFSET = 120

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

function getReadingMinutes(content) {
  if (!content) return null
  const prose = content.replace(/```[\s\S]*?```/g, ' ')
  const words = prose.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

// Highlights the table-of-contents entry for the section being read
function useCurrentHeading(headings) {
  // remember which article's headings the id belongs to, so moving to another
  // note never carries over a highlight from the previous one
  const [current, setCurrent] = useState({ headings: null, id: null })

  useEffect(() => {
    if (headings.length === 0) return
    let frame = null

    // the current section is the last heading that has scrolled past the
    // reading line just below the sticky header
    const update = () => {
      frame = null
      let id = null
      for (const heading of headings) {
        const el = document.getElementById(heading.id)
        if (!el) continue
        if (el.getBoundingClientRect().top > HEADING_OFFSET) break
        id = heading.id
      }
      // at the very bottom, short final sections can never reach the line
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) id = headings[headings.length - 1].id
      setCurrent({ headings, id })
    }
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [headings])

  return current.headings === headings ? current.id : null
}

export default function Note() {
  const { slug } = useParams()
  const meta = getPostMeta(slug)
  const { post, loading } = usePost(slug)
  const commentsRef = useRef(null)

  // Get prev/next posts
  const allPosts = getAllPosts()
  const currentIndex = allPosts.findIndex((p) => p.slug === slug)
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null
  // The hook keeps the previous post until the next one loads
  const content = post?.slug === slug ? post.content : null
  const [tableOfContents, setTableOfContents] = useState([])
  const currentHeading = useCurrentHeading(tableOfContents)
  const readingMinutes = getReadingMinutes(content)
  const series = meta?.series ? SERIES_META[meta.series] : null

  useEffect(() => {
    setTableOfContents(getTableOfContents(content))
  }, [content])

  useEffect(() => {
    if (loading || !post) return
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
  }, [slug, loading, post])

  if (!meta || (!loading && !post)) {
    return (
      <div>
        <Link to="/notes" className="back-link">
          All notes
        </Link>
        <h1 className="page-title">Note not found</h1>
        <p className="empty-state">This note may have moved. Browse all notes to find it.</p>
      </div>
    )
  }

  return (
    <article>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/notes" className="text-link">
          All notes
        </Link>
        {series && (
          <Link to={`/series/${meta.series}`} className="text-link">
            {series.title}
          </Link>
        )}
      </nav>

      <header className="article-header">
        <h1 className="article-title">{meta.title}</h1>
        {meta.summary && <p className="article-standfirst">{meta.summary}</p>}
        <div className="article-meta">
          {meta.date && <time dateTime={meta.date}>{formatLong(meta.date)}</time>}
          {readingMinutes && <span>{readingMinutes} min read</span>}
          {meta.tags.length > 0 && (
            <span>
              {postTags(meta).map((tag, i) => (
                <span key={tag}>
                  {i > 0 && ', '}
                  <Link to={`/notes?tag=${encodeURIComponent(tag)}`}>{tag}</Link>
                </span>
              ))}
            </span>
          )}
        </div>
      </header>

      <div className="article-layout">
        {content ? <MarkdownRenderer content={content} /> : <div className="manual-prose" />}

        {tableOfContents.length > 0 && (
          <aside className="article-toc" aria-labelledby="article-toc-title">
            <h2 id="article-toc-title">On this page</h2>
            <nav aria-label="On this page">
              {tableOfContents.map((heading) => (
                <a
                  key={`${heading.id}-${heading.text}`}
                  className={[
                    'article-toc-link',
                    heading.level === 3 && 'is-nested',
                    heading.id === currentHeading && 'is-current',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  href={`#${heading.id}`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>

      <nav className="article-nav" aria-label="More notes">
        <div>
          {prevPost && (
            <Link to={`/notes/${prevPost.slug}`} className="article-nav-link">
              <span>Previous note</span>
              <p>{prevPost.title}</p>
            </Link>
          )}
        </div>
        <div>
          {nextPost && (
            <Link to={`/notes/${nextPost.slug}`} className="article-nav-link">
              <span>Next note</span>
              <p>{nextPost.title}</p>
            </Link>
          )}
        </div>
      </nav>

      <div ref={commentsRef} className="giscus-comments" />
    </article>
  )
}
