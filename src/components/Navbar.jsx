import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

const navLinks = [
  { to: '/notes', label: 'Notes' },
  { to: '/series', label: 'Series' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
]

export default function Navbar() {
  const location = useLocation()
  // the menu remembers the page it was opened on, so any route change
  // (a link, back or forward) closes it without an extra effect
  const [openedOn, setOpenedOn] = useState(null)
  const menuOpen = openedOn === location.pathname
  const closeMenu = () => setOpenedOn(null)
  const menuButtonRef = useRef(null)
  const drawerRef = useRef(null)
  const wasOpen = useRef(false)

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // while open: lock page scroll, close on Escape, move focus into the drawer;
  // on close, hand focus back to the menu button
  useEffect(() => {
    if (!menuOpen) {
      if (wasOpen.current) menuButtonRef.current?.focus()
      wasOpen.current = false
      return
    }
    wasOpen.current = true

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('a, button')?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  // rendered outside the header: its backdrop-filter would otherwise trap the
  // fixed-position drawer inside the 60px header bar
  const drawer = createPortal(
    <div className={`nav-drawer ${menuOpen ? 'is-open' : ''}`} inert={!menuOpen}>
      <div className="nav-drawer-scrim" onClick={closeMenu} />
      <div
        ref={drawerRef}
        id="nav-drawer-panel"
        className="nav-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <button
          onClick={closeMenu}
          className="menu-button nav-drawer-close"
          aria-label="Close menu"
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <nav aria-label="Site">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={closeMenu}
              className={`nav-drawer-link ${isActive(to) ? 'is-active' : ''}`}
              aria-current={isActive(to) ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>,
    document.body
  )

  return (
    <nav className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          <img className="brand-logo" src="/assets/images/logo/logo-dark.svg" alt="" />
          inoTives
        </Link>

        <div className="nav-links">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${isActive(to) ? 'nav-link-active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </div>

        <button
          ref={menuButtonRef}
          onClick={() => setOpenedOn(location.pathname)}
          className="menu-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="nav-drawer-panel"
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {drawer}
    </nav>
  )
}
