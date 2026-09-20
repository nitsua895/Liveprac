import { remoteController } from './remote'
import { toRemoteEvent, type MappedAction } from './bleMapping'
import { isGamepadSupported } from './gamepad'

/**
 * Programmable Gamepad-API mapping — the same idea as bleMapping.ts, for
 * hardware that shows up through the Gamepad API instead of Web Bluetooth.
 * That's most BLE dials/remotes on iOS: Safari has no Web Bluetooth at all,
 * but a device paired in iOS Settings → Bluetooth as a standard HID
 * accessory (game controller, presenter remote, this pressure pad) is often
 * visible to the page as a "gamepad" instead. Nothing here is hardcoded to
 * one axis/button index — each physical control is learned once in Settings
 * and assigned an action, same flow as the BLE card.
 */

interface MappingCommon {
  id: string
  action: MappedAction
  /** Only meaningful for pressure_up/down: 1 short, 2 medium, 3 long. */
  magnitude: number
  label: string
}

export type GamepadMapping =
  | (MappingCommon & { kind: 'button'; index: number })
  | (MappingCommon & { kind: 'axis'; index: number; direction: 1 | -1 })

export type GamepadCapture =
  | { kind: 'button'; index: number }
  | { kind: 'axis'; index: number; direction: 1 | -1 }

// Plain Omit<Union, K> isn't distributive and collapses the discriminant,
// which is exactly wrong for a type keyed on `kind` like this one.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
export type NewGamepadMapping = DistributiveOmit<GamepadMapping, 'id'>

const STORAGE_KEY = 'liveprac:v1:gamepadMappings'
// Assumes a spring-centered axis (sticks, and most "jog"/tilt dials that
// snap back after a nudge): deflect past this to fire, return below the
// lower value to re-arm. A dial that stays wherever it's turned (no
// self-centering) won't re-fire with this model — flag that if it happens.
const AXIS_FIRE_THRESHOLD = 0.5
const AXIS_RESET_THRESHOLD = 0.25

let idCounter = 0
function makeId() {
  idCounter += 1
  return `pad_${Date.now()}_${idCounter}`
}

function read(): GamepadMapping[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as GamepadMapping[]) : []
  } catch {
    return []
  }
}

function write(mappings: GamepadMapping[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings))
  } catch {
    // Storage unavailable — mappings just won't persist across reloads.
  }
}

export function getMappings(): GamepadMapping[] {
  return read()
}

export function saveMapping(input: NewGamepadMapping): GamepadMapping {
  const mapping: GamepadMapping = { ...input, id: makeId() }
  write([...read(), mapping])
  return mapping
}

export function deleteMapping(id: string): void {
  write(read().filter((m) => m.id !== id))
}

function connectedPad(): Gamepad | null {
  const pads = navigator.getGamepads()
  return pads.find((p) => p && p.connected) ?? null
}

/**
 * Listens for the next axis deflection or button press and reports it —
 * the Settings UI then asks what it should mean. Stops itself after one
 * capture; call again to learn the next control.
 */
export function startLearning(onCapture: (capture: GamepadCapture) => void): () => void {
  if (!isGamepadSupported()) return () => {}
  let rafId: number | null = null
  let baseline: number[] | null = null

  function tick() {
    const pad = connectedPad()
    if (pad) {
      if (!baseline) baseline = [...pad.axes]
      for (let i = 0; i < pad.buttons.length; i += 1) {
        if (pad.buttons[i]?.pressed) {
          onCapture({ kind: 'button', index: i })
          return
        }
      }
      for (let i = 0; i < pad.axes.length; i += 1) {
        const delta = pad.axes[i] - (baseline[i] ?? 0)
        if (Math.abs(delta) > AXIS_FIRE_THRESHOLD) {
          onCapture({ kind: 'axis', index: i, direction: delta > 0 ? 1 : -1 })
          return
        }
      }
    }
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)
  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
  }
}

/** Call while a session is active. Idempotent-safe to call/stop repeatedly. */
export function startMappedGamepadBridge(): () => void {
  if (!isGamepadSupported()) return () => {}

  const axisArmed = new Map<string, boolean>()
  const buttonDown = new Set<number>()
  let rafId: number | null = null

  function tick() {
    const pad = connectedPad()
    if (pad) {
      for (const mapping of read()) {
        if (mapping.kind === 'button') {
          const pressed = pad.buttons[mapping.index]?.pressed ?? false
          if (pressed && !buttonDown.has(mapping.index)) {
            buttonDown.add(mapping.index)
            remoteController.simulate(toRemoteEvent(mapping))
          } else if (!pressed) {
            buttonDown.delete(mapping.index)
          }
        } else {
          const key = `${mapping.index}:${mapping.direction}`
          const value = pad.axes[mapping.index] ?? 0
          const deflected = mapping.direction === 1 ? value > AXIS_FIRE_THRESHOLD : value < -AXIS_FIRE_THRESHOLD
          const neutral = Math.abs(value) < AXIS_RESET_THRESHOLD
          if (deflected && !axisArmed.get(key)) {
            axisArmed.set(key, true)
            remoteController.simulate(toRemoteEvent(mapping))
          } else if (neutral) {
            axisArmed.set(key, false)
          }
        }
      }
    }
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)
  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }
}
