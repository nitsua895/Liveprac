/**
 * Spotify playback control.
 *
 * Controls whatever device Spotify is already playing on (phone, speaker,
 * desktop) through the Web API — it deliberately does NOT try to play audio in
 * this page. The Web Playback SDK isn't supported on iOS browsers, and the
 * music should come out of the room's speakers anyway, not the iPad.
 *
 * Auth is the PKCE authorization-code flow, which needs no client secret and
 * so works from a static site. Two things are required before it does
 * anything:
 *   1. The Liveprac Spotify app, with this site's origin registered as a
 *      redirect URI. Its public Client ID is bundled below.
 *   2. A Spotify Premium account — the playback-control endpoints reject
 *      free accounts.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'
// Spotify client IDs identify an app but do not grant access and are safe to
// ship in browser code. PKCE keeps authentication secret-free.
const CLIENT_ID = 'eea47657938545eba54a5e6bf63b4c50'
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing'

const KEYS = {
  verifier: 'liveprac:v1:spotifyVerifier',
  state: 'liveprac:v1:spotifyAuthState',
  token: 'liveprac:v1:spotifyToken',
}

interface StoredToken {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
}

export interface NowPlayingState {
  isConnected: boolean
  trackName: string | null
  artistName: string | null
  albumName: string | null
  albumArtUrl: string | null
  trackUri: string | null
  isPlaying: boolean
  progressMs: number
  durationMs: number
  volumePercent: number | null
  supportsVolume: boolean
  deviceId: string | null
  deviceName: string | null
  shuffle: boolean
  repeat: 'off' | 'track' | 'context'
  /** Set when Spotify rejects a command, e.g. no active device or not Premium. */
  error: string | null
}

export const EMPTY_STATE: NowPlayingState = {
  isConnected: false,
  trackName: null,
  artistName: null,
  albumName: null,
  albumArtUrl: null,
  trackUri: null,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  volumePercent: null,
  supportsVolume: false,
  deviceId: null,
  deviceName: null,
  shuffle: false,
  repeat: 'off',
  error: null,
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — auth just won't persist.
  }
}

/** Must exactly match a redirect URI registered on the Spotify app. */
export function redirectUri(): string {
  return `${window.location.origin}/`
}

function getToken(): StoredToken | null {
  const raw = read(KEYS.token)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredToken
  } catch {
    return null
  }
}

export function isConnected(): boolean {
  return getToken() !== null
}

export function disconnect() {
  write(KEYS.token, null)
  write(KEYS.verifier, null)
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ('0' + b.toString(16)).slice(-2)).join('')
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function beginAuth(): Promise<void> {
  const state = randomString(24)
  write(KEYS.state, state)
  const verifier = randomString(48)
  write(KEYS.verifier, verifier)
  const challenge = base64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  })
  window.location.href = `${AUTH_URL}?${params}`
}

/** Call once on load: swaps the ?code= Spotify sent us for a token. */
export async function completeAuthFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (params.has('error')) {
    window.history.replaceState({}, '', window.location.pathname)
    throw new Error('Spotify connection was not approved. Please try Connect again.')
  }
  if (!code) return false

  const verifier = read(KEYS.verifier)
  // Clear the query string either way so a reload doesn't retry a used code.
  window.history.replaceState({}, '', window.location.pathname)
  if (!verifier || !read(KEYS.state) || params.get('state') !== read(KEYS.state)) {
    throw new Error('Spotify login expired or was opened in another browser. Please connect again here.')
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error('Spotify could not finish connecting. Please try Connect again.')
  const json = await res.json()
  write(
    KEYS.token,
    JSON.stringify({
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: Date.now() + json.expires_in * 1000,
    } satisfies StoredToken),
  )
  write(KEYS.verifier, null)
  write(KEYS.state, null)
  return true
}

async function freshAccessToken(): Promise<string | null> {
  const token = getToken()
  if (!token) return null
  if (Date.now() < token.expiresAt - 30_000) return token.accessToken
  if (!token.refreshToken) {
    disconnect()
    return null
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }),
  })
  if (!res.ok) {
    disconnect()
    return null
  }
  const json = await res.json()
  write(
    KEYS.token,
    JSON.stringify({
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + json.expires_in * 1000,
    } satisfies StoredToken),
  )
  return json.access_token as string
}

async function call(path: string, init?: RequestInit): Promise<Response | null> {
  const accessToken = await freshAccessToken()
  if (!accessToken) return null
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  })
}

export async function fetchState(): Promise<NowPlayingState> {
  if (!isConnected()) return EMPTY_STATE
  const res = await call('/me/player')
  if (!res) return EMPTY_STATE
  // 204 means Spotify is connected but nothing is playing anywhere.
  if (res.status === 204) return { ...EMPTY_STATE, isConnected: true }
  if (!res.ok) return { ...EMPTY_STATE, isConnected: true, error: `Spotify error ${res.status}` }

  const json = await res.json()
  return {
    isConnected: true,
    trackName: json.item?.name ?? null,
    artistName: json.item?.artists?.map((a: { name: string }) => a.name).join(', ') ?? null,
    albumName: json.item?.album?.name ?? null,
    albumArtUrl: json.item?.album?.images?.[1]?.url ?? json.item?.album?.images?.[0]?.url ?? null,
    trackUri: json.item?.uri ?? null,
    isPlaying: Boolean(json.is_playing),
    progressMs: json.progress_ms ?? 0,
    durationMs: json.item?.duration_ms ?? 0,
    volumePercent: json.device?.volume_percent ?? null,
    supportsVolume: Boolean(json.device?.supports_volume),
    deviceId: json.device?.id ?? null,
    deviceName: json.device?.name ?? null,
    shuffle: Boolean(json.shuffle_state),
    repeat: json.repeat_state ?? 'off',
    error: null,
  }
}

/** Returns an error message, or null on success. */
async function command(path: string, method: string): Promise<string | null> {
  const res = await call(path, { method })
  if (!res) return 'Not connected'
  if (res.status === 404) return 'No active Spotify device — start playback on a speaker or phone first'
  if (!res.ok && res.status !== 204) {
    try {
      const detail = (await res.json()) as { error?: { message?: string } }
      if (detail.error?.message) return detail.error.message
    } catch {
      // Some player errors have no JSON body.
    }
    if (res.status === 403) return 'Spotify rejected this control for the active device'
    return `Spotify error ${res.status}`
  }
  return null
}

export const play = () => command('/me/player/play', 'PUT')
export const pause = () => command('/me/player/pause', 'PUT')
export const next = () => command('/me/player/next', 'POST')
export const previous = () => command('/me/player/previous', 'POST')
export const setVolume = (percent: number, deviceId?: string | null) => {
  const query = new URLSearchParams({ volume_percent: String(Math.round(percent)) })
  if (deviceId) query.set('device_id', deviceId)
  return command(`/me/player/volume?${query}`, 'PUT')
}
export const seek = (positionMs: number) =>
  command(`/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`, 'PUT')
export const setShuffle = (enabled: boolean) =>
  command(`/me/player/shuffle?state=${enabled}`, 'PUT')
export const setRepeat = (state: NowPlayingState['repeat']) =>
  command(`/me/player/repeat?state=${state}`, 'PUT')
