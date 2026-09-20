import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bluetoothRemote, type BleStatus } from '../lib/bluetoothRemote'

/**
 * The pre-session check: a glance at whether the remote is connected and how
 * much battery it has left, before starting with a client. Doesn't block
 * starting a session without it — the on-screen test controls still work as
 * a fallback — it's informational, not a gate.
 */
export function RemoteStatusPill() {
  const [status, setStatus] = useState<BleStatus>(() => bluetoothRemote.getStatus())
  const [battery, setBattery] = useState<number | null>(() => bluetoothRemote.getBattery())

  useEffect(() => {
    const offStatus = bluetoothRemote.onStatusChange(setStatus)
    const offBattery = bluetoothRemote.onBatteryChange(setBattery)
    return () => {
      offStatus()
      offBattery()
    }
  }, [])

  if (status === 'unsupported') return null

  const low = battery !== null && battery <= 20
  const connected = status === 'connected'

  return (
    <Link
      to="/settings"
      className="surface-card surface-card-interactive flex items-center gap-2 px-3 py-2 text-sm"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? 'bg-accent-400' : status === 'reconnecting' ? 'bg-orange-400' : 'bg-neutral-700'
        }`}
      />
      <span className="text-neutral-400">
        Remote: {connected ? 'connected' : status === 'reconnecting' ? 'reconnecting…' : 'not connected'}
      </span>
      {connected && battery !== null && (
        <span className={low ? 'text-red-400' : 'text-neutral-500'}>· {battery}% battery</span>
      )}
    </Link>
  )
}
