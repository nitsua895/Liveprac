import { useCallback, useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import * as spotify from '../lib/spotify'

const POLL_MS = 5000

/** Persistent, single-row music chrome. Spotify handles advanced controls;
 * Liveprac keeps only the actions useful with hands occupied. */
export function NowPlayingBar() {
  const [state, setState] = useState<spotify.NowPlayingState>(spotify.EMPTY_STATE)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [saved, setSaved] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const next = await spotify.fetchState()
      setState(next)
      setError(next.error)
    } catch {
      setError('Spotify is unreachable. Session timing is unaffected.')
    }
  }, [])

  useEffect(() => {
    if (!spotify.isConnected()) return
    const initial = setTimeout(() => void refresh(), 0)
    const interval = setInterval(() => void refresh(), POLL_MS)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [refresh])

  useEffect(() => {
    const request = state.trackUri ? spotify.isTrackSaved(state.trackUri) : Promise.resolve(false)
    void request.then(setSaved)
  }, [state.trackUri])

  useEffect(() => {
    if (!state.isPlaying || !state.durationMs) return
    const interval = setInterval(() => {
      setState((current) => ({
        ...current,
        progressMs: Math.min(current.durationMs, current.progressMs + 1000),
      }))
    }, 1000)
    return () => clearInterval(interval)
  }, [state.isPlaying, state.durationMs])

  async function run(action: () => Promise<string | null>) {
    try {
      const message = await action()
      setError(message)
      if (!message) setTimeout(() => void refresh(), 250)
    } catch {
      setError('Spotify command failed. Check your connection and try again.')
    }
  }

  function setLocal<K extends keyof spotify.NowPlayingState>(key: K, value: spotify.NowPlayingState[K]) {
    setState((current) => ({ ...current, [key]: value }))
  }

  function openFromSurface(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button, a, input, select')) return
    spotify.openSpotify()
  }

  if (!spotify.isConnected()) {
    return (
      <section className="spotify-player spotify-player-empty">
        <Icon name="spotify" className="h-5 w-5" />
        <span className="text-xs font-medium uppercase tracking-[0.14em]">Spotify</span>
        <button
          type="button"
          disabled={connecting}
          onClick={() => {
            setConnecting(true)
            void spotify.beginAuth().catch((reason: unknown) => {
              setConnecting(false)
              setError(reason instanceof Error ? reason.message : String(reason))
            })
          }}
          className="text-sm text-neutral-300 transition hover:text-white disabled:opacity-50"
        >
          {connecting ? 'Connecting…' : 'Connect account'}
        </button>
        {error && <span className="spotify-error-toast">{error}</span>}
      </section>
    )
  }

  const progress = state.durationMs ? (state.progressMs / state.durationMs) * 100 : 0

  return (
    <section
      className={`spotify-player ${state.trackUri ? 'has-track' : ''}`}
      onClick={openFromSurface}
      title="Open Spotify"
    >
      <button
        type="button"
        className="spotify-album"
        onClick={spotify.openSpotify}
        aria-label="Open Spotify"
      >
        {state.albumArtUrl ? <img src={state.albumArtUrl} alt="" /> : <Icon name="music" className="h-5 w-5" />}
      </button>

      <div className="spotify-track min-w-0">
        <button
          type="button"
          onClick={spotify.openSpotify}
          className="flex max-w-full items-baseline gap-2 text-left"
        >
          <span className="truncate text-sm font-medium text-neutral-200">{state.trackName ?? 'Nothing playing'}</span>
          <span className="hidden truncate text-xs text-neutral-500 sm:block">{state.artistName}</span>
        </button>
        <div className="mt-1 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1.5">
          <Time value={state.progressMs} />
          <input
            aria-label="Track position"
            type="range"
            min={0}
            max={Math.max(1, state.durationMs)}
            value={state.progressMs}
            disabled={!state.durationMs}
            onChange={(event) => setLocal('progressMs', Number(event.target.value))}
            onPointerUp={() => void run(() => spotify.seek(state.progressMs))}
            onKeyUp={() => void run(() => spotify.seek(state.progressMs))}
            className="spotify-range"
            style={{ '--range-progress': `${progress}%` } as CSSProperties}
          />
          <Time value={state.durationMs} />
        </div>
      </div>

      <div className="spotify-controls">
        <PlayerButton
          label={saved ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          active={saved}
          onClick={() => {
            const next = !saved
            setSaved(next)
            void run(async () => {
              const message = await spotify.setTrackSaved(state.trackUri, next)
              if (message) setSaved(!next)
              return message
            })
          }}
        >
          <Icon name="heart" className="h-[18px] w-[18px]" filled={saved} />
        </PlayerButton>
        <PlayerButton label="Previous" onClick={() => void run(spotify.previous)}>
          <Icon name="previous" />
        </PlayerButton>
        <button type="button" onClick={() => void run(state.isPlaying ? spotify.pause : spotify.play)} className="spotify-play" aria-label={state.isPlaying ? 'Pause' : 'Play'}>
          <Icon name={state.isPlaying ? 'pause' : 'play'} className="h-5 w-5" />
        </button>
        <PlayerButton label="Next" onClick={() => void run(spotify.next)}>
          <Icon name="next" />
        </PlayerButton>
      </div>

      {error && <span className="spotify-error-toast" role="status">{error}</span>}
    </section>
  )
}

function Time({ value }: { value: number }) {
  const seconds = Math.max(0, Math.floor(value / 1000))
  return <span className="font-mono text-[10px] tabular-nums text-neutral-600">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
}

function PlayerButton({ children, label, active = false, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={`spotify-control ${active ? 'active' : ''}`}>{children}</button>
}

type IconName = 'spotify' | 'music' | 'previous' | 'next' | 'play' | 'pause' | 'heart'

function Icon({ name, className = 'h-5 w-5', filled = false }: { name: IconName; className?: string; filled?: boolean }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'spotify') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M7.5 9.2c3.1-1 6.7-.7 9.2.7M8.2 12.2c2.5-.7 5.5-.5 7.7.6M8.9 15c2-.5 4.3-.3 6.1.5" /></svg>
  if (name === 'music') return <svg {...common}><path d="M9 18V6l10-2v12M9 10l10-2" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>
  if (name === 'previous') return <svg {...common}><path d="M18 6 9 12l9 6V6ZM5 6h2v12H5z" fill="currentColor" stroke="none" /></svg>
  if (name === 'next') return <svg {...common}><path d="m6 6 9 6-9 6V6Zm11 0h2v12h-2z" fill="currentColor" stroke="none" /></svg>
  if (name === 'play') return <svg {...common}><path d="m8.5 6 9 6-9 6V6Z" fill="currentColor" stroke="none" /></svg>
  if (name === 'pause') return <svg {...common}><path d="M8 6h3v12H8zM14 6h3v12h-3z" fill="currentColor" stroke="none" /></svg>
  return <svg {...common} fill={filled ? 'currentColor' : 'none'}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
}
