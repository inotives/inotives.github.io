import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import { formatMonth } from '../utils/dates'
import { TOPICS, getTagCounts, normalizeTag, postTags, postTopics } from '../utils/tags'
import PostCard from '../components/PostCard'

const PAGE_SIZE = 30
const TAG_SUGGESTIONS = 8

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
  const activeTopic = TOPICS.some((t) => t.id === searchParams.get('topic')) ? searchParams.get('topic') : null
  const rawTag = searchParams.get('tag')
  const activeTag = rawTag ? normalizeTag(rawTag) : null
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const tagCounts = getTagCounts()
  const topicsBySlug = useMemo(() => Object.fromEntries(posts.map((p) => [p.slug, postTopics(p)])), [posts])
  const topicCounts = useMemo(() => {
    const counts = {}
    Object.values(topicsBySlug).forEach((ids) => ids.forEach((id) => (counts[id] = (counts[id] || 0) + 1)))
    return counts
  }, [topicsBySlug])

  const query = search.trim().toLowerCase()

  // Tags whose name matches the search, most used first, offered as one-click filters
  const tagMatches = useMemo(() => {
    if (query.length < 2) return []
    return Object.entries(tagCounts)
      .filter(([tag]) => tag.includes(query.replace(/\s+/g, '-')) && tag !== activeTag)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TAG_SUGGESTIONS)
  }, [query, tagCounts, activeTag])

  const filtered = posts.filter((post) => {
    if (activeTopic && !topicsBySlug[post.slug].includes(activeTopic)) return false
    if (activeTag && !postTags(post).includes(activeTag)) return false
    if (!query) return true
    return (
      post.title.toLowerCase().includes(query) ||
      post.summary.toLowerCase().includes(query) ||
      postTags(post).some((t) => t.includes(query))
    )
  })
  const shown = filtered.slice(0, limit)

  function updateFilters(next) {
    setLimit(PAGE_SIZE)
    const params = {}
    const topic = 'topic' in next ? next.topic : activeTopic
    const tag = 'tag' in next ? next.tag : activeTag
    if (topic) params.topic = topic
    if (tag) params.tag = tag
    setSearchParams(params)
  }

  function chooseTag(tag) {
    setSearch('')
    updateFilters({ tag })
  }

  const topicLabel = TOPICS.find((t) => t.id === activeTopic)?.label

  return (
    <div className="page-stack">
      <header>
        <h1 className="page-title">Notes</h1>
        <p className="section-copy">
          Everything I&apos;ve written, newest first. Browse by topic, or search for any tag.
        </p>
      </header>

      <section className="notes-filters" aria-label="Filter notes">
        <div className="topic-row" role="group" aria-label="Topics">
          <button
            type="button"
            className={`topic-button ${!activeTopic ? 'is-active' : ''}`}
            aria-pressed={!activeTopic}
            onClick={() => updateFilters({ topic: null })}
          >
            All topics
            <small>{posts.length}</small>
          </button>
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className={`topic-button ${topic.id === activeTopic ? 'is-active' : ''}`}
              aria-pressed={topic.id === activeTopic}
              onClick={() => updateFilters({ topic: topic.id === activeTopic ? null : topic.id })}
            >
              {topic.label}
              <small>{topicCounts[topic.id] || 0}</small>
            </button>
          ))}
        </div>

        <div className="notes-search">
          <input
            type="search"
            aria-label="Search notes and tags"
            placeholder="Search titles, summaries and tags"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setLimit(PAGE_SIZE)
            }}
            className="input"
          />
          {tagMatches.length > 0 && (
            <div className="tag-suggestions" aria-label="Matching tags">
              <span>Filter by tag</span>
              {tagMatches.map(([tag, count]) => (
                <button key={tag} type="button" className="tag" onClick={() => chooseTag(tag)}>
                  {tag}
                  <small>{count}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="notes-active">
          <p className="notes-count">
            {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
            {topicLabel && <> in {topicLabel}</>}
            {query && <> matching &ldquo;{search.trim()}&rdquo;</>}
          </p>
          {activeTag && (
            <button
              type="button"
              className="tag tag-active"
              onClick={() => updateFilters({ tag: null })}
              aria-label={`Remove tag filter ${activeTag}`}
            >
              Tag: {activeTag}
              <span aria-hidden="true" className="tag-remove">
                ×
              </span>
            </button>
          )}
        </div>
      </section>

      <section>
        {filtered.length === 0 ? (
          <p className="empty-state">
            No notes match. Clear the search, remove the tag or pick another topic.
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
