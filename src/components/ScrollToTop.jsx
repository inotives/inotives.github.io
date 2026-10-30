import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// The SPA keeps the previous page's scroll position when the route changes,
// so following a link (e.g. "Next note") would land mid-article. Start each
// newly visited page at the top; back/forward (POP) is left to the browser.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    if (navigationType === 'POP') return
    // instant, overriding the site's smooth scrolling
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, navigationType])

  return null
}
