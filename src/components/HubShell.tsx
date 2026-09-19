import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AmbientGlow } from './AmbientGlow'

const NAV_ITEMS = [
  { to: '/', label: 'Hub', end: true },
  { to: '/build', label: 'Build' },
  { to: '/log', label: 'Client Log' },
  { to: '/settings', label: 'Settings' },
]

export function HubShell() {
  // The live session hides the nav and runs tighter padding: everything has to
  // be legible at a glance from across the table without scrolling.
  const inSession = useLocation().pathname === '/session'

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <AmbientGlow />
      <main
        className={`mx-auto ${inSession ? 'max-w-6xl px-6 pb-6 pt-6' : 'max-w-4xl px-8 pb-28 pt-14'}`}
      >
        <Outlet />
      </main>
      <nav
        hidden={inSession}
        className="fixed inset-x-0 bottom-0 border-t border-neutral-900 bg-neutral-950/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-4xl justify-around px-4 py-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-4 py-1.5 text-sm transition-colors ${
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
