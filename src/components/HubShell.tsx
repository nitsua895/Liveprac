import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AmbientGlow } from './AmbientGlow'
import { OrientationControl } from './OrientationControl'

const NAV_ITEMS = [
  { to: '/', label: 'Hub', end: true },
  { to: '/build', label: 'Build' },
  { to: '/log', label: 'Client Log' },
  { to: '/settings', label: 'Settings' },
]

export function HubShell() {
  // The live session hides the nav and runs tighter padding: everything has to
  // be legible at a glance from across the table without scrolling.
  const location = useLocation()
  const inSession = location.pathname === '/session'

  // Older installed builds declared a landscape-only manifest. Explicitly
  // release that lock after navigation/reload while the refreshed manifest
  // propagates through Android's installed-web-app cache.
  useEffect(() => {
    if (!inSession && Math.min(window.innerWidth, window.innerHeight) < 600) {
      void screen.orientation.lock('portrait').catch(() => {
        // A normal browser tab may require fullscreen; the visible Portrait
        // control remains available for the installed app.
      })
      return
    }
    try {
      screen.orientation?.unlock()
    } catch {
      // Some browsers expose the API but reserve it for installed/fullscreen apps.
    }
  }, [inSession, location.pathname])

  useEffect(() => {
    document.documentElement.classList.toggle('live-session-active', inSession)
    return () => document.documentElement.classList.remove('live-session-active')
  }, [inSession])

  return (
    <div className="app-shell min-h-screen bg-neutral-950 text-neutral-100">
      <AmbientGlow />
      <OrientationControl />
      <main
        className={`app-main mx-auto ${
          inSession
            ? 'live-session-main max-w-6xl px-3 pb-4 pt-3 sm:px-5 sm:pb-6 sm:pt-5 lg:px-6 lg:pt-6'
            : 'max-w-4xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:px-8 lg:pt-14'
        }`}
      >
        <Outlet />
      </main>
      <nav
        hidden={inSession}
        className="app-nav fixed inset-x-0 bottom-0 border-t border-neutral-900 bg-neutral-950/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-4xl justify-around px-1 py-2 sm:px-4 sm:py-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-2 py-1.5 text-xs transition-colors sm:px-4 sm:text-sm ${
                  isActive ? 'bg-accent-500/10 text-accent-300' : 'text-neutral-500'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
