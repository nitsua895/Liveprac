import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { getCueColor } from '../lib/cueLabels'
import { deriveCueVars } from '../lib/color'
import { playCueSound } from '../lib/cueSound'
import { useAppState } from '../state/AppStateContext'

/** Feedback is hands-free: eleven seconds to read, then a gentle one-second fade.
 * Each cue expires independently so a new opposing request never waits in a queue.
 * The event log and dial markers remain after the transient glow disappears. */
export function AmbientGlow() {
  const { ambientCues, dismissAmbientCue } = useAppState()
  const dismiss = useRef(dismissAmbientCue)
  const played = useRef<string | null>(null)
  dismiss.current = dismissAmbientCue
  const current = ambientCues[ambientCues.length - 1]
  const signature = ambientCues.map((cue) => `${cue.id}:${cue.createdAt}:${cue.count}`).join('|')

  useEffect(() => {
    const timers = ambientCues.map((cue) =>
      setTimeout(() => dismiss.current(cue.id), Math.max(0, cue.createdAt + 12000 - Date.now())),
    )
    return () => timers.forEach(clearTimeout)
    // The signature changes only on a new or repeated cue, not session clock ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  useEffect(() => {
    if (!current) return
    const soundId = `${current.id}:${current.createdAt}:${current.count}`
    if (played.current === soundId) return
    played.current = soundId
    playCueSound(current)
  }, [current])

  if (!current) return null
  const customHex = getCueColor(current.tone)
  const customVars = customHex ? (deriveCueVars(customHex) as CSSProperties) : undefined
  return (
    <div key={`${current.id}:${current.createdAt}:${current.count}`}
      className="cue-hold pointer-events-none fixed inset-0 z-40" data-tone={current.tone} style={customVars}>
      <div className="cue-glow ambient-vignette absolute inset-0" />
      <div className="ambient-vignette-flash absolute inset-0" />
      <div className="cue-banner" role="status" aria-live="polite" aria-atomic="true">
        <span>{current.message}</span>
        {current.count > 1 && <span className="ml-3 opacity-80">×{current.count}</span>}
      </div>
    </div>
  )
}
