import { useState } from 'react'
import { BodyZoneDiagram } from '../components/BodyZoneDiagram'
import { BODY_ZONE_LABELS, BODY_ZONES } from '../lib/bodyZones'
import { pressureInsights } from '../lib/clientInsights'
import { formatSessionSummary, OUTTAKE_PRESSURE_LABELS } from '../lib/crm'
import { formatClock } from '../lib/time'
import { useAppState } from '../state/AppStateContext'
import type { SessionRecord } from '../types'

const EVENT_LABELS = {
  pressure_up: 'More pressure',
  pressure_down: 'Less pressure',
  loved: 'Loved it',
  flagged: 'Flagged',
}

export function ClientLog() {
  const {
    clients, events, templates, sessionNotes, sessionRecords, setSessionNote,
    setClientLastTemplate, deleteClient,
  } = useAppState()
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients[0]?.id ?? null)
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

  const client = clients.find((item) => item.id === selectedClientId) ?? null
  const clientEvents = selectedClientId ? events.filter((event) => event.clientId === selectedClientId) : []
  const insights = selectedClientId ? pressureInsights(selectedClientId, events, templates) : []
  const storedRecords = selectedClientId
    ? sessionRecords.filter((record) => record.clientId === selectedClientId).sort((a, b) => b.startedAt - a.startedAt)
    : []
  const storedIds = new Set(storedRecords.map((record) => record.id))
  const legacyBySession = new Map<string, typeof clientEvents>()
  clientEvents.forEach((event) => {
    if (storedIds.has(event.sessionInstanceId)) return
    legacyBySession.set(event.sessionInstanceId, [...(legacyBySession.get(event.sessionInstanceId) ?? []), event])
  })
  const legacyRecords: SessionRecord[] = Array.from(legacyBySession.entries()).map(([id, sessionEvents]) => {
    const first = sessionEvents.sort((a, b) => a.timestamp - b.timestamp)[0]
    const template = templates.find((item) => item.sections.some((section) => section.id === first.sectionId))
    const sections = template?.sections.map((section) => ({ ...section })) ?? []
    const duration = sections.reduce((sum, section) => sum + section.durationSec, 0)
    return {
      id,
      clientId: selectedClientId,
      templateId: template?.id ?? '',
      templateName: template?.name ?? 'Past session',
      startedAt: first.timestamp,
      completedAt: sessionEvents[sessionEvents.length - 1].timestamp,
      plannedDurationSec: duration,
      plannedSections: sections,
      actualSections: sections,
    }
  })
  const records = [...storedRecords, ...legacyRecords].sort((a, b) => b.startedAt - a.startedAt)

  return (
    <div className="page-stack client-log-page">
      <header><h1 className="page-title">Client Log</h1></header>

      {clients.length === 0 && <p className="empty-state">No clients yet — they're added when you prepare a session.</p>}

      <div className="flex flex-wrap gap-2">
        {clients.map((item) => (
          <button key={item.id} type="button" onClick={() => setSelectedClientId(item.id)} className={`rounded-full border px-4 py-1.5 text-sm ${selectedClientId === item.id ? 'border-accent-500/50 bg-accent-500/10 text-accent-300' : 'border-neutral-800 text-neutral-400'}`}>
            {item.name}
          </button>
        ))}
      </div>

      {client && (
        <>
          <section className="client-profile-grid">
            <div className="surface-card p-4">
              <p className="section-label">Client snapshot</p>
              <dl className="client-facts">
                <Fact label="Temperature" value={client.temperaturePreference ?? 'Not set'} />
                <Fact label="Communication" value={client.communicationPreference?.replace('_', ' ') ?? 'Not set'} />
                <Fact label="Focus" value={client.focusAreas || 'Not set'} />
                <Fact label="Avoid" value={client.contraindications || 'None recorded'} alert={Boolean(client.contraindications)} />
              </dl>
            </div>

            <div className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-label">Client plan</p>
                  <p className="mt-2 text-neutral-200">{client.plan?.name ?? 'Using a base routine'}</p>
                  {client.plan && <p className="mt-1 text-xs text-neutral-600">Updated {new Date(client.plan.updatedAt).toLocaleDateString()}</p>}
                </div>
                <select value={client.lastTemplateId ?? ''} onChange={(event) => event.target.value && setClientLastTemplate(client.id, event.target.value)} aria-label="Default base routine" className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-accent-500/50">
                  <option value="" disabled>Choose base</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => { if (!window.confirm(`Delete ${client.name} and their entire session history? This can't be undone.`)) return; deleteClient(client.id); setSelectedClientId(null) }} className="mt-5 text-xs text-red-400/70">Delete client</button>
            </div>
          </section>

          <section className="surface-card p-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="section-label">Pressure by body zone</p>
                <p className="mt-1 text-xs text-neutral-600">Intake preference and observed average per session stay separate.</p>
              </div>
            </div>
            <div className="client-zone-grid">
              {BODY_ZONES.filter((zone) => zone !== 'none').map((zone) => {
                const observed = insights.find((item) => item.zone === zone)
                const stated = client.statedPressure?.[zone]
                return (
                  <div key={zone} className="client-zone-card">
                    <BodyZoneDiagram activeZone={zone} size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-300">{BODY_ZONE_LABELS[zone]}</p>
                      <p className="text-xs capitalize text-neutral-600">{stated ? `Intake: ${stated}` : 'No intake preference'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-semibold ${observed && observed.average > 0 ? 'text-orange-300' : observed && observed.average < 0 ? 'text-sky-300' : 'text-neutral-600'}`}>
                        {observed ? `${observed.average > 0 ? '+' : ''}${observed.average}` : '—'}
                      </p>
                      <p className="text-xs text-neutral-700">{observed ? `${observed.sessionCount} visits` : 'Observed'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="section-label">Session history</h2>
            {records.length === 0 && <p className="text-neutral-500">No completed sessions recorded for {client.name} yet.</p>}
            {records.map((record) => {
              const sessionEvents = clientEvents.filter((event) => event.sessionInstanceId === record.id).sort((a, b) => a.timestamp - b.timestamp)
              const note = sessionNotes.find((item) => item.sessionInstanceId === record.id)?.text ?? ''
              const expanded = expandedSessionId === record.id
              const template = templates.find((item) => item.id === record.templateId)
              const pressureNet = sessionEvents.reduce((sum, event) => event.type === 'pressure_up' ? sum + event.magnitude : event.type === 'pressure_down' ? sum - event.magnitude : sum, 0)
              const loved = sessionEvents.filter((event) => event.type === 'loved').length
              return (
                <article key={record.id} className="surface-card session-history-card">
                  <header className="session-history-header">
                    <div>
                      <p className="text-neutral-200">{record.templateName}</p>
                      <p className="mt-0.5 text-xs text-neutral-600">{new Date(record.startedAt).toLocaleDateString()} · {Math.round(record.plannedDurationSec / 60)} min</p>
                    </div>
                    <button type="button" onClick={() => { if (template) navigator.clipboard?.writeText(formatSessionSummary(template, client, sessionEvents)); setCopiedSessionId(record.id); setTimeout(() => setCopiedSessionId(null), 2000) }} className="text-xs text-accent-400/80">
                      {copiedSessionId === record.id ? 'Copied' : 'Copy summary'}
                    </button>
                  </header>
                  <div className="session-history-signals">
                    <span>{sessionEvents.length} signals</span>
                    {pressureNet !== 0 && <span className={pressureNet > 0 ? 'text-orange-300' : 'text-sky-300'}>{pressureNet > 0 ? '+' : ''}{pressureNet} pressure</span>}
                    {loved > 0 && <span className="text-red-300">{loved} loved</span>}
                    {record.outtake?.pressure && <span>Checkout: {OUTTAKE_PRESSURE_LABELS[record.outtake.pressure]}</span>}
                    <button type="button" onClick={() => setExpandedSessionId(expanded ? null : record.id)} className="ml-auto text-xs text-neutral-500">{expanded ? 'Hide timeline' : 'View timeline'}</button>
                  </div>
                  {expanded && (
                    <div className="event-timeline">
                      <div className="allocation-summary compact">
                        <p className="launchpad-label">Planned → actual</p>
                        {record.plannedSections.map((planned, index) => (
                          <div key={planned.id}>
                            <span>{planned.name}</span>
                            <strong>{Math.round(planned.durationSec / 60)}m → {Math.round((record.actualSections[index]?.durationSec ?? 0) / 60)}m</strong>
                          </div>
                        ))}
                      </div>
                      {sessionEvents.length === 0 && <p className="text-sm text-neutral-600">No remote signals during this session.</p>}
                      {sessionEvents.map((event) => (
                        <div key={event.id} className="event-timeline-item">
                          <time>{formatClock((event.timestamp - record.startedAt) / 1000)}</time>
                          <span className="event-timeline-dot" />
                          <p><span>{event.bodyZone ? BODY_ZONE_LABELS[event.bodyZone] : event.sectionName}</span> · {EVENT_LABELS[event.type]}</p>
                        </div>
                      ))}
                      {record.outtake?.highlight && <div className="event-outtake"><span>Client highlight</span>{record.outtake.highlight}</div>}
                      {record.outtake?.nextFocus && <div className="event-outtake"><span>Next focus</span>{record.outtake.nextFocus}</div>}
                    </div>
                  )}
                  <textarea value={note} onChange={(event) => setSessionNote(record.id, event.target.value)} placeholder="Notes for next time…" rows={2} className="closeout-textarea mt-3" />
                </article>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}

function Fact({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={alert ? 'text-red-300/90' : ''}>{value}</dd>
    </div>
  )
}
