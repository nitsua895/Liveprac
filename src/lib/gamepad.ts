import { remoteController } from './remote'

/**
 * Stands in for the physical dial/button using a game controller, so the
 * timer/glow/preference-log flow can be tested end-to-end before the real
 * Bluetooth remote arrives. Feeds into the same MockRemoteController the
 * on-screen simulator buttons use, so LiveSession doesn't know the
 * difference.
 *
 * Left stick up/down = dial. There's no real "rotation" on a stick, so
 * rotation amount is modeled as hold duration: tap-and-release quickly for
 * a small nudge, hold longer for a bigger one. This is a first guess at the
 * short/medium/long mapping — swap the thresholds below once real dial
 * hardware exists and behaves differently.
 *
 * Button 0 (A / Cross) = press: quick tap = single (flag), hold = long
 * (loved).
 *
 * Browser support note: this works reliably in desktop Chrome/Edge/Firefox.
 * iOS Safari's Gamepad API support is inconsistent across versions and
 * controllers — worth testing directly on the target iPad rather than
 * assuming it works there.
 */

const AXIS_DEADZONE = 0.5
const LONG_PRESS_MS = 500
const HOLD_SHORT_MS = 400
const HOLD_MEDIUM_MS = 1000

let rafId: number | null = null
let holdStartedAt: number | null = null
let holdDirection: 1 | -1 | null = null
let buttonDownAt: number | null = null

export function isGamepadSupported(): boolean {
  return typeof navigator !== 'undefined' && 'getGamepads' in navigator
}

export function startGamepadBridge(): () => void {
  if (!isGamepadSupported()) return () => {}

  function tick() {
    const pads = navigator.getGamepads()
    const pad = pads.find((p) => p && p.connected)

    if (pad) {
      const axisY = pad.axes[1] ?? 0
      const direction: 1 | -1 | null = axisY < -AXIS_DEADZONE ? 1 : axisY > AXIS_DEADZONE ? -1 : null

      if (direction && holdDirection === null) {
        holdDirection = direction
        holdStartedAt = performance.now()
      } else if (!direction && holdDirection !== null) {
        const heldMs = holdStartedAt ? performance.now() - holdStartedAt : 0
        const magnitude = heldMs < HOLD_SHORT_MS ? 1 : heldMs < HOLD_MEDIUM_MS ? 2 : 3
        remoteController.simulate({ type: 'dial', delta: holdDirection * magnitude })
        holdDirection = null
        holdStartedAt = null
      }

      const buttonPressed = pad.buttons[0]?.pressed ?? false
      if (buttonPressed && buttonDownAt === null) {
        buttonDownAt = performance.now()
      } else if (!buttonPressed && buttonDownAt !== null) {
        const heldMs = performance.now() - buttonDownAt
        remoteController.simulate({ type: 'press', kind: heldMs >= LONG_PRESS_MS ? 'long' : 'single' })
        buttonDownAt = null
      }
    }

    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    holdDirection = null
    holdStartedAt = null
    buttonDownAt = null
  }
}
