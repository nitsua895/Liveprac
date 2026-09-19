import { useState } from 'react'
import { useAppState } from '../state/AppStateContext'

/**
 * Peripheral-vision cue for the therapist. Real gaze detection would need a
 * camera pointed at an undressed client — a trust problem — so acknowledgment
 * is a tap instead of a look.
 *
 * The vignette is a soft inset glow at the screen edges (not a hard ring),
 * meant to register peripherally rather than pull focus. It deliberately
 * does NOT intercept the whole screen — Shelby still needs to reach the
 * session controls underneath while a cue is showing, so only the banner
 * pill itself is tappable. The pill is enlarged and gets a visible
 * shrink-and-fade on dismiss so there's no ambiguity that the tap landed.
 */
export function AmbientGlow() {
  const { ambientCues, dismissAmbientCue } = useAppState()
  const current = ambientCues[0]
  const stackCount = ambientCues.length
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  function handleDismiss() {
    if (!current || dismissingId) return
    setDismissingId(current.id)
    setTimeout(() => dismissAmbientCue(current.id), 200)
  }

  const isDismissing = current && dismissingId === current.id

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <div
        className={`ambient-vignette absolute inset-0 transition-opacity duration-700 ${
          current ? 'animate-pulse-slow opacity-100' : 'opacity-0'
        }`}
      />
      {current && <div key={ambientCues.at(-1)?.id} className="ambient-vignette-flash absolute inset-0" />}
      {current && (
        <div className="pointer-events-auto absolute left-1/2 top-28 -translate-x-1/2">
          <button
            type="button"
            onClick={handleDismiss}
            className={`flex items-center gap-3 rounded-full border border-accent-300/30 bg-neutral-900/95 px-6 py-3.5 text-base text-accent-200 shadow-xl shadow-accent-900/40 backdrop-blur ${
              isDismissing ? 'cue-exit' : 'cue-enter'
            }`}
          >
            <span>{current.message}</span>
            <span className="text-sm text-accent-400/70">tap to clear</span>
            {stackCount > 1 && (
              <span className="rounded-full bg-accent-500/20 px-2.5 py-0.5 text-xs text-accent-300">
                +{stackCount - 1} more
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
