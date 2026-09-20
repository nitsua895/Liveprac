import { useEffect, useState } from 'react'
import * as googleCalendar from '../lib/googleCalendar'
import type { CalendarEvent } from '../lib/googleCalendar'
import { useAppState } from '../state/AppStateContext'

const REFRESH_MS = 5 * 60 * 1000

export function TodaysAppointments() {
  const { clients, addClient, calendarLinks, linkCalendarEvent, unlinkCalendarEvent } = useAppState()
  const [connected, setConnected] = useState(() => googleCalendar.isConnected())
  const [appointments, setAppointments] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) return
    let cancelled = false

    async function refresh() {
      try {
        const events = await googleCalendar.fetchTodayEvents()
        if (!cancelled) {
          setAppointments(events)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setConnected(googleCalendar.isConnected())
        }
      }
    }

    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [connected])

  if (!connected) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
        Today's appointments
      </h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {appointments.length === 0 && !error && (
        <p className="text-sm text-neutral-600">Nothing on the calendar today.</p>
      )}
      <div className="flex flex-col gap-2">
        {appointments.map((event) => {
          const link = calendarLinks.find((l) => l.googleEventId === event.id)
          const linkedClient = link ? clients.find((c) => c.id === link.clientId) : undefined
          return (
            <div
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-200">{event.summary}</p>
                <p className="text-xs text-neutral-500">
                  {event.allDay ? 'All day' : formatTimeRange(event.startMs, event.endMs)}
                </p>
              </div>
              {linkedClient ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1 text-xs text-accent-300">
                    {linkedClient.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLinkingEventId(event.id)}
                    className="text-xs text-neutral-600"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLinkingEventId(event.id)}
                  className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300"
                >
                  Link to client
                </button>
              )}
            </div>
          )
        })}
      </div>

      {linkingEventId && (
        <LinkClientModal
          eventSummary={appointments.find((e) => e.id === linkingEventId)?.summary ?? ''}
          clients={clients}
          currentClientId={calendarLinks.find((l) => l.googleEventId === linkingEventId)?.clientId ?? null}
          onPick={(clientId) => {
            linkCalendarEvent(linkingEventId, clientId)
            setLinkingEventId(null)
          }}
          onUnlink={() => {
            unlinkCalendarEvent(linkingEventId)
            setLinkingEventId(null)
          }}
          onAddClient={(name) => addClient(name)}
          onClose={() => setLinkingEventId(null)}
        />
      )}
    </section>
  )
}

function LinkClientModal({
  eventSummary,
  clients,
  currentClientId,
  onPick,
  onUnlink,
  onAddClient,
  onClose,
}: {
  eventSummary: string
  clients: { id: string; name: string }[]
  currentClientId: string | null
  onPick: (clientId: string) => void
  onUnlink: () => void
  onAddClient: (name: string) => { id: string }
  onClose: () => void
}) {
  const [newClientName, setNewClientName] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-6">
        <h3 className="mb-1 text-lg text-neutral-100">Link to a client</h3>
        <p className="mb-4 truncate text-sm text-neutral-500">{eventSummary}</p>
        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
          {clients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => onPick(client.id)}
              className={`rounded-lg border px-4 py-2 text-left text-neutral-300 ${
                client.id === currentClientId ? 'border-accent-500/50 bg-accent-500/10' : 'border-neutral-800'
              }`}
            >
              {client.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="New client name"
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-accent-500/50"
          />
          <button
            type="button"
            disabled={!newClientName.trim()}
            onClick={() => {
              const client = onAddClient(newClientName.trim())
              setNewClientName('')
              onPick(client.id)
            }}
            className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
          >
            Add & link
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between">
          {currentClientId ? (
            <button type="button" onClick={onUnlink} className="text-sm text-red-400/80">
              Unlink
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTimeRange(startMs: number, endMs: number): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(startMs).toLocaleTimeString([], opts)} – ${new Date(endMs).toLocaleTimeString([], opts)}`
}
