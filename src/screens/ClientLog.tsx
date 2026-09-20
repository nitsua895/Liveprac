import { useState } from 'react'
import { formatSessionSummary } from '../lib/crm'
import { useAppState } from '../state/AppStateContext'

export function ClientLog() {
  const { clients, events, templates } = useAppState()
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients[0]?.id ?? null)
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null)

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null
  const clientEvents = selectedClientId ? events.filter((e) => e.clientId === selectedClientId) : []

  const bySession = new Map<string, typeof clientEvents>()
  for (const event of clientEvents) {
    const list = bySession.get(event.sessionInstanceId) ?? []
    list.push(event)
    bySession.set(event.sessionInstanceId, list)
  }

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
        <p className="page-subtitle mt-1">A quiet record of the feedback captured during sessions.</p>
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
          {clientEvents.length === 0 && (
            <p className="text-neutral-500">No preference signals logged for {selectedClient.name} yet.</p>
          )}
          {Array.from(bySession.entries()).map(([instanceId, sessionEvents]) => {
            const first = sessionEvents[0]
            const template = templates.find((t) =>
              t.sections.some((s) => s.id === first.sectionId),
            )
            return (
              <div key={instanceId} className="surface-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-neutral-500">
                    {new Date(first.timestamp).toLocaleDateString()}
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
                <ul className="flex flex-col gap-1">
                  {sessionEvents.map((event) => (
                    <li key={event.id} className="text-sm text-neutral-300">
                      <span className="text-neutral-500">{event.sectionName}:</span>{' '}
                      {labels[event.type] ?? event.type}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
