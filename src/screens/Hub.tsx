import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { RemoteStatusPill } from '../components/RemoteStatusPill'
import { TodaysAppointments } from '../components/TodaysAppointments'
import { primeCueAudio } from '../lib/cueSound'
import { sessionDurationSec } from '../lib/time'
import { isVisible } from '../lib/visibility'
import { useAppState } from '../state/AppStateContext'

export function Hub() {
  const { templates, clients, addClient, startSession, activeSession } = useAppState()
  const navigate = useNavigate()
  const [pickingTemplateId, setPickingTemplateId] = useState<string | null>(null)
  const [newClientName, setNewClientName] = useState('')

  // Straight back into a running session — reopening the app mid-massage
  // shouldn't cost a tap. "End" on the session screen is the way out.
  if (activeSession) return <Navigate to="/session" replace />

  function beginWith(clientId: string | null) {
    if (!pickingTemplateId) return
    void primeCueAudio()
    startSession(pickingTemplateId, clientId)
    navigate('/session')
  }

  return (
    <div className="page-stack">
      {isVisible('remoteStatus') && <RemoteStatusPill />}

      {isVisible('appointments') && <TodaysAppointments />}

      <section className="flex flex-col gap-3">
        <h2 className="section-label">Start a session</h2>
        {templates.length === 0 && (
          <p className="empty-state">
            No routines yet. Create one in Routines.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setPickingTemplateId(template.id)}
              className="surface-card surface-card-interactive group p-5 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg text-neutral-100">{template.name}</p>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" className="mt-1 shrink-0 text-neutral-700 group-hover:text-accent-400" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {template.sections.length} sections · {Math.round(sessionDurationSec(template.sections) / 60)} min
              </p>
            </button>
          ))}
        </div>
      </section>

      {pickingTemplateId && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="start-session-title">
            <h3 id="start-session-title" className="mb-4 text-lg text-neutral-100">Who is this session for?</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => beginWith(null)}
                className="rounded-lg border border-neutral-800 px-4 py-2 text-left text-neutral-300 hover:border-accent-500/40"
              >
                Walk-in / no profile
              </button>
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => beginWith(client.id)}
                  className="rounded-lg border border-neutral-800 px-4 py-2 text-left text-neutral-300 hover:border-accent-500/40"
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
                  const client = addClient(newClientName.trim())
                  setNewClientName('')
                  beginWith(client.id)
                }}
                className="primary-action disabled:opacity-40"
              >
                Add & start
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPickingTemplateId(null)}
              className="mt-4 w-full text-center text-sm text-neutral-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
