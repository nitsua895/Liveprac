import { useEffect, useState } from 'react'
import { isGamepadSupported } from '../lib/gamepad'
import {
  deleteMapping,
  getMappings,
  saveMapping,
  startLearning,
  type GamepadCapture,
  type NewGamepadMapping,
} from '../lib/gamepadMapping'
import { ACTION_LABELS, type MappedAction } from '../lib/bleMapping'

const MAGNITUDE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Short (small nudge)' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Long (big nudge)' },
]

function describeCapture(capture: GamepadCapture): string {
  return capture.kind === 'button'
    ? `Button ${capture.index}`
    : `Axis ${capture.index} (${capture.direction > 0 ? '+' : '−'})`
}

/**
 * For hardware that pairs through iOS Settings → Bluetooth as an HID
 * accessory (game controllers, and BLE dials/remotes that identify the same
 * way) rather than being visible to Web Bluetooth — see gamepad.ts for why.
 * Same programmable "learn a control" flow as the Bluetooth Remote card,
 * just against Gamepad API axes/buttons instead of raw BLE bytes.
 */
export function GameControllerCard() {
  const [connected, setConnected] = useState(() => Boolean(navigator.getGamepads?.().find((p) => p?.connected)))
  const [mappings, setMappings] = useState(() => getMappings())
  const [listening, setListening] = useState(false)
  const [captured, setCaptured] = useState<GamepadCapture | null>(null)
  const [pendingAction, setPendingAction] = useState<MappedAction>('pressure_up')
  const [pendingMagnitude, setPendingMagnitude] = useState(1)

  useEffect(() => {
    function refresh() {
      setConnected(Boolean(navigator.getGamepads().find((p) => p?.connected)))
    }
    window.addEventListener('gamepadconnected', refresh)
    window.addEventListener('gamepaddisconnected', refresh)
    // iOS Safari's connect/disconnect events are inconsistent across
    // versions and controllers — a poll fallback catches what they miss.
    const interval = setInterval(refresh, 1000)
    return () => {
      window.removeEventListener('gamepadconnected', refresh)
      window.removeEventListener('gamepaddisconnected', refresh)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!listening) return
    return startLearning((capture) => {
      setCaptured(capture)
      setListening(false)
    })
  }, [listening])

  function confirmMapping() {
    if (!captured) return
    const existingLabel = mappings.filter((m) => m.action === pendingAction).length + 1
    const label = `${ACTION_LABELS[pendingAction]} #${existingLabel}`
    const mapping: NewGamepadMapping =
      captured.kind === 'button'
        ? { kind: 'button', index: captured.index, action: pendingAction, magnitude: pendingMagnitude, label }
        : { kind: 'axis', index: captured.index, direction: captured.direction, action: pendingAction, magnitude: pendingMagnitude, label }
    saveMapping(mapping)
    setMappings(getMappings())
    setCaptured(null)
  }

  function removeMapping(id: string) {
    deleteMapping(id)
    setMappings(getMappings())
  }

  if (!isGamepadSupported()) return null

  return (
    <div className="surface-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-neutral-100">Game Controller</p>
        <span
          className={`rounded-full border px-3 py-0.5 text-xs ${
            connected ? 'border-accent-500/40 text-accent-300' : 'border-neutral-800 text-neutral-500'
          }`}
        >
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        For hardware that pairs through iPad Settings → Bluetooth rather than through this app —
        game controllers, and some BLE dials/remotes that identify the same way to the browser.
        Pair it in iOS Settings first, then teach the app what each control means below.
      </p>

      {!connected && (
        <p className="text-sm text-neutral-600">
          Waiting for a controller — pair it in iPad Settings → Bluetooth, then this updates
          automatically.
        </p>
      )}

      {connected && (
        <div className="border-t border-neutral-800 pt-4">
          <p className="mb-2 text-sm font-medium text-neutral-300">Programmed controls</p>
          {mappings.length === 0 && (
            <p className="mb-3 text-sm text-neutral-500">
              Nothing taught yet. Press "Learn a control" below, then turn the dial or press the
              button once.
            </p>
          )}
          <ul className="mb-3 flex flex-col gap-1.5">
            {mappings.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm"
              >
                <span className="text-neutral-300">{m.label}</span>
                <button type="button" onClick={() => removeMapping(m.id)} className="text-red-400/80">
                  Remove
                </button>
              </li>
            ))}
          </ul>

          {captured ? (
            <div className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-3">
              <p className="mb-2 text-sm text-neutral-300">
                Captured <code className="text-accent-300">{describeCapture(captured)}</code>. What
                does this mean?
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                {(Object.keys(ACTION_LABELS) as MappedAction[]).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setPendingAction(action)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      pendingAction === action
                        ? 'border-accent-400/60 bg-accent-500/15 text-accent-200'
                        : 'border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
              {(pendingAction === 'pressure_up' || pendingAction === 'pressure_down') && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {MAGNITUDE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPendingMagnitude(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        pendingMagnitude === opt.value
                          ? 'border-accent-400/60 bg-accent-500/15 text-accent-200'
                          : 'border-neutral-800 text-neutral-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmMapping}
                  className="rounded-full bg-accent-500 px-4 py-1.5 text-sm font-medium text-neutral-950"
                >
                  Save mapping
                </button>
                <button
                  type="button"
                  onClick={() => setCaptured(null)}
                  className="rounded-full border border-neutral-800 px-4 py-1.5 text-sm text-neutral-400"
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setListening(true)}
              disabled={listening}
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300 disabled:opacity-50"
            >
              {listening ? 'Listening — operate the control now…' : 'Learn a control'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
