import { useAppState } from '../state/AppStateContext'

/**
 * Peripheral-vision cue for the therapist. Real gaze detection would need a
 * camera pointed at an undressed client — a trust problem — so acknowledgment
 * is a tap anywhere on the glow banner instead of a look.
 */
export function AmbientGlow() {
  const { ambientCues, dismissAmbientCue } = useAppState()
  const current = ambientCues[0]

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <div
        className={`absolute inset-0 rounded-none ring-[10px] transition-opacity duration-700 ${
          current ? 'opacity-100 animate-pulse-slow ring-amber-500/40' : 'opacity-0 ring-transparent'
        }`}
      />
      {current && (
        <div className="pointer-events-auto absolute left-1/2 top-6 -translate-x-1/2">
          <button
            type="button"
            onClick={() => dismissAmbientCue(current.id)}
            className="rounded-full border border-amber-500/30 bg-neutral-900/90 px-5 py-2 text-sm text-amber-200 shadow-lg shadow-amber-900/20 backdrop-blur"
          >
            {current.message}
            <span className="ml-3 text-amber-400/60">tap to clear</span>
          </button>
        </div>
      )}
    </div>
  )
}
