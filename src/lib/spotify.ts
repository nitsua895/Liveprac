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
 *   1. A Spotify app registered at developer.spotify.com, with this site's
 *      origin added as a redirect URI. Its Client ID goes in Settings.
 *   2. A Spotify Premium account — the playback-control endpoints reject
 *      free accounts.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing'

const KEYS = {
  clientId: 'liveprac:v1:spotifyClientId',
  verifier: 'liveprac:v1:spotifyVerifier',
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
  isPlaying: boolean
  volumePercent: number | null
  /** Set when Spotify rejects a command, e.g. no active device or not Premium. */
  error: string | null
}

export const EMPTY_STATE: NowPlayingState = {
  isConnected: false,
  trackName: null,
  artistName: null,
  isPlaying: false,
  volumePercent: null,
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

export function getClientId(): string {
  return read(KEYS.clientId) ?? (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? ''
}

export function setClientId(id: string) {
  write(KEYS.clientId, id.trim() || null)
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
  const clientId = getClientId()
  if (!clientId) throw new Error('Add your Spotify Client ID in Settings first.')

  const verifier = randomString(48)
  write(KEYS.verifier, verifier)
  const challenge = base64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })
  window.location.href = `${AUTH_URL}?${params}`
}

/** Call once on load: swaps the ?code= Spotify sent us for a token. */
export async function completeAuthFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return false

  const verifier = read(KEYS.verifier)
  const clientId = getClientId()
  // Clear the query string either way so a reload doesn't retry a used code.
  window.history.replaceState({}, '', window.location.pathname)
  if (!verifier || !clientId) return false

  const body = new URLSearchParams({
    client_id: clientId,
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
  if (!res.ok) return false
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
      client_id: getClientId(),
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
    isPlaying: Boolean(json.is_playing),
    volumePercent: json.device?.volume_percent ?? null,
    error: null,
  }
}

/** Returns an error message, or null on success. */
async function command(path: string, method: string): Promise<string | null> {
  const res = await call(path, { method })
  if (!res) return 'Not connected'
  if (res.status === 404) return 'No active Spotify device — start playback on a speaker or phone first'
  if (res.status === 403) return 'Spotify Premium is required to control playback'
  if (!res.ok && res.status !== 204) return `Spotify error ${res.status}`
  return null
}

export const play = () => command('/me/player/play', 'PUT')
export const pause = () => command('/me/player/pause', 'PUT')
export const next = () => command('/me/player/next', 'POST')
export const previous = () => command('/me/player/previous', 'POST')
export const setVolume = (percent: number) =>
  command(`/me/player/volume?volume_percent=${Math.round(percent)}`, 'PUT')
