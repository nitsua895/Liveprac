import { useEffect, useState } from 'react'
import { bluetoothRemote, type BleNotification, type BleStatus } from '../lib/bluetoothRemote'
import { ACTION_LABELS, deleteMapping, getMappings, saveMapping, type MappedAction } from '../lib/bleMapping'

const STATUS_LABEL: Record<BleStatus, string> = {
  unsupported: 'Not supported here',
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
}

const MAGNITUDE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Short (small nudge)' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Long (big nudge)' },
]

export function BluetoothRemoteCard() {
  const [status, setStatus] = useState<BleStatus>(() => bluetoothRemote.getStatus())
  const [battery, setBattery] = useState<number | null>(() => bluetoothRemote.getBattery())
  const [error, setError] = useState<string | null>(null)
  const [mappings, setMappings] = useState(() => getMappings())
  const [listening, setListening] = useState(false)
  const [captured, setCaptured] = useState<BleNotification | null>(null)
  const [pendingAction, setPendingAction] = useState<MappedAction>('pressure_up')
  const [pendingMagnitude, setPendingMagnitude] = useState(1)

  useEffect(() => {
    const offStatus = bluetoothRemote.onStatusChange(setStatus)
    const offBattery = bluetoothRemote.onBatteryChange(setBattery)
    return () => {
      offStatus()
      offBattery()
    }
  }, [])

  useEffect(() => {
    if (!listening) return
    return bluetoothRemote.onNotification((note) => {
      setCaptured(note)
      setListening(false)
    })
  }, [listening])

  async function connect() {
    setError(null)
    try {
      await bluetoothRemote.requestAndConnect()
    } catch (e) {
      // The user cancelling the device picker is not a real error.
      const message = e instanceof Error ? e.message : String(e)
      if (!message.includes('cancelled') && !message.includes('User cancelled')) setError(message)
    }
  }

  function confirmMapping() {
    if (!captured) return
    const existingLabel = mappings.filter((m) => m.action === pendingAction).length + 1
    saveMapping({
      hex: captured.hex,
      action: pendingAction,
      magnitude: pendingMagnitude,
      label: `${ACTION_LABELS[pendingAction]} #${existingLabel}`,
    })
    setMappings(getMappings())
    setCaptured(null)
  }

  function removeMapping(id: string) {
    deleteMapping(id)
    setMappings(getMappings())
  }

  if (status === 'unsupported') {
    return (
      <div className="surface-card p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-neutral-100">Bluetooth Remote</p>
          <span className="rounded-full border border-neutral-800 px-3 py-0.5 text-xs text-neutral-500">
            Not supported
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          This browser has no Web Bluetooth support — that's true of Safari on iOS/iPadOS specifically
          (an Apple platform limit, not something this app can work around). It works in Chrome or Edge
          on Android or desktop.
        </p>
      </div>
    )
  }

  return (
    <div className="surface-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-neutral-100">Bluetooth Remote</p>
        <span
          className={`rounded-full border px-3 py-0.5 text-xs ${
            status === 'connected'
              ? 'border-accent-500/40 text-accent-300'
              : 'border-neutral-800 text-neutral-500'
          }`}
        >
          {STATUS_LABEL[status]}
          {status === 'connected' && battery !== null ? ` · ${battery}% battery` : ''}
        </span>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        Works with any BLE dial/button hardware — nothing is hardcoded to one device. Connect once,
        then teach the app what each physical action means below.
        {bluetoothRemote.getDeviceName() && status === 'connected'
          ? ` Currently paired: ${bluetoothRemote.getDeviceName()}.`
          : ''}
      </p>

      <div className="flex flex-wrap gap-2">
        {status === 'connected' ? (
          <button
            type="button"
            onClick={() => bluetoothRemote.disconnect()}
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
            Connect remote
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {status === 'connected' && (
        <div className="mt-4 border-t border-neutral-800 pt-4">
          <p className="mb-2 text-sm font-medium text-neutral-300">Programmed controls</p>
          {mappings.length === 0 && (
            <p className="mb-3 text-sm text-neutral-500">
              Nothing taught yet. Press "Learn a control" below, then turn the dial or press the
              button once on the remote.
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
                Captured signal <code className="text-accent-300">{captured.hex}</code>. What does
                this mean?
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
