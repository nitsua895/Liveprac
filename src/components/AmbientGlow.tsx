import { useEffect, useState } from 'react'
import { useAppState } from '../state/AppStateContext'

/** Ignore taps this soon after a cue appears, so a tap already in motion
 *  toward a button doesn't clear a cue before it's been read. */
const GRACE_MS = 400

/**
 * Peripheral-vision cue for the therapist. Real gaze detection would need a
 * camera pointed at an undressed client — a trust problem — so acknowledgment
 * is a tap instead of a look.
 *
 * The vignette is a soft inset glow at the screen edges (not a hard ring),
 * meant to register peripherally rather than pull focus. A tap anywhere on
 * screen clears the current cue, including empty space; the listener is on the
 * document rather than a full-screen overlay so the session controls
 * underneath still work normally.
 */
export function AmbientGlow() {
  const { ambientCues, cueBump, dismissAmbientCue } = useAppState()
  const current = ambientCues[0]
  const stackCount = ambientCues.length
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  function handleDismiss() {
    // Compare against this cue, not a bare truthiness check — a stale id from a
    // previous dismissal would otherwise block every later cue from clearing.
    if (!current || dismissingId === current.id) return
    setDismissingId(current.id)
    setTimeout(() => dismissAmbientCue(current.id), 200)
  }

  const currentId = current?.id
  const shownAt = current?.createdAt
  useEffect(() => {
    if (!currentId) return
    function onPointerDown() {
      if (shownAt && Date.now() - shownAt < GRACE_MS) return
      handleDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, shownAt, dismissingId])

  const isDismissing = current && dismissingId === current.id

  return (
    <div className="pointer-events-none fixed inset-0 z-40" data-tone={current?.tone}>
      <div
        className={`ambient-vignette absolute inset-0 transition-opacity duration-700 ${
          current ? 'animate-pulse-slow opacity-100' : 'opacity-0'
        }`}
      />
      {/* Keyed on cueBump so a repeat folded into an existing cue still flashes. */}
      {current && <div key={cueBump} className="ambient-vignette-flash absolute inset-0" />}
      {/* Banner sits in the empty centre of the header row so it doesn't cover the dial. */}
      {current && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2">
          <div
            style={{ borderColor: 'var(--cue-border)', color: 'var(--cue-text)' }}
            className={`flex items-center gap-5 rounded-full border-2 bg-neutral-900/95 px-9 py-5 shadow-2xl backdrop-blur ${
              isDismissing ? 'cue-exit' : 'cue-enter'
            }`}
          >
            <span className="text-3xl font-medium tracking-wide">{current.message}</span>
            {current.count > 1 && (
              <span className="text-3xl font-medium opacity-70">×{current.count}</span>
            )}
            {stackCount > 1 && (
              <span
                className="rounded-full px-3.5 py-1 text-lg"
                style={{ background: 'var(--vignette-soft)' }}
              >
                +{stackCount - 1}
              </span>
            )}
            <span className="text-base text-neutral-500">tap anywhere</span>
          </div>
        </div>
      )}
    </div>
  )
}
