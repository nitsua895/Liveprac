import { useState } from 'react'
import * as googleCalendar from '../lib/googleCalendar'

export function GoogleCalendarCard() {
  const [connected, setConnected] = useState(() => googleCalendar.isConnected())
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    try {
      await googleCalendar.beginAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="surface-card p-5">
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
        <button
          type="button"
          onClick={() => void connect()}
          className="primary-action"
        >
          Connect Google Calendar
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <details className="mt-4 text-sm text-neutral-400">
        <summary>Connection troubleshooting</summary>
        <p className="mt-2">
          If Google reports a redirect mismatch, add this exact URI as an Authorized redirect URI
          on this app's OAuth client in Google Cloud Console, including the final slash:
        </p>
        <code className="mt-2 block break-all text-accent-200">{googleCalendar.redirectUri()}</code>
        <p className="mt-2">
          Until this app is verified with Google, only accounts added as test users on the OAuth
          consent screen can connect — that's expected while testing with just Shelby's account.
        </p>
      </details>
    </div>
  )
}
