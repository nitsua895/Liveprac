/** Which optional Home-screen widgets are shown. Not every practice uses
 *  every integration — this hides the noise without touching data or the
 *  underlying feature (Settings still works normally either way). */
export type VisibilityKey = 'remoteStatus' | 'appointments' | 'spotifyBar'

const KEY_PREFIX = 'liveprac:v1:show:'

export const VISIBILITY_LABELS: Record<VisibilityKey, { label: string; detail: string }> = {
  remoteStatus: { label: 'Remote status pill', detail: 'Connection/battery glance on Home' },
  appointments: { label: "Today's appointments", detail: 'Google Calendar list on Home' },
  spotifyBar: { label: 'Spotify player bar', detail: 'Playback dock at the bottom of every screen' },
}

export const VISIBILITY_KEYS: VisibilityKey[] = ['remoteStatus', 'appointments', 'spotifyBar']

export function isVisible(key: VisibilityKey): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + key) !== 'false'
  } catch {
    return true
  }
}

export function setVisible(key: VisibilityKey, visible: boolean): void {
  try {
    localStorage.setItem(KEY_PREFIX + key, String(visible))
  } catch {
    // Storage unavailable — the toggle just won't persist across reloads.
  }
}
