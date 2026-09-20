/**
 * Google Calendar, read-only.
 *
 * PKCE authorization-code flow, same shape as spotify.ts — except unlike
 * Spotify, Google's token endpoint rejects a "Web application" OAuth
 * client's code exchange without its client_secret, even with a valid PKCE
 * verifier. Google only treats Desktop/Android/iOS/TV client types as truly
 * public, and those can't use an arbitrary HTTPS redirect URI the way this
 * static site needs.
 *
 * So the two calls that need the secret (the code exchange and the refresh)
 * go through a tiny Netlify Function (netlify/functions/google-token.js)
 * instead of hitting Google directly — the secret lives only in a Netlify
 * environment variable there, never in this bundle. The Client ID itself
 * was never sensitive either way — it's sent straight to Google below when
 * starting the login redirect, same as it's sent to any OAuth provider.
 *
 * Scope is calendar.readonly: Liveprac only ever reads events. Which client
 * profile an appointment belongs to is decided here, by hand, and stored
 * locally — never written back to Google Calendar.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_PROXY_URL = '/.netlify/functions/google-token'
const API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const CLIENT_ID = '1002157149576-4cfstr7eufmrdokvofm4989cmp0r4go7.apps.googleusercontent.com'

const KEYS = {
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
  /** Google's own link to this event, for "open in Google Calendar". */
  htmlLink: string | null
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

/** Pulls Google's actual reason out of a failed response instead of guessing. */
async function describeError(res: Response): Promise<string> {
  try {
    const json = await res.json()
    return json.error_description || json.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
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
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })
  const res = await fetch(TOKEN_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Google could not finish connecting (${await describeError(res)}).`)
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

  const res = await fetch(TOKEN_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
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
    throw new Error(`Could not load calendar events (${await describeError(res)}).`)
  }
  const json = await res.json()
  const items = (json.items ?? []) as Array<{
    id: string
    summary?: string
    location?: string
    htmlLink?: string
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
        htmlLink: item.htmlLink ?? null,
      }
    })
}
