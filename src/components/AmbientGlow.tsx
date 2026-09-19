import { useEffect, useRef } from 'react'
import { useAppState } from '../state/AppStateContext'

/** Feedback is hands-free: eight seconds to read, then a gentle one-second fade.
 * Each cue expires independently so a new opposing request never waits in a queue.
 * The event log and dial markers remain after the transient glow disappears. */
export function AmbientGlow() {
  const { ambientCues, dismissAmbientCue } = useAppState()
  const dismiss = useRef(dismissAmbientCue)
  dismiss.current = dismissAmbientCue
  const current = ambientCues[ambientCues.length - 1]
  const signature = ambientCues.map((cue) => `${cue.id}:${cue.createdAt}:${cue.count}`).join('|')

  useEffect(() => {
    const timers = ambientCues.map((cue) =>
      setTimeout(() => dismiss.current(cue.id), Math.max(0, cue.createdAt + 9000 - Date.now())),
    )
    return () => timers.forEach(clearTimeout)
    // The signature changes only on a new or repeated cue, not session clock ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  if (!current) return null
  return (
    <div key={`${current.id}:${current.createdAt}:${current.count}`}
      className="cue-hold pointer-events-none fixed inset-0 z-40" data-tone={current.tone}>
      <div className="ambient-vignette absolute inset-0" />
      <div className="ambient-vignette-flash absolute inset-0" />
      <div className="cue-banner" role="status" aria-live="polite" aria-atomic="true">
        <span>{current.message}</span>
        {current.count > 1 && <span className="ml-3 opacity-80">×{current.count}</span>}
      </div>
    </div>
  )
}
