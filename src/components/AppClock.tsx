import { useEffect, useState } from 'react'

export function AppClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <time className="app-clock" dateTime={now.toISOString()}>
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </time>
  )
}
