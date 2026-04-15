import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import PostCard from '../components/PostCard'

const PAGE_SIZE = 10

export default function Blog() {
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
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Blog</h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Search posts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 mb-4 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600 text-sm"
      />

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-8">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                tag === activeTag
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Post list */}
      {filtered.length === 0 ? (
        <p className="text-gray-400">No posts found.</p>
      ) : (
        <div className="space-y-4">
          {shown.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loaderRef} className="py-8 text-center text-sm text-gray-500">
          Loading more...
        </div>
      )}
    </div>
  )
}
