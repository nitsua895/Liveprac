import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as googleCalendar from '../lib/googleCalendar'
import type { CalendarEvent } from '../lib/googleCalendar'
import { useAppState } from '../state/AppStateContext'
import type { SessionTemplate } from '../types'

const REFRESH_MS = 5 * 60 * 1000

export function TodaysAppointments() {
  const {
    clients,
    templates,
    addClient,
    calendarLinks,
    linkCalendarEvent,
    unlinkCalendarEvent,
  } = useAppState()
  const navigate = useNavigate()
  const [connected, setConnected] = useState(() => googleCalendar.isConnected())
  const [appointments, setAppointments] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null)
  const [pickingRoutineFor, setPickingRoutineFor] = useState<string | null>(null)

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

  function prepareSession(templateId: string, clientId: string) {
    const params = new URLSearchParams({ template: templateId, client: clientId })
    navigate(`/?${params.toString()}`)
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-label">
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
          const templateId = link?.templateId ?? linkedClient?.lastTemplateId
          const template = templateId ? templates.find((t) => t.id === templateId) : undefined
          return (
            <div
              key={event.id}
              className="surface-card flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                {linkedClient && (
                  <button
                    type="button"
                    onClick={() => setLinkingEventId(event.id)}
                    className="mb-0.5 block text-xs font-medium text-accent-300 hover:text-accent-200"
                  >
                    {linkedClient.name}
                  </button>
                )}
                {event.htmlLink ? (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block min-w-0"
                    title="Open in Google Calendar"
                  >
                    <p className="flex items-center gap-1.5 truncate text-sm text-neutral-200 group-hover:text-accent-300">
                      <span className="truncate">{event.summary}</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" className="shrink-0 opacity-50 group-hover:opacity-100" aria-hidden="true">
                        <path d="M9 6h9v9M18 6 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </p>
                  </a>
                ) : (
                  <p className="truncate text-sm text-neutral-200">{event.summary}</p>
                )}
                <p className="text-xs text-neutral-500">
                  {event.allDay ? 'All day' : formatTimeRange(event.startMs, event.endMs)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {linkedClient ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPickingRoutineFor(event.id)}
                      aria-label="Edit today's routine"
                      title="Edit today"
                      className={`appointment-edit ${template ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-400'}`}
                    >
                      <span>{template ? template.name : 'Choose routine'}</span>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                        <path d="M4 20h4.1L19 9.1a2.1 2.1 0 0 0 0-3L17.9 5a2.1 2.1 0 0 0-3 0L4 15.9V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {template && (
                      <button
                        type="button"
                        onClick={() => prepareSession(template.id, linkedClient.id)}
                        className="rounded-full bg-accent-500 px-4 py-1.5 text-sm font-medium text-white"
                      >
                        Start
                      </button>
                    )}
                  </>
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

      {pickingRoutineFor && (
        <RoutinePickerModal
          eventSummary={appointments.find((e) => e.id === pickingRoutineFor)?.summary ?? ''}
          templates={templates}
          onClose={() => setPickingRoutineFor(null)}
          onPick={(templateId) => {
            const link = calendarLinks.find((l) => l.googleEventId === pickingRoutineFor)
            // Sets this one appointment's routine, not the client's
            // last-used routine directly — that updates on its own the
            // moment the session actually starts (see startSession),
            // which is what should drive future appointments' default.
            if (link) linkCalendarEvent(link.googleEventId, link.clientId, templateId)
            setPickingRoutineFor(null)
          }}
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
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="link-client-title">
        <h3 id="link-client-title" className="mb-1 text-lg text-neutral-100">Link to a client</h3>
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
            className="primary-action disabled:opacity-40"
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

function RoutinePickerModal({
  eventSummary,
  templates,
  onPick,
  onClose,
}: {
  eventSummary: string
  templates: SessionTemplate[]
  onPick: (templateId: string) => void
  onClose: () => void
}) {
  const navigate = useNavigate()

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="routine-picker-title">
        <h3 id="routine-picker-title" className="mb-1 text-lg text-neutral-100">Which routine?</h3>
        <p className="mb-4 truncate text-sm text-neutral-500">{eventSummary}</p>
        <p className="mb-3 text-xs text-neutral-600">
          Edits today's appointment only. The client's future plan changes only when you explicitly
          save it after a session.
        </p>
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {templates.length === 0 && (
            <p className="text-sm text-neutral-500">No routines yet. Create one in Build.</p>
          )}
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onPick(template.id)}
              className="rounded-lg border border-neutral-800 px-4 py-3 text-left text-neutral-300 hover:border-accent-500/40"
            >
              <p className="text-neutral-100">{template.name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{template.sections.length} sections</p>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate('/build')}
          className="mt-3 w-full text-center text-sm text-accent-400/80"
        >
          Create a new routine
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full text-center text-sm text-neutral-500">
          Cancel
        </button>
      </div>
    </div>
  )
}

function formatTimeRange(startMs: number, endMs: number): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(startMs).toLocaleTimeString([], opts)} – ${new Date(endMs).toLocaleTimeString([], opts)}`
}
