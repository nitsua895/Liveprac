import { useState } from 'react'
import * as googleCalendar from '../lib/googleCalendar'

/**
 * Unlike Spotify, Google doesn't hand out one shared Client ID — each
 * developer registers their own OAuth client in Google Cloud Console. So
 * this card doubles as the one-time setup step: paste the Client ID here
 * before Connect does anything.
 */
export function GoogleCalendarCard() {
  const [clientId, setClientIdInput] = useState(() => googleCalendar.getClientId())
  const [connected, setConnected] = useState(() => googleCalendar.isConnected())
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    try {
      googleCalendar.setClientId(clientId)
      await googleCalendar.beginAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-neutral-100">Google Calendar</p>
        <span className="rounded-full border border-neutral-800 px-3 py-0.5 text-xs text-neutral-500">
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Shows today's appointments on the Hub, read-only. Which client each appointment belongs to
        is set by hand here in Liveprac — never guessed from the event, and never sent back to
        Google.
      </p>

      {connected ? (
        <button
          type="button"
          onClick={() => {
            googleCalendar.disconnect()
            setConnected(false)
          }}
          className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
        >
          Disconnect
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-400">
            Google Client ID
            <input
              value={clientId}
              onChange={(e) => setClientIdInput(e.target.value)}
              placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-accent-500/50"
            />
          </label>
          <button
            type="button"
            disabled={!clientId.trim()}
            onClick={() => void connect()}
            className="self-start rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
          >
            Connect Google Calendar
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <details className="mt-4 text-sm text-neutral-400">
        <summary>Where do I get a Client ID?</summary>
        <p className="mt-2">
          In Google Cloud Console: create a project, enable the Google Calendar API, configure the
          OAuth consent screen (add yourself as a test user — no Google review needed for that),
          then create an OAuth Client ID of type "Web application". Add this exact Authorized
          redirect URI and Authorized JavaScript origin:
        </p>
        <code className="mt-2 block break-all text-accent-200">{googleCalendar.redirectUri()}</code>
        <p className="mt-2">
          Only accounts added as test users on the consent screen can connect until the app is
          verified — that's fine for testing with just Shelby's account for now.
        </p>
      </details>
    </div>
  )
}
