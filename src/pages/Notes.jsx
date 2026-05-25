import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import PostCard from '../components/PostCard'

const PAGE_SIZE = 10

export default function Notes() {
  const posts = getAllPosts()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const loaderRef = useRef(null)

  // Collect all unique tags
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort()

  const filtered = posts.filter((post) => {
    if (activeTag && !post.tags.includes(activeTag)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        post.title.toLowerCase().includes(q) ||
        post.summary.toLowerCase().includes(q) ||
        post.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  // Reset visible count when filters change
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [search, activeTag])

  // Infinite scroll via IntersectionObserver
  const observerCallback = useCallback(
    (entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setVisible((v) => v + PAGE_SIZE)
      }
    },
    [hasMore]
  )

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '200px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [observerCallback])

  function handleTagClick(tag) {
    if (tag === activeTag) {
      setSearchParams({})
    } else {
      setSearchParams({ tag })
    }
  }

  return (
    <div className="page-stack">
      <section className="manual-section">
        <p className="label">Index / notes</p>
        <h1 className="page-title">Notes</h1>
        <p className="section-copy">
          Notes, tutorials, and operating records from the inoTives workspace.
        </p>
      </section>

      <section>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />

          {allTags.length > 0 && (
            <div className="tag-row">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`tag ${tag === activeTag ? 'tag-active' : ''}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="empty-state">No notes found.</p>
        ) : (
          <div className="record-list">
            {shown.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}

        {hasMore && (
          <div ref={loaderRef} className="empty-state py-8 text-center">
            Loading more...
          </div>
        )}
      </section>
    </div>
  )
}
