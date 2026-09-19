/**
 * Music hub control (Phase 3).
 *
 * Spotify has a documented Web API and Web Playback SDK, and supports the
 * PKCE authorization-code flow, so this is doable from a pure client-side
 * app with no backend secret. Not wired up yet — this stub keeps the UI
 * (NowPlayingBar) stable so the real client can be dropped in later.
 */

export interface NowPlayingState {
  isConnected: boolean
  trackName: string | null
  artistName: string | null
  isPlaying: boolean
}

export interface NowPlayingController {
  readonly isConnected: boolean
  connect(): Promise<void>
  play(): void
  pause(): void
  next(): void
  previous(): void
  getState(): NowPlayingState
  onStateChange(cb: (state: NowPlayingState) => void): () => void
}

type Listener = (state: NowPlayingState) => void

export class MockNowPlayingController implements NowPlayingController {
  isConnected = false
  private state: NowPlayingState = {
    isConnected: false,
    trackName: null,
    artistName: null,
    isPlaying: false,
  }
  private listeners = new Set<Listener>()

  async connect() {
    // Real implementation: redirect through Spotify's PKCE auth flow, then
    // open a Web Playback SDK player. Left unimplemented for Phase 3.
  }

  play() {
    this.emit({ ...this.state, isPlaying: true })
  }

  pause() {
    this.emit({ ...this.state, isPlaying: false })
  }

  next() {
    this.emit(this.state)
  }

  previous() {
    this.emit(this.state)
  }

  getState() {
    return this.state
  }

  onStateChange(cb: Listener) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private emit(next: NowPlayingState) {
    this.state = next
    for (const cb of this.listeners) cb(next)
  }
}

export const nowPlayingController = new MockNowPlayingController()
