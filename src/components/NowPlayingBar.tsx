import { nowPlayingController } from '../lib/spotify'

/**
 * Static, low-contrast by design — this shares the screen with the ambient
 * glow cues and must never compete with them for attention. Phase 3: wire
 * to the real Spotify controller.
 */
export function NowPlayingBar() {
  const state = nowPlayingController.getState()

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-neutral-500">
      <span className="text-xs uppercase tracking-wide">Music</span>
      <span className="text-sm">
        {state.trackName ? `${state.trackName} — ${state.artistName}` : 'Not connected'}
      </span>
      <span className="ml-auto text-xs text-neutral-600">Phase 3</span>
    </div>
  )
}
