import type { RemoteEvent } from './remote'
import { remoteController } from './remote'
import { bluetoothRemote, type BleNotification } from './bluetoothRemote'

/**
 * Turns a raw BLE notification into a RemoteEvent, based on mappings learned
 * in Settings rather than hardcoded per-device parsing. This is what makes
 * the remote "programmable": whatever the DIY board sends when the dial
 * turns or a button is pressed gets captured once, shown to you, and
 * assigned to an action — the app never needs to know the board's protocol
 * in advance.
 */

export type MappedAction = 'pressure_up' | 'pressure_down' | 'loved' | 'flagged'

export interface BleMapping {
  id: string
  /** The raw notification's hex bytes this mapping matches, exactly. */
  hex: string
  label: string
  action: MappedAction
  /** Only meaningful for pressure_up/down: 1 short, 2 medium, 3 long. */
  magnitude: number
}

const STORAGE_KEY = 'liveprac:v1:bleMappings'

function read(): BleMapping[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as BleMapping[]) : []
  } catch {
    return []
  }
}

function write(mappings: BleMapping[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings))
  } catch {
    // Storage unavailable — mappings just won't persist across reloads.
  }
}

let idCounter = 0
function makeId() {
  idCounter += 1
  return `ble_${Date.now()}_${idCounter}`
}

export function getMappings(): BleMapping[] {
  return read()
}

export function saveMapping(input: Omit<BleMapping, 'id'>): BleMapping {
  const mapping: BleMapping = { ...input, id: makeId() }
  write([...read(), mapping])
  return mapping
}

export function deleteMapping(id: string): void {
  write(read().filter((m) => m.id !== id))
}

function toRemoteEvent(mapping: BleMapping): RemoteEvent {
  if (mapping.action === 'loved') return { type: 'press', kind: 'long' }
  if (mapping.action === 'flagged') return { type: 'press', kind: 'single' }
  const sign = mapping.action === 'pressure_up' ? 1 : -1
  return { type: 'dial', delta: sign * mapping.magnitude }
}

let dispatchStarted = false

/** Call once at startup. Idempotent. */
export function startBleDispatch(): void {
  if (dispatchStarted) return
  dispatchStarted = true
  bluetoothRemote.onNotification((note: BleNotification) => {
    const mapping = read().find((m) => m.hex === note.hex)
    if (mapping) remoteController.simulate(toRemoteEvent(mapping))
  })
}

export const ACTION_LABELS: Record<MappedAction, string> = {
  pressure_up: 'More pressure',
  pressure_down: 'Less pressure',
  loved: 'Loved this (long press)',
  flagged: 'Flag (single press)',
}
