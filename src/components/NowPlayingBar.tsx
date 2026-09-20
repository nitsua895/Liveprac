import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import * as spotify from '../lib/spotify'

const POLL_MS = 5000

/** Spotify-grade playback controls, restyled to stay calm in the treatment room. */
export function NowPlayingBar({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<spotify.NowPlayingState>(spotify.EMPTY_STATE)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)
  const [connecting, setConnecting] = useState(false)
  const [devices, setDevices] = useState<spotify.SpotifyDevice[]>([])

  const refresh = useCallback(async () => {
    try {
      const [next, availableDevices] = await Promise.all([
        spotify.fetchState(),
        spotify.fetchDevices(),
      ])
      setState(next)
      setDevices(availableDevices)
      setError(next.error)
    } catch {
      setError('Spotify is unreachable. Check your connection; session timing is unaffected.')
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

  // Keep the scrubber moving smoothly between Spotify's five-second updates.
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

  if (!spotify.isConnected()) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-800/80 bg-neutral-900/45 px-4 py-3 text-neutral-600">
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
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }

  const progress = state.durationMs ? (state.progressMs / state.durationMs) * 100 : 0
  const volume = state.volumePercent ?? 0
  const repeatLabel =
    state.repeat === 'track' ? 'Repeat track' : state.repeat === 'context' ? 'Repeat all' : 'Repeat off'
  const volumeHelp = !state.supportsVolume && state.deviceName
    ? `Spotify reports limited volume support for ${state.deviceName}; Liveprac will still try direct control.`
    : null

  function commitVolume(value: string) {
    void run(() => spotify.setVolume(Number(value), state.deviceId))
  }

  function setLocal<K extends keyof spotify.NowPlayingState>(
    key: K,
    value: spotify.NowPlayingState[K],
  ) {
    setState((current) => ({ ...current, [key]: value }))
  }

  function cycleRepeat() {
    const next = state.repeat === 'off' ? 'context' : state.repeat === 'context' ? 'track' : 'off'
    setLocal('repeat', next)
    void run(() => spotify.setRepeat(next))
  }

  return (
    <section className="spotify-player rounded-2xl border border-neutral-800/80 bg-neutral-900/55 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
      <div className="spotify-primary grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4">
        <div className="spotify-album hidden h-12 w-12 overflow-hidden rounded-lg bg-neutral-800 shadow-lg sm:block">
          {state.albumArtUrl ? (
            <img src={state.albumArtUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-neutral-600">
              <Icon name="music" className="h-5 w-5" />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-medium text-neutral-200">
              {state.trackName ?? 'Nothing playing'}
            </p>
            <p className="hidden truncate text-xs text-neutral-500 sm:block">{state.artistName}</p>
          </div>
          <div className="mt-2 grid grid-cols-[2.8rem_minmax(0,1fr)_2.8rem] items-center gap-2">
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

        <div className="flex items-center gap-0 sm:gap-1">
          <PlayerButton label="Previous" onClick={() => void run(spotify.previous)}>
            <Icon name="previous" />
          </PlayerButton>
          <button
            type="button"
            onClick={() => void run(state.isPlaying ? spotify.pause : spotify.play)}
            className="mx-1 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-950 transition hover:scale-105 hover:bg-white active:scale-95"
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={state.isPlaying ? 'pause' : 'play'} className="h-5 w-5" />
          </button>
          <PlayerButton label="Next" onClick={() => void run(spotify.next)}>
            <Icon name="next" />
          </PlayerButton>
          {compact && (
            <PlayerButton
              label={expanded ? 'Hide playback options' : 'Show playback options'}
              onClick={() => setExpanded((value) => !value)}
            >
              <Icon name="sliders" />
            </PlayerButton>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800/70 pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <div className="flex items-center gap-1">
              <PlayerButton
                label={state.shuffle ? 'Shuffle on' : 'Shuffle off'}
                active={state.shuffle}
                onClick={() => {
                  const next = !state.shuffle
                  setLocal('shuffle', next)
                  void run(() => spotify.setShuffle(next))
                }}
              >
                <Icon name="shuffle" />
              </PlayerButton>
              <PlayerButton label={repeatLabel} active={state.repeat !== 'off'} onClick={cycleRepeat}>
                <span className="relative">
                  <Icon name="repeat" />
                  {state.repeat === 'track' && (
                    <span className="absolute -right-1 -top-1 text-[8px] font-bold">1</span>
                  )}
                </span>
              </PlayerButton>
            </div>
            {devices.length > 0 && (
              <label className="ml-1 flex min-w-0 items-center gap-2 text-xs text-neutral-600">
                <span className="sr-only">Spotify output</span>
                <select
                  aria-label="Spotify output"
                  value={state.deviceId ?? ''}
                  onChange={(event) => {
                    const deviceId = event.target.value
                    if (!deviceId || deviceId === state.deviceId) return
                    void run(() => spotify.transferPlayback(deviceId, state.isPlaying))
                  }}
                  className="max-w-44 truncate rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-400"
                >
                  {!state.deviceId && <option value="">Choose output</option>}
                  {devices.filter((device) => device.id && !device.isRestricted).map((device) => (
                    <option key={device.id} value={device.id ?? ''}>
                      {device.name}{device.supportsVolume ? '' : ' · device volume'}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex min-w-40 flex-col items-end gap-1 text-neutral-500">
            <label className="flex items-center gap-2">
              <Icon name={volume === 0 ? 'volumeOff' : 'volume'} className="h-4 w-4 shrink-0" />
              <input
                aria-label="Device volume"
                type="range"
                min={0}
                max={100}
                value={volume}
                disabled={!state.deviceName}
                onChange={(event) => setLocal('volumePercent', Number(event.target.value))}
                onPointerUp={(event) => commitVolume(event.currentTarget.value)}
                onTouchEnd={(event) => commitVolume(event.currentTarget.value)}
                onMouseUp={(event) => commitVolume(event.currentTarget.value)}
                onKeyUp={(event) => commitVolume(event.currentTarget.value)}
                onBlur={(event) => commitVolume(event.currentTarget.value)}
                className="spotify-range w-28"
                style={{ '--range-progress': `${volume}%` } as CSSProperties}
              />
            </label>
            {volumeHelp && <span className="max-w-56 text-right text-[10px] text-neutral-600">{volumeHelp}</span>}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-amber-300/80">{error}</p>}
    </section>
  )
}

function Time({ value }: { value: number }) {
  const seconds = Math.max(0, Math.floor(value / 1000))
  return (
    <span className="font-mono text-[10px] tabular-nums text-neutral-600">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  )
}

function PlayerButton({
  children,
  label,
  active = false,
  onClick,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${
        active ? 'text-accent-300' : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  )
}

type IconName =
  | 'spotify'
  | 'music'
  | 'previous'
  | 'next'
  | 'play'
  | 'pause'
  | 'shuffle'
  | 'repeat'
  | 'volume'
  | 'volumeOff'
  | 'sliders'

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'spotify')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M7.5 9.2c3.1-1 6.7-.7 9.2.7M8.2 12.2c2.5-.7 5.5-.5 7.7.6M8.9 15c2-.5 4.3-.3 6.1.5" />
      </svg>
    )
  if (name === 'music')
    return (
      <svg {...common}>
        <path d="M9 18V6l10-2v12M9 10l10-2" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </svg>
    )
  if (name === 'previous')
    return (
      <svg {...common}>
        <path d="M18 6 9 12l9 6V6ZM5 6h2v12H5z" fill="currentColor" stroke="none" />
      </svg>
    )
  if (name === 'next')
    return (
      <svg {...common}>
        <path d="m6 6 9 6-9 6V6Zm11 0h2v12h-2z" fill="currentColor" stroke="none" />
      </svg>
    )
  if (name === 'play')
    return (
      <svg {...common}>
        <path d="m8.5 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />
      </svg>
    )
  if (name === 'pause')
    return (
      <svg {...common}>
        <path d="M8 6h3v12H8zM14 6h3v12h-3z" fill="currentColor" stroke="none" />
      </svg>
    )
  if (name === 'shuffle')
    return (
      <svg {...common}>
        <path d="M16 3h5v5M4 6h2.5c5 0 6 12 11 12H21M21 16v5h-5M4 18h2.5c1.6 0 2.8-1.2 3.9-2.8M14 7.2C15 6.5 16.1 6 17.5 6H21" />
      </svg>
    )
  if (name === 'repeat')
    return (
      <svg {...common}>
        <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
      </svg>
    )
  if (name === 'volume')
    return (
      <svg {...common}>
        <path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
      </svg>
    )
  if (name === 'volumeOff')
    return (
      <svg {...common}>
        <path d="M11 5 6 9H3v6h3l5 4V5ZM16 10l5 5M21 10l-5 5" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  )
}
