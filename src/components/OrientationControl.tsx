import { useEffect, useState } from 'react'

export function OrientationControl() {
  const [landscape, setLandscape] = useState(() => window.matchMedia('(orientation: landscape)').matches)
  const [forcedPortrait, setForcedPortrait] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const query = window.matchMedia('(orientation: landscape)')
    const update = () => setLandscape(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  async function forcePortrait() {
    setMessage(null)
    try {
      await screen.orientation.lock('portrait')
      setForcedPortrait(true)
    } catch {
      setMessage('Turn on Auto-rotate, then rotate your phone.')
    }
  }

  function useAutoRotate() {
    try {
      screen.orientation.unlock()
    } catch {
      // Browsers that do not support the API simply keep the device setting.
    }
    setForcedPortrait(false)
    setMessage(null)
  }

  return (
    <div className={`orientation-control ${landscape ? 'is-landscape' : ''}`}>
      {landscape ? (
        <button type="button" onClick={() => void forcePortrait()} aria-label="Switch to portrait view">
          <RotateIcon />
          <span>Portrait</span>
        </button>
      ) : forcedPortrait ? (
        <button type="button" onClick={useAutoRotate} aria-label="Use automatic screen rotation">
          <RotateIcon />
          <span>Auto rotate</span>
        </button>
      ) : null}
      {message && <p role="status">{message}</p>}
    </div>
  )
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M3.5 9A9 9 0 0 1 7 3.8M3.5 9V4.5M3.5 9H8" />
    </svg>
  )
}
