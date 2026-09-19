import { useState } from 'react'
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
      <div className="flex gap-3">
        {ACCENT_THEMES.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => {
              applyAccent(theme.value)
              setAccent(theme.value)
            }}
            className={`flex flex-1 flex-col items-center gap-2 rounded-xl border px-3 py-3 ${
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
      <IntegrationCard
        title="Spotify"
        status="Phase 3"
        detail="Playback control via Spotify's Web API is feasible client-side (PKCE flow), not yet connected."
      />
      <IntegrationCard
        title="ClinicSense / MassageBook"
        status="No public API"
        detail="Neither tool exposes a public integration API. Use 'Copy note for CRM' in the Client Log to paste session summaries into their notes field by hand."
      />
    </div>
  )
}
