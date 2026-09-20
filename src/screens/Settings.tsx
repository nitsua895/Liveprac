import { useState } from 'react'
import * as spotify from '../lib/spotify'
import { exportData, resetAllData } from '../lib/backup'
import { hexToHsl, hslToHex } from '../lib/color'
import { getCueSoundMode, previewCueSound, previewTone, setCueSoundMode, type CueSoundMode } from '../lib/cueSound'
import { playSessionEndChime, stopSessionEndChime } from '../lib/chime'
import {
  SOUND_SLOTS,
  SOUND_SLOT_LABELS,
  clearCustomSound,
  getVolume,
  hasCustomSound,
  setCustomSound,
  setVolume,
  type SoundSlot,
} from '../lib/soundSlots'
import {
  DEFAULT_CUE_COLORS,
  DEFAULT_CUE_LABELS,
  TONE_LABELS,
  getCueColor,
  getCueLabel,
  resetCueColor,
  resetCueLabel,
  setCueColor,
  setCueLabel,
} from '../lib/cueLabels'
import {
  ACCENT_PREVIEW_COLORS,
  ACCENT_THEMES,
  applyAccent,
  applyCustomAccent,
  customAccentPreview,
  getCustomHue,
  getStoredAccent,
  type AccentTheme,
} from '../lib/theme'
import { VISIBILITY_KEYS, VISIBILITY_LABELS, isVisible, setVisible, type VisibilityKey } from '../lib/visibility'
import { BluetoothRemoteCard } from '../components/BluetoothRemoteCard'
import { HueWheel } from '../components/HueWheel'
import { GameControllerCard } from '../components/GameControllerCard'
import { GoogleCalendarCard } from '../components/GoogleCalendarCard'
import { useAppState } from '../state/AppStateContext'
import type { CueTone, PreferenceEventType } from '../types'

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
    <div className="surface-card p-5">
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

const CUSTOM_SWATCH_RAINBOW =
  'conic-gradient(from 90deg, hsl(0 75% 58%), hsl(60 75% 58%), hsl(120 75% 58%), hsl(180 75% 58%), hsl(240 75% 58%), hsl(300 75% 58%), hsl(360 75% 58%))'

function AccentPicker() {
  const [accent, setAccent] = useState<AccentTheme>(() => getStoredAccent())
  const [customHue, setCustomHue] = useState(() => getCustomHue() ?? 262)
  const [wheelOpen, setWheelOpen] = useState(false)
  const hasCustom = getCustomHue() !== null

  return (
    <div className="surface-card p-5">
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
              setWheelOpen(false)
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

        <button
          type="button"
          onClick={() => setWheelOpen((v) => !v)}
          className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 ${
            accent === 'custom' ? 'border-accent-400/60 bg-accent-500/10' : 'border-neutral-800'
          }`}
        >
          {/* Deliberately not a solid swatch until a custom hue is actually
              active — a purple-filled circle here just reads as a second,
              redundant "Deep Violet" option. */}
          {accent === 'custom' && hasCustom ? (
            <span className="h-8 w-8 rounded-full" style={{ background: customAccentPreview(customHue) }} />
          ) : (
            <span className="h-8 w-8 rounded-full p-[3px]" style={{ background: CUSTOM_SWATCH_RAINBOW }}>
              <span className="block h-full w-full rounded-full bg-neutral-950" />
            </span>
          )}
          <span className="text-xs text-neutral-400">Custom…</span>
        </button>
      </div>

      {wheelOpen && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-neutral-800 pt-4">
          <HueWheel
            hue={customHue}
            onChange={(hue) => {
              setCustomHue(hue)
              applyCustomAccent(hue)
              setAccent('custom')
            }}
            label="Accent hue"
          />
          <p className="text-center text-xs text-neutral-600">
            Rotate to choose a hue — brightness and saturation stay fixed to match the presets.
          </p>
        </div>
      )}
    </div>
  )
}

const SOUND_OPTIONS: Array<{ value: CueSoundMode; label: string; detail: string }> = [
  { value: 'transitions', label: 'Transitions', detail: 'Recommended' },
  { value: 'off', label: 'Off', detail: 'Visual only' },
  { value: 'all', label: 'All cues', detail: 'Includes feedback' },
]

function CueSoundCard() {
  const [mode, setMode] = useState<CueSoundMode>(() => getCueSoundMode())

  function choose(next: CueSoundMode) {
    setCueSoundMode(next)
    setMode(next)
    if (next !== 'off') void previewCueSound(next)
  }

  return (
    <div className="surface-card p-5">
      <p className="mb-1 text-neutral-100">Session cue sound</p>
      <p className="mb-4 text-sm text-neutral-500">
        The edge glow always appears. Transitions adds a very quiet two-note cue; client feedback stays private and visual.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SOUND_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={mode === option.value}
            className={`rounded-xl border px-2 py-3 text-center ${
              mode === option.value
                ? 'border-accent-400/60 bg-accent-500/10 text-accent-200'
                : 'border-neutral-800 text-neutral-400'
            }`}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block text-[11px] text-neutral-600">{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SoundRow({ slot }: { slot: SoundSlot }) {
  const [volume, setVolumeState] = useState(() => getVolume(slot))
  const [custom, setCustom] = useState(() => hasCustomSound(slot))
  const [uploading, setUploading] = useState(false)

  function play() {
    if (slot === 'sessionEnd') {
      void playSessionEndChime()
      setTimeout(stopSessionEndChime, 4000)
    } else {
      void previewTone(slot)
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-300">{SOUND_SLOT_LABELS[slot]}</span>
        {custom && <span className="text-xs text-accent-300">Custom sound</span>}
        <button
          type="button"
          onClick={play}
          className="ml-auto rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300"
        >
          Preview
        </button>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => {
            const next = Number(e.target.value)
            setVolumeState(next)
            setVolume(slot, next)
          }}
          className="flex-1"
          aria-label={`${SOUND_SLOT_LABELS[slot]} volume`}
        />
        <span className="w-10 text-right text-xs tabular-nums text-neutral-500">{volume}%</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className="text-xs text-accent-400/80 hover:text-accent-300">
          {uploading ? 'Uploading…' : custom ? 'Replace sound' : 'Upload sound'}
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setUploading(true)
              try {
                await setCustomSound(slot, file)
                setCustom(true)
              } finally {
                setUploading(false)
              }
            }}
          />
        </label>
        {custom && (
          <button
            type="button"
            onClick={async () => {
              await clearCustomSound(slot)
              setCustom(false)
            }}
            className="text-xs text-neutral-600"
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  )
}

function SoundsCard() {
  return (
    <div className="surface-card p-5">
      <p className="mb-1 text-neutral-100">Sounds</p>
      <p className="mb-4 text-sm text-neutral-500">
        Swap in your own MP3 or WAV per cue, and set its volume independently. Preview plays it at
        that exact volume right now, regardless of the cue-sound mode above.
      </p>
      <div className="flex flex-col gap-3">
        {SOUND_SLOTS.map((slot) => (
          <SoundRow key={slot} slot={slot} />
        ))}
      </div>
    </div>
  )
}

const PREFERENCE_TYPES: PreferenceEventType[] = ['pressure_up', 'pressure_down', 'loved', 'flagged']
const TONES: CueTone[] = ['pressure', 'love', 'flag', 'next']
const TONE_FOR_TYPE: Record<PreferenceEventType, CueTone> = {
  pressure_up: 'pressure',
  pressure_down: 'pressure',
  loved: 'love',
  flagged: 'flag',
}

// Vivid on purpose — these are meant to catch attention from across a room,
// unlike the accent theme's muted 36%. Same single-hue-wheel experience,
// deliberately different fixed saturation/lightness for a different job.
const CUE_SATURATION = 68
const CUE_LIGHTNESS = 52

function NotificationCuesCard() {
  const { pushAmbientCue } = useAppState()
  const [labels, setLabels] = useState<Record<PreferenceEventType, string>>(
    () => Object.fromEntries(PREFERENCE_TYPES.map((t) => [t, getCueLabel(t)])) as Record<PreferenceEventType, string>,
  )
  const [colors, setColors] = useState<Record<CueTone, string>>(
    () => Object.fromEntries(TONES.map((t) => [t, getCueColor(t) ?? DEFAULT_CUE_COLORS[t]])) as Record<CueTone, string>,
  )
  const [openTone, setOpenTone] = useState<CueTone | null>(null)

  function preview(tone: CueTone, message: string) {
    // Visual glow through the real pipeline, plus a guaranteed sound test —
    // testing a sound shouldn't silently no-op just because cue sound mode
    // happens to be off right now.
    pushAmbientCue({ kind: tone === 'next' ? 'timer' : 'preference', tone, message })
    void previewTone(tone)
  }

  function setToneHue(tone: CueTone, hue: number) {
    const hex = hslToHex(hue, CUE_SATURATION, CUE_LIGHTNESS)
    setColors((prev) => ({ ...prev, [tone]: hex }))
    setCueColor(tone, hex)
  }

  return (
    <div className="surface-card p-5">
      <p className="mb-1 text-neutral-100">Notification Cues</p>
      <p className="mb-4 text-sm text-neutral-500">
        Each glow's color and wording — Preview shows (and sounds) it exactly as it appears mid-session.
      </p>
      <div className="flex flex-col gap-3">
        {TONES.map((tone) => (
          <div key={tone} className="rounded-xl border border-neutral-800 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenTone((prev) => (prev === tone ? null : tone))}
                className="h-8 w-8 shrink-0 rounded-full border border-white/10"
                style={{ background: colors[tone] }}
                aria-label={`${TONE_LABELS[tone]} color`}
              />
              <span className="text-sm text-neutral-300">{TONE_LABELS[tone]}</span>
              {colors[tone] !== DEFAULT_CUE_COLORS[tone] && (
                <button
                  type="button"
                  onClick={() => {
                    resetCueColor(tone)
                    setColors((prev) => ({ ...prev, [tone]: DEFAULT_CUE_COLORS[tone] }))
                  }}
                  className="text-xs text-neutral-600"
                >
                  Reset color
                </button>
              )}
              <button
                type="button"
                onClick={() => preview(tone, tone === 'next' ? 'Coming up: next section' : labels[PREFERENCE_TYPES.find((t) => TONE_FOR_TYPE[t] === tone)!])}
                className="ml-auto rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300"
              >
                Preview
              </button>
            </div>

            {openTone === tone && (
              <div className="mt-3 flex flex-col items-center gap-2 border-t border-neutral-800 pt-3">
                <HueWheel
                  hue={hexToHsl(colors[tone]).h}
                  onChange={(hue) => setToneHue(tone, hue)}
                  size={140}
                  saturation={CUE_SATURATION}
                  lightness={CUE_LIGHTNESS}
                  label={`${TONE_LABELS[tone]} hue`}
                />
              </div>
            )}

            {tone === 'next' ? (
              <p className="mt-2 text-xs text-neutral-600">
                Section-change wording includes the section name, so only the color is customizable here.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {PREFERENCE_TYPES.filter((type) => TONE_FOR_TYPE[type] === tone).map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <input
                      value={labels[type]}
                      onChange={(e) => {
                        setLabels((prev) => ({ ...prev, [type]: e.target.value }))
                        setCueLabel(type, e.target.value)
                      }}
                      className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-accent-500/50"
                    />
                    {labels[type] !== DEFAULT_CUE_LABELS[type] && (
                      <button
                        type="button"
                        onClick={() => {
                          resetCueLabel(type)
                          setLabels((prev) => ({ ...prev, [type]: DEFAULT_CUE_LABELS[type] }))
                        }}
                        className="text-xs text-neutral-600"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
    <div className="surface-card p-5">
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
          className="primary-action"
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

function HomeScreenCard() {
  const [visibility, setVisibility] = useState<Record<VisibilityKey, boolean>>(
    () => Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, isVisible(k)])) as Record<VisibilityKey, boolean>,
  )

  return (
    <div className="surface-card p-5">
      <p className="mb-1 text-neutral-100">Home Screen</p>
      <p className="mb-4 text-sm text-neutral-500">
        Hide whatever you don't use — nothing here deletes data or disconnects anything, it just
        stops showing up.
      </p>
      <div className="flex flex-col gap-2">
        {VISIBILITY_KEYS.map((key) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 px-3 py-2.5"
          >
            <span>
              <span className="block text-sm text-neutral-200">{VISIBILITY_LABELS[key].label}</span>
              <span className="block text-xs text-neutral-600">{VISIBILITY_LABELS[key].detail}</span>
            </span>
            <input
              type="checkbox"
              checked={visibility[key]}
              onChange={(e) => {
                setVisible(key, e.target.checked)
                setVisibility((prev) => ({ ...prev, [key]: e.target.checked }))
              }}
              className="h-5 w-5 accent-accent-500"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function DataCard() {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="surface-card p-5">
      <p className="mb-1 text-neutral-100">Your Data</p>
      <p className="mb-4 text-sm text-neutral-500">
        Clients, routines, session history, and notes all live only in this browser, on this device
        — nothing is backed up automatically. Clearing browser data, switching devices, or
        reinstalling loses it all. Download a backup now and then; a future version may add Google
        account sync for automatic cloud backup.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportData}
          className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
        >
          Download backup
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-red-900/60 px-4 py-2 text-sm text-red-400/80"
        >
          Reset all data
        </button>
      </div>
      {confirming && (
        <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 p-3">
          <p className="mb-2 text-sm text-red-300">
            This permanently deletes every client, routine, and session note on this device. This
            can't be undone — download a backup first if you're not sure.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetAllData}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white"
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full border border-neutral-800 px-4 py-1.5 text-sm text-neutral-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Settings() {
  return (
    <div className="page-stack gap-4">
      <header className="mb-1">
        <h1 className="page-title">Settings</h1>
      </header>

      <AccentPicker />

      <NotificationCuesCard />

      <CueSoundCard />

      <SoundsCard />

      <BluetoothRemoteCard />
      <GameControllerCard />
      <GoogleCalendarCard />
      <SpotifyCard />
      <IntegrationCard
        title="ClinicSense / MassageBook"
        status="No public API"
        detail="Neither tool exposes a public integration API. Use 'Copy note for CRM' in the Client Log to paste session summaries into their notes field by hand."
      />

      <HomeScreenCard />

      <DataCard />

      <p className="text-center text-xs text-neutral-600">build {__BUILD_ID__}</p>
    </div>
  )
}
