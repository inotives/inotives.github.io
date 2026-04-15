import { useState, useEffect } from 'react'
import { getPostBySlug, getPage } from '../utils/content'

export function usePost(slug) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getPostBySlug(slug)
      .then(setPost)
      .finally(() => setLoading(false))
  }, [slug])

  return { post, loading }
}

export function usePage(name) {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!name) return
    setLoading(true)
    getPage(name)
      .then(setPage)
      .finally(() => setLoading(false))
  }, [name])

  return { page, loading }
}
