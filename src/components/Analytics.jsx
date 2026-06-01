import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const MEASUREMENT_ID = 'G-4YNYH67DHH'

export default function Analytics() {
  const location = useLocation()

  useEffect(() => {
    if (typeof window.gtag !== 'function') return

    window.gtag('config', MEASUREMENT_ID, {
      page_path: `${location.pathname}${location.search}`,
      page_title: document.title,
    })
  }, [location.pathname, location.search])

  return null
}
