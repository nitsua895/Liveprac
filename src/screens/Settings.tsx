import { useState } from 'react'
import * as spotify from '../lib/spotify'
import { ACCENT_PREVIEW_COLORS, ACCENT_THEMES, applyAccent, getStoredAccent, type AccentTheme } from '../lib/theme'
import { BluetoothRemoteCard } from '../components/BluetoothRemoteCard'
import { GoogleCalendarCard } from '../components/GoogleCalendarCard'

function IntegrationCard({
  title,
  status,
  detail,
}: {
  title: string
  status: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-neutral-100">{title}</p>
        <span className="rounded-full border border-neutral-800 px-3 py-0.5 text-xs text-neutral-500">
          {status}
        </span>
      </div>
      <p className="text-sm text-neutral-500">{detail}</p>
    </div>
  )
}

function AccentPicker() {
  const [accent, setAccent] = useState<AccentTheme>(() => getStoredAccent())

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <p className="mb-1 text-neutral-100">Accent Color</p>
      <p className="mb-4 text-sm text-neutral-500">
        Applies everywhere (dials, glow, highlights) — try them in the actual treatment room lighting.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACCENT_THEMES.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => {
              applyAccent(theme.value)
              setAccent(theme.value)
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 ${
              accent === theme.value ? 'border-accent-400/60 bg-accent-500/10' : 'border-neutral-800'
            }`}
          >
            <span
              className="h-8 w-8 rounded-full"
              style={{ background: ACCENT_PREVIEW_COLORS[theme.value] }}
            />
            <span className="text-xs text-neutral-400">{theme.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SpotifyCard() {
  const [connected, setConnected] = useState(() => spotify.isConnected())
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    try {
      await spotify.beginAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-neutral-100">Spotify</p>
        <span className="rounded-full border border-neutral-800 px-3 py-0.5 text-xs text-neutral-500">
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Controls whatever device Spotify is already playing on — the music comes out of the room's
        speakers, not the iPad. Liveprac's Spotify app is built in; a Premium account is required
        because Spotify blocks playback control on free accounts.
      </p>

      {connected ? (
        <button
          type="button"
          onClick={() => {
            spotify.disconnect()
            setConnected(false)
          }}
          className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-neutral-950"
        >
          Connect Spotify
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <details className="mt-4 text-sm text-neutral-400">
        <summary>Connection troubleshooting</summary>
        <p className="mt-2">If Spotify reports a redirect mismatch, add this exact Redirect URI to this app in Spotify's developer dashboard, including the final slash:</p>
        <code className="mt-2 block break-all text-accent-200">{spotify.redirectUri()}</code>
        <p className="mt-2">Preview URLs need their own registered redirect. Use the production site to connect your production account.</p>
      </details>
    </div>
  )
}

export function Settings() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-light text-neutral-200">Settings</h1>

      <AccentPicker />

      <BluetoothRemoteCard />
      <GoogleCalendarCard />
      <SpotifyCard />
      <IntegrationCard
        title="ClinicSense / MassageBook"
        status="No public API"
        detail="Neither tool exposes a public integration API. Use 'Copy note for CRM' in the Client Log to paste session summaries into their notes field by hand."
      />

      <p className="text-center text-xs text-neutral-600">build {__BUILD_ID__}</p>
    </div>
  )
}
