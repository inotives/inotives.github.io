import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import PostCard from '../components/PostCard'

const PAGE_SIZE = 10

export default function Notes() {
  const posts = getAllPosts()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const shown = filtered.slice(start, start + PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, activeTag])

  function handleTagClick(tag) {
    if (tag === activeTag) {
      setSearchParams({})
    } else {
      setSearchParams({ tag })
    }
  }

  function goTo(p) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function renderPagination() {
    if (totalPages <= 1) return null

    const pages = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages, startPage + maxVisible - 1)
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    if (currentPage > 1) {
      pages.push(
        <button key="prev" className="page-btn" onClick={() => goTo(currentPage - 1)}>
          ← Prev
        </button>
      )
    }

    if (startPage > 1) {
      pages.push(
        <button key={1} className="page-btn" onClick={() => goTo(1)}>1</button>
      )
      if (startPage > 2) pages.push(<span key="dots-s" className="page-dots">…</span>)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          className={`page-btn ${i === currentPage ? 'page-btn-active' : ''}`}
          onClick={() => goTo(i)}
        >
          {i}
        </button>
      )
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push(<span key="dots-e" className="page-dots">…</span>)
      pages.push(
        <button key={totalPages} className="page-btn" onClick={() => goTo(totalPages)}>
          {totalPages}
        </button>
      )
    }

    if (currentPage < totalPages) {
      pages.push(
        <button key="next" className="page-btn" onClick={() => goTo(currentPage + 1)}>
          Next →
        </button>
      )
    }

    return <div className="pagination">{pages}</div>
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
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input notes-search"
        />

        <div className="notes-layout">
          <div className="notes-main">
            {filtered.length === 0 ? (
              <p className="empty-state">No notes found.</p>
            ) : (
              <>
                <p className="notes-count">
                  {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
                  {activeTag && <> tagged <span className="tag tag-active tag-static">{activeTag}</span></>}
                </p>
                <div className="record-list">
                  {shown.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
                {renderPagination()}
              </>
            )}
          </div>

          {allTags.length > 0 && (
            <aside className="notes-sidebar">
              <h3 className="notes-sidebar-title">Tags</h3>
              <div className="notes-tag-list">
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
            </aside>
          )}
        </div>
      </section>
    </div>
  )
}
