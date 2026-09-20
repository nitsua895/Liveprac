/**
 * Google Calendar, read-only.
 *
 * Same shape as spotify.ts: PKCE authorization-code flow so no backend is
 * needed. Unlike Spotify, Google doesn't hand out a single public Client ID
 * for everyone to share — each developer creates their own OAuth client in
 * Google Cloud Console, so the Client ID is entered once in Settings and
 * kept in localStorage rather than hardcoded here.
 *
 * Scope is calendar.readonly: Liveprac only ever reads events. Which client
 * profile an appointment belongs to is decided here, by hand, and stored
 * locally — never written back to Google Calendar.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

const KEYS = {
  clientId: 'liveprac:v1:googleClientId',
  verifier: 'liveprac:v1:googleVerifier',
  state: 'liveprac:v1:googleAuthState',
  token: 'liveprac:v1:googleToken',
}

interface StoredToken {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
}

export interface CalendarEvent {
  id: string
  summary: string
  startMs: number
  endMs: number
  allDay: boolean
  location: string | null
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
    // Storage unavailable — connection just won't persist.
  }
}

export function getClientId(): string {
  return read(KEYS.clientId) ?? ''
}

export function setClientId(clientId: string) {
  write(KEYS.clientId, clientId.trim() || null)
}

export function isConfigured(): boolean {
  return getClientId().length > 0
}

/** Must exactly match an Authorized redirect URI on the Google OAuth client. */
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
  if (!clientId) throw new Error('Add a Google Client ID first.')

  const state = randomString(24)
  write(KEYS.state, state)
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
    scope: SCOPE,
    state,
    access_type: 'offline',
    // Forces Google to reissue a refresh token every connect, not just the
    // very first time this Google account ever granted access.
    prompt: 'consent',
  })
  window.location.href = `${AUTH_URL}?${params}`
}

/** Call once on load: swaps a Google ?code= for a token, if one is present. */
export async function completeAuthFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  // Spotify and Google both redirect back to "/", so only handle this one if
  // the state we stashed for Google matches — otherwise it's Spotify's code.
  const expectedState = read(KEYS.state)
  if (!code || !expectedState || params.get('state') !== expectedState) return false

  const verifier = read(KEYS.verifier)
  window.history.replaceState({}, '', window.location.pathname)
  if (!verifier) throw new Error('Google connection expired. Please try Connect again.')

  const body = new URLSearchParams({
    client_id: getClientId(),
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
  if (!res.ok) throw new Error('Google could not finish connecting. Please try Connect again.')
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
      refreshToken: token.refreshToken,
      expiresAt: Date.now() + json.expires_in * 1000,
    } satisfies StoredToken),
  )
  return json.access_token as string
}

/** Today's events on the signed-in account's primary calendar, earliest first. */
export async function fetchTodayEvents(): Promise<CalendarEvent[]> {
  const accessToken = await freshAccessToken()
  if (!accessToken) return []

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })
  const res = await fetch(`${API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) disconnect()
    throw new Error('Could not load calendar events. Check your connection and try again.')
  }
  const json = await res.json()
  const items = (json.items ?? []) as Array<{
    id: string
    summary?: string
    location?: string
    start: { dateTime?: string; date?: string }
    end: { dateTime?: string; date?: string }
    status?: string
  }>

  return items
    .filter((item) => item.status !== 'cancelled')
    .map((item) => {
      const allDay = !item.start.dateTime
      return {
        id: item.id,
        summary: item.summary ?? '(No title)',
        startMs: new Date(item.start.dateTime ?? item.start.date ?? 0).getTime(),
        endMs: new Date(item.end.dateTime ?? item.end.date ?? 0).getTime(),
        allDay,
        location: item.location ?? null,
      }
    })
}
