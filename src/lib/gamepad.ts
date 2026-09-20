/**
 * Gamepad API support check. The actual dispatch logic (mapping axes/buttons
 * to actions) lives in gamepadMapping.ts — this file just answers "can we
 * even try."
 *
 * Browser support note: many BLE devices that pair through the OS's native
 * Bluetooth settings (game controllers, but also HID-class remotes/dials
 * like the pressure pad) are deliberately invisible to Web Bluetooth —
 * browsers blocklist the standard HID service specifically to force those
 * devices through the OS input stack instead. On iOS/iPadOS, where Safari
 * has no Web Bluetooth at all, the Gamepad API is often the only web-visible
 * path to such a device, once paired in iOS Settings → Bluetooth like any
 * other accessory. Worth testing directly on the target device rather than
 * assuming a specific pad works.
 */
export function isGamepadSupported(): boolean {
  return typeof navigator !== 'undefined' && 'getGamepads' in navigator
}
