import { useState } from 'react'
import { formatSessionSummary } from '../lib/crm'
import { useAppState } from '../state/AppStateContext'
import type { PreferenceEvent } from '../types'

export function ClientLog() {
  const { clients, events, templates, sessionNotes, setSessionNote, setClientDefaultTemplate } = useAppState()
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients[0]?.id ?? null)
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null
  const clientEvents = selectedClientId ? events.filter((e) => e.clientId === selectedClientId) : []

  const bySession = new Map<string, PreferenceEvent[]>()
  for (const event of clientEvents) {
    const list = bySession.get(event.sessionInstanceId) ?? []
    list.push(event)
    bySession.set(event.sessionInstanceId, list)
  }
  // Most recent session first — that's the one she needs at a glance.
  const sessions = Array.from(bySession.entries()).sort(
    (a, b) => b[1][0].timestamp - a[1][0].timestamp,
  )

  const labels: Record<string, string> = {
    pressure_up: 'More pressure',
    pressure_down: 'Less pressure',
    loved: 'Loved it',
    flagged: 'Flagged',
  }

  return (
    <div className="page-stack">
      <header>
        <h1 className="page-title">Client Log</h1>
        <p className="page-subtitle mt-1">Session-to-session history at a glance, plus notes.</p>
      </header>

      {clients.length === 0 && (
        <p className="empty-state">No clients yet — they're added when you start a session.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {clients.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => setSelectedClientId(client.id)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              selectedClientId === client.id
                ? 'border-accent-500/50 bg-accent-500/10 text-accent-300'
                : 'border-neutral-800 text-neutral-400'
            }`}
          >
            {client.name}
          </button>
        ))}
      </div>

      {selectedClient && (
        <div className="flex flex-col gap-4">
          <div className="surface-card flex flex-wrap items-center justify-between gap-2 p-4">
            <span className="text-sm text-neutral-400">Usual routine</span>
            <select
              value={selectedClient.defaultTemplateId ?? ''}
              onChange={(e) => e.target.value && setClientDefaultTemplate(selectedClient.id, e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-accent-500/50"
            >
              <option value="" disabled>
                Not set — pick one
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {sessions.length === 0 && (
            <p className="text-neutral-500">No sessions logged for {selectedClient.name} yet.</p>
          )}

          {sessions.map(([instanceId, sessionEvents]) => {
            const first = sessionEvents[0]
            const template = templates.find((t) => t.sections.some((s) => s.id === first.sectionId))
            const netPressure = sessionEvents.reduce((sum, e) => {
              if (e.type === 'pressure_up') return sum + e.magnitude
              if (e.type === 'pressure_down') return sum - e.magnitude
              return sum
            }, 0)
            const lovedCount = sessionEvents.filter((e) => e.type === 'loved').length
            const flaggedCount = sessionEvents.filter((e) => e.type === 'flagged').length
            const note = sessionNotes.find((n) => n.sessionInstanceId === instanceId)?.text ?? ''
            const expanded = expandedSessionId === instanceId

            return (
              <div key={instanceId} className="surface-card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-neutral-500">
                    {new Date(first.timestamp).toLocaleDateString()}
                    {template ? ` · ${template.name}` : ''}
                  </p>
                  {template && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          formatSessionSummary(template, selectedClient, sessionEvents),
                        )
                        setCopiedSessionId(instanceId)
                        setTimeout(() => setCopiedSessionId(null), 2000)
                      }}
                      className="text-xs text-accent-400/80"
                    >
                      {copiedSessionId === instanceId ? 'Copied' : 'Copy note for CRM'}
                    </button>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  {netPressure !== 0 && (
                    <span className={`rounded-full border px-2.5 py-0.5 ${netPressure > 0 ? 'border-orange-500/30 text-orange-300' : 'border-sky-500/30 text-sky-300'}`}>
                      {netPressure > 0 ? '+' : ''}{netPressure} pressure
                    </span>
                  )}
                  {lovedCount > 0 && (
                    <span className="rounded-full border border-red-500/30 px-2.5 py-0.5 text-red-300">
                      {lovedCount} loved
                    </span>
                  )}
                  {flaggedCount > 0 && (
                    <span className="rounded-full border border-blue-500/30 px-2.5 py-0.5 text-blue-300">
                      {flaggedCount} flagged
                    </span>
                  )}
                  {netPressure === 0 && lovedCount === 0 && flaggedCount === 0 && (
                    <span className="text-neutral-600">No signals this session</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedSessionId(expanded ? null : instanceId)}
                    className="ml-auto text-xs text-neutral-600"
                  >
                    {expanded ? 'Hide by-zone detail' : 'By-zone detail'}
                  </button>
                </div>

                {expanded && (
                  <ul className="mb-3 flex flex-col gap-1 border-t border-neutral-800 pt-3">
                    {sessionEvents.map((event) => (
                      <li key={event.id} className="text-sm text-neutral-300">
                        <span className="text-neutral-500">{event.sectionName}:</span>{' '}
                        {labels[event.type] ?? event.type}
                      </li>
                    ))}
                  </ul>
                )}

                <textarea
                  value={note}
                  onChange={(e) => setSessionNote(instanceId, e.target.value)}
                  placeholder="Notes for next time…"
                  rows={2}
                  className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-relaxed text-neutral-300 outline-none placeholder:text-neutral-700 focus:border-accent-500/50"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
