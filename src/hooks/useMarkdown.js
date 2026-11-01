import { useState, useEffect } from 'react'
import { getPostBySlug, getPage } from '../utils/content'

// Loads `load(key)` whenever `key` changes. `loading` is derived from which key
// the stored value belongs to, so the effect never sets state synchronously, and
// a slow response for a key the user has already navigated away from is ignored.
function useKeyedLoad(key, load) {
  const [state, setState] = useState({ key: undefined, value: null })

  useEffect(() => {
    if (!key) return
    let current = true
    load(key)
      .then((value) => current && setState({ key, value }))
      .catch(() => current && setState({ key, value: null }))
    return () => {
      current = false
    }
  }, [key, load])

  return { value: state.value, loading: state.key !== key }
}

export function usePost(slug) {
  const { value, loading } = useKeyedLoad(slug, getPostBySlug)
  return { post: value, loading }
}

export function usePage(name) {
  const { value, loading } = useKeyedLoad(name, getPage)
  return { page: value, loading }
}
