import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import { formatMonth } from '../utils/dates'
import PostCard from '../components/PostCard'

const PAGE_SIZE = 30
const TOP_TAG_COUNT = 14

function countTags(posts) {
  const counts = {}
  posts.forEach((post) => post.tags.forEach((tag) => (counts[tag] = (counts[tag] || 0) + 1)))
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function groupByMonth(posts) {
  const groups = []
  posts.forEach((post) => {
    const month = post.date?.slice(0, 7) || 'undated'
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.posts.push(post)
    else groups.push({ month, posts: [post] })
  })
  return groups
}

export default function Notes() {
  const posts = getAllPosts()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [showAllTags, setShowAllTags] = useState(false)

  const tagCounts = countTags(posts)
  const visibleTags = showAllTags ? tagCounts : tagCounts.slice(0, TOP_TAG_COUNT)
  // Keep a tag chosen from a note visible even when it isn't a top tag
  if (activeTag && !visibleTags.some(([tag]) => tag === activeTag)) {
    const match = tagCounts.find(([tag]) => tag === activeTag)
    if (match) visibleTags.push(match)
  }

  const query = search.trim().toLowerCase()
  const filtered = posts.filter((post) => {
    if (activeTag && !post.tags.includes(activeTag)) return false
    if (!query) return true
    return (
      post.title.toLowerCase().includes(query) ||
      post.summary.toLowerCase().includes(query) ||
      post.tags.some((t) => t.toLowerCase().includes(query))
    )
  })
  const shown = filtered.slice(0, limit)

  function handleSearch(value) {
    setSearch(value)
    setLimit(PAGE_SIZE)
  }

  function handleTagClick(tag) {
    setLimit(PAGE_SIZE)
    if (!tag || tag === activeTag) setSearchParams({})
    else setSearchParams({ tag })
  }

  return (
    <div className="page-stack">
      <header>
        <h1 className="page-title">Notes</h1>
        <p className="section-copy">
          Everything I&apos;ve written, newest first. Search, or narrow the list by tag.
        </p>
      </header>

      <section className="notes-filters" aria-label="Filter notes">
        <input
          type="search"
          aria-label="Search notes"
          placeholder="Search titles, summaries and tags"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="input"
        />
        <div className="tag-row">
          <button
            type="button"
            className={`tag ${!activeTag ? 'tag-active' : ''}`}
            aria-pressed={!activeTag}
            onClick={() => handleTagClick(null)}
          >
            All
          </button>
          {visibleTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              className={`tag ${tag === activeTag ? 'tag-active' : ''}`}
              aria-pressed={tag === activeTag}
              onClick={() => handleTagClick(tag)}
            >
              {tag}
              <small>{count}</small>
            </button>
          ))}
          {tagCounts.length > TOP_TAG_COUNT && (
            <button type="button" className="tag" onClick={() => setShowAllTags((open) => !open)}>
              {showAllTags ? 'Fewer tags' : `All ${tagCounts.length} tags`}
            </button>
          )}
        </div>
        <p className="notes-count">
          {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
          {activeTag && <> tagged {activeTag}</>}
          {query && <> matching &ldquo;{search.trim()}&rdquo;</>}
        </p>
      </section>

      <section>
        {filtered.length === 0 ? (
          <p className="empty-state">
            No notes match. Clear the search or pick another tag.
          </p>
        ) : (
          <>
            {groupByMonth(shown).map(({ month, posts: monthPosts }) => (
              <section key={month} className="notes-month">
                <div className="notes-month-head">
                  <h2>{month === 'undated' ? 'Undated' : formatMonth(month)}</h2>
                  <span>
                    {monthPosts.length} {monthPosts.length === 1 ? 'note' : 'notes'}
                  </span>
                </div>
                <ol className="ledger">
                  {monthPosts.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </ol>
              </section>
            ))}
            {filtered.length > shown.length && (
              <button type="button" className="show-more" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - shown.length)} more notes
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}
