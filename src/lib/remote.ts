/**
 * Client-side Bluetooth remote (dial + button).
 *
 * iOS Safari does not implement the Web Bluetooth API, so this cannot be
 * built as a plain web page talking directly to a BLE device on an iPad.
 * The real implementation needs a native wrapper (e.g. Capacitor with
 * @capacitor-community/bluetooth-le) around this same web app, driving a
 * button that exposes click / double-click / long-press over BLE (Flic 2
 * is the leading candidate — it has an iOS SDK and distinguishes those
 * gestures natively).
 *
 * Until that hardware and native shell exist, RemoteController is backed
 * by MockRemoteController so the rest of the app (timer, ambient cues,
 * preference log) can be built and tested against real event shapes now.
 */

export type RemoteEvent =
  /** delta sign = direction, |delta| = rotation size: 1 short, 2 medium, 3 long. */
  | { type: 'dial'; delta: number }
  | { type: 'press'; kind: 'single' | 'long' }

export interface RemoteController {
  readonly isHardwareBacked: boolean
  connect(): Promise<void>
  disconnect(): void
  onEvent(cb: (event: RemoteEvent) => void): () => void
}

type Listener = (event: RemoteEvent) => void

export class MockRemoteController implements RemoteController {
  readonly isHardwareBacked = false
  private listeners = new Set<Listener>()

  async connect() {
    // No-op: there is nothing to pair with yet.
  }

  disconnect() {
    this.listeners.clear()
  }

  onEvent(cb: Listener) {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  /** Test-only: fire an event as if it came from the physical remote. */
  simulate(event: RemoteEvent) {
    for (const cb of this.listeners) cb(event)
  }
}

export const remoteController = new MockRemoteController()
