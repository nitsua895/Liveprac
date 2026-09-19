import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as spotify from '../lib/spotify'

const POLL_MS = 5000

/**
 * Deliberately low-contrast and static: it shares a screen with the ambient
 * cues and must never compete with them for attention.
 */
export function NowPlayingBar({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<spotify.NowPlayingState>(spotify.EMPTY_STATE)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setState(await spotify.fetchState())
  }, [])

  useEffect(() => {
    if (!spotify.isConnected()) return
    void refresh()
    const interval = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  async function run(action: () => Promise<string | null>) {
    const message = await action()
    setError(message)
    if (!message) setTimeout(() => void refresh(), 300)
  }

  if (!spotify.isConnected()) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-neutral-600">
        <span className="text-xs uppercase tracking-wide">Music</span>
        <Link to="/settings" className="text-sm text-neutral-500 underline-offset-2 hover:underline">
          Connect Spotify
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void run(spotify.previous)}
          className="px-1.5 text-lg text-neutral-500"
          aria-label="Previous track"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={() => void run(state.isPlaying ? spotify.pause : spotify.play)}
          className="px-1.5 text-xl text-neutral-300"
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
        >
          {state.isPlaying ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={() => void run(spotify.next)}
          className="px-1.5 text-lg text-neutral-500"
          aria-label="Next track"
        >
          ⏭
        </button>
      </div>

      <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">
        {error ?? (state.trackName ? `${state.trackName} — ${state.artistName}` : 'Nothing playing')}
      </span>

      {!compact && state.volumePercent !== null && (
        <label className="flex items-center gap-2 text-neutral-600">
          <span className="text-xs uppercase tracking-wide">Vol</span>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={state.volumePercent}
            onChange={(e) => void run(() => spotify.setVolume(Number(e.target.value)))}
            className="w-28 accent-neutral-500"
          />
        </label>
      )}
    </div>
  )
}
