import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { RemoteStatusPill } from '../components/RemoteStatusPill'
import { TodaysAppointments } from '../components/TodaysAppointments'
import { primeCueAudio } from '../lib/cueSound'
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
    <div className="hub-home flex flex-col gap-6 sm:gap-8">
      <header>
        <h1 className="text-2xl font-light text-neutral-200">Liveprac</h1>
      </header>

      <RemoteStatusPill />

      <TodaysAppointments />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Start a session</h2>
        {templates.length === 0 && (
          <p className="text-neutral-500">
            No session templates yet. Create one in Build.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setPickingTemplateId(template.id)}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-left transition-colors hover:border-accent-500/40"
            >
              <p className="text-lg text-neutral-100">{template.name}</p>
              <p className="mt-1 text-sm text-neutral-500">
                {template.sections.length} sections
              </p>
            </button>
          ))}
        </div>
      </section>

      {pickingTemplateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-6">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-6">
            <h3 className="mb-4 text-lg text-neutral-100">Who is this session for?</h3>
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
                className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
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
