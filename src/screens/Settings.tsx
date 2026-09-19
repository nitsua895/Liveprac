import { useState } from 'react'
import * as spotify from '../lib/spotify'
import { ACCENT_PREVIEW_COLORS, ACCENT_THEMES, applyAccent, getStoredAccent, type AccentTheme } from '../lib/theme'

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
      <div className="mb-1 flex items-center justify-between">
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
      <div className="grid grid-cols-3 gap-3">
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
  const [clientId, setClientIdValue] = useState(() => spotify.getClientId())
  const [connected, setConnected] = useState(() => spotify.isConnected())
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    try {
      spotify.setClientId(clientId)
      await spotify.beginAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-neutral-100">Spotify</p>
        <span className="rounded-full border border-neutral-800 px-3 py-0.5 text-xs text-neutral-500">
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Controls whatever device Spotify is already playing on — the music comes out of the room's
        speakers, not the iPad. Needs a Spotify app registered at developer.spotify.com with{' '}
        <code className="text-neutral-400">{spotify.redirectUri()}</code> added as a redirect URI,
        and a Premium account (Spotify blocks playback control on free accounts).
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
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={clientId}
            onChange={(e) => setClientIdValue(e.target.value)}
            placeholder="Spotify Client ID"
            className="min-w-64 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-accent-500/50"
          />
          <button
            type="button"
            disabled={!clientId.trim()}
            onClick={() => void connect()}
            className="rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
          >
            Connect
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export function Settings() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-light text-neutral-200">Settings</h1>

      <AccentPicker />

      <IntegrationCard
        title="Bluetooth Remote"
        status="Phase 2"
        detail="iOS Safari can't talk to Bluetooth hardware directly. Pairing needs this app wrapped in a native shell (Capacitor + BLE plugin) once the dial/button hardware is picked."
      />
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
