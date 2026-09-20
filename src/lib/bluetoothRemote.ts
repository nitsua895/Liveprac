import { remoteController } from './remote'

/**
 * Generic Web Bluetooth bridge for the physical dial/button remote.
 *
 * Deliberately hardware-agnostic: it doesn't assume a specific device's GATT
 * profile. Instead it connects to whatever BLE peripheral is chosen, listens
 * to every characteristic that supports notifications, and lets the app
 * "learn" what a given raw notification means (see bleMapping.ts) rather
 * than hardcoding a UUID→action table for one particular board. Point it at
 * an ESP32/Arduino/nRF52 prototype, a Flic-like button, or anything else
 * that speaks standard BLE, and it works the same way.
 *
 * Platform reality: Web Bluetooth exists in Chrome/Edge on Android and
 * desktop, but NOT in Safari on iOS — that's an Apple platform limitation,
 * not something fixable from here. On iOS, this silently reports
 * unsupported and the app falls back to the on-screen test controls /
 * gamepad bridge, same as before.
 */

const BATTERY_SERVICE = 0x180f
const BATTERY_LEVEL_CHAR = 0x2a19
const DEVICE_ID_KEY = 'liveprac:v1:bleDeviceId'
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000]

export type BleStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface BleNotification {
  serviceUuid: string
  characteristicUuid: string
  /** Lowercase hex, e.g. "01ff" — the raw bytes as reported, for mapping/debugging. */
  hex: string
  bytes: number[]
}

type StatusListener = (status: BleStatus) => void
type NotificationListener = (note: BleNotification) => void
type BatteryListener = (percent: number | null) => void

class BluetoothRemoteBridge {
  private device: BluetoothDevice | null = null
  private status: BleStatus = 'disconnected'
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manuallyDisconnected = false
  private batteryPercent: number | null = null

  private statusListeners = new Set<StatusListener>()
  private notificationListeners = new Set<NotificationListener>()
  private batteryListeners = new Set<BatteryListener>()

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  getStatus(): BleStatus {
    return this.isSupported() ? this.status : 'unsupported'
  }

  getBattery(): number | null {
    return this.batteryPercent
  }

  getDeviceName(): string | null {
    return this.device?.name ?? null
  }

  onStatusChange(cb: StatusListener): () => void {
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }

  onNotification(cb: NotificationListener): () => void {
    this.notificationListeners.add(cb)
    return () => this.notificationListeners.delete(cb)
  }

  onBatteryChange(cb: BatteryListener): () => void {
    this.batteryListeners.add(cb)
    return () => this.batteryListeners.delete(cb)
  }

  /** Must be called from a user gesture (a tap) — the browser requires this
   *  for the device picker to appear at all. */
  async requestAndConnect(): Promise<void> {
    if (!this.isSupported()) throw new Error('This browser has no Bluetooth support (iOS Safari never does).')

    // Chrome only lets you access services you declared up front. Since we
    // don't know a DIY board's custom service UUID ahead of time, we request
    // the well-known Battery Service plus the handful of UUIDs hobbyist BLE
    // firmware most commonly reuses for a custom service.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BATTERY_SERVICE, ...COMMON_CUSTOM_SERVICE_GUESSES],
    })

    try {
      localStorage.setItem(DEVICE_ID_KEY, device.id)
    } catch {
      // Storage unavailable — silent reconnect on reload just won't work.
    }

    this.manuallyDisconnected = false
    await this.bindDevice(device)
  }

  /** Call on load: reconnects to a previously-paired device without a picker,
   *  if the browser still remembers the permission grant (Chrome does, via
   *  getDevices(), as long as the site wasn't revoked in site settings). */
  async tryAutoReconnect(): Promise<void> {
    if (!this.isSupported()) return
    let savedId: string | null = null
    try {
      savedId = localStorage.getItem(DEVICE_ID_KEY)
    } catch {
      return
    }
    if (!savedId) return

    const knownDevices = await navigator.bluetooth.getDevices?.().catch(() => [])
    const match = knownDevices?.find((d) => d.id === savedId)
    if (!match) return

    this.manuallyDisconnected = false
    await this.bindDevice(match).catch(() => {
      // Device not currently reachable — normal at startup before it's on.
      // The reconnect loop below will keep trying once something disconnects,
      // but for a cold start with no prior connection we just wait for the
      // user to bring the remote into range and tap Connect if needed.
    })
  }

  disconnect(): void {
    this.manuallyDisconnected = true
    this.clearReconnectTimer()
    this.device?.gatt?.disconnect()
    this.setStatus('disconnected')
  }

  private async bindDevice(device: BluetoothDevice): Promise<void> {
    this.device = device
    device.addEventListener('gattserverdisconnected', this.handleDisconnected)
    await this.connectGatt()
  }

  private handleDisconnected = () => {
    this.batteryPercent = null
    this.notifyBattery()
    if (this.manuallyDisconnected) {
      this.setStatus('disconnected')
      return
    }
    this.setStatus('reconnecting')
    this.scheduleReconnect()
  }

  private scheduleReconnect() {
    this.clearReconnectTimer()
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      void this.connectGatt().catch(() => this.scheduleReconnect())
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private async connectGatt(): Promise<void> {
    if (!this.device) return
    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting')
    const server = await this.device.gatt!.connect()
    this.reconnectAttempt = 0
    this.setStatus('connected')

    const services = await server.getPrimaryServices()
    for (const service of services) {
      const characteristics = await service.getCharacteristics().catch(() => [])
      for (const characteristic of characteristics) {
        if (characteristic.properties.notify || characteristic.properties.indicate) {
          characteristic.addEventListener('characteristicvaluechanged', (event) =>
            this.handleValueChanged(service.uuid, characteristic.uuid, event),
          )
          await characteristic.startNotifications().catch(() => {})
        }
      }

      if (service.uuid === normalizeUuid(BATTERY_SERVICE)) {
        void this.readBattery(service)
      }
    }
  }

  private async readBattery(batteryService: BluetoothRemoteGATTService) {
    try {
      const char = await batteryService.getCharacteristic(normalizeUuid(BATTERY_LEVEL_CHAR))
      const value = await char.readValue()
      this.batteryPercent = value.getUint8(0)
      this.notifyBattery()
      char.addEventListener('characteristicvaluechanged', () => {
        char.readValue().then((v) => {
          this.batteryPercent = v.getUint8(0)
          this.notifyBattery()
        })
      })
      await char.startNotifications().catch(() => {})
    } catch {
      // Battery Service present but level unreadable — leave battery unknown.
    }
  }

  private handleValueChanged(serviceUuid: string, characteristicUuid: string, event: Event) {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value
    if (!value) return
    const bytes = Array.from(new Uint8Array(value.buffer))
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
    const note: BleNotification = { serviceUuid, characteristicUuid, hex, bytes }
    for (const cb of this.notificationListeners) cb(note)
  }

  private setStatus(status: BleStatus) {
    this.status = status
    for (const cb of this.statusListeners) cb(status)
  }

  private notifyBattery() {
    for (const cb of this.batteryListeners) cb(this.batteryPercent)
  }
}

function normalizeUuid(short: number): string {
  return `0000${short.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`
}

// Reasonable guesses at the base of common ranges hobbyist BLE firmware uses
// for a custom service (Nordic UART service is the most common single one).
const COMMON_CUSTOM_SERVICE_GUESSES = [
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
]

export const bluetoothRemote = new BluetoothRemoteBridge()

// Feed learned mappings into the same event bus the gamepad bridge and the
// manual test buttons already use — LiveSession doesn't need to know or care
// where a RemoteEvent came from.
export { remoteController }
