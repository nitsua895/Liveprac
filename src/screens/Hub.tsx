import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BodyZoneDiagram } from '../components/BodyZoneDiagram'
import { RemoteStatusPill } from '../components/RemoteStatusPill'
import { TodaysAppointments } from '../components/TodaysAppointments'
import { bluetoothRemote, type BleStatus } from '../lib/bluetoothRemote'
import { BODY_ZONE_LABELS } from '../lib/bodyZones'
import { pressureInsights } from '../lib/clientInsights'
import { getCueSoundMode, primeCueAudio } from '../lib/cueSound'
import { sessionDurationSec } from '../lib/time'
import { isVisible } from '../lib/visibility'
import { isWakeLockSupported } from '../lib/wakeLock'
import { useAppState } from '../state/AppStateContext'

export function Hub() {
  const {
    templates, clients, events, sessionNotes, addClient, updateClient, startSession, activeSession,
  } = useAppState()
  const navigate = useNavigate()
  const [pickingTemplateId, setPickingTemplateId] = useState<string | null>(null)
  // undefined = choosing; null = walk-in; string = selected client.
  const [launchClientId, setLaunchClientId] = useState<string | null | undefined>(undefined)
  const [newClientName, setNewClientName] = useState('')
  const [bleStatus, setBleStatus] = useState<BleStatus>(() => bluetoothRemote.getStatus())
  const [remoteBattery, setRemoteBattery] = useState<number | null>(() => bluetoothRemote.getBattery())
  const [gamepadConnected, setGamepadConnected] = useState(false)

  useEffect(() => {
    const offStatus = bluetoothRemote.onStatusChange(setBleStatus)
    const offBattery = bluetoothRemote.onBatteryChange(setRemoteBattery)
    const refreshGamepad = () => setGamepadConnected(Boolean(
      navigator.getGamepads?.().find((pad) => pad?.connected),
    ))
    refreshGamepad()
    window.addEventListener('gamepadconnected', refreshGamepad)
    window.addEventListener('gamepaddisconnected', refreshGamepad)
    const interval = window.setInterval(refreshGamepad, 1000)
    return () => {
      offStatus()
      offBattery()
      window.removeEventListener('gamepadconnected', refreshGamepad)
      window.removeEventListener('gamepaddisconnected', refreshGamepad)
      window.clearInterval(interval)
    }
  }, [])

  const selectedTemplate = templates.find((template) => template.id === pickingTemplateId)
  const selectedClient = clients.find((client) => client.id === launchClientId)
  const insights = selectedClient ? pressureInsights(selectedClient.id, events, templates) : []

  const previousSessionNote = useMemo(() => {
    if (!launchClientId) return null
    const latestEventBySession = new Map<string, number>()
    events.filter((event) => event.clientId === launchClientId).forEach((event) => {
      latestEventBySession.set(
        event.sessionInstanceId,
        Math.max(latestEventBySession.get(event.sessionInstanceId) ?? 0, event.timestamp),
      )
    })
    return sessionNotes
      .filter((note) => latestEventBySession.has(note.sessionInstanceId) && note.text.trim())
      .sort((a, b) => (
        (latestEventBySession.get(b.sessionInstanceId) ?? 0)
        - (latestEventBySession.get(a.sessionInstanceId) ?? 0)
      ))[0]?.text ?? null
  }, [events, launchClientId, sessionNotes])

  if (activeSession) return <Navigate to="/session" replace />

  function closeLaunchpad() {
    setPickingTemplateId(null)
    setLaunchClientId(undefined)
    setNewClientName('')
  }

  function beginSession() {
    if (!pickingTemplateId || launchClientId === undefined) return
    void primeCueAudio()
    startSession(pickingTemplateId, launchClientId)
    navigate('/session')
  }

  const remoteConnected = bleStatus === 'connected' || gamepadConnected
  const cueMode = getCueSoundMode()

  return (
    <div className="page-stack">
      {isVisible('remoteStatus') && <RemoteStatusPill />}
      {isVisible('appointments') && <TodaysAppointments />}

      <section className="flex flex-col gap-3">
        <h2 className="section-label">Start a session</h2>
        {templates.length === 0 && <p className="empty-state">No routines yet. Create one in Routines.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                setPickingTemplateId(template.id)
                setLaunchClientId(undefined)
              }}
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

      {selectedTemplate && (
        <div className="modal-backdrop">
          <div className={`modal-card ${launchClientId !== undefined ? 'launchpad-card' : ''}`} role="dialog" aria-modal="true" aria-labelledby="start-session-title">
            {launchClientId === undefined ? (
              <>
                <h3 id="start-session-title" className="mb-1 text-lg text-neutral-100">Who is this session for?</h3>
                <p className="mb-4 text-sm text-neutral-500">{selectedTemplate.name}</p>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => setLaunchClientId(null)} className="rounded-lg border border-neutral-800 px-4 py-2 text-left text-neutral-300 hover:border-accent-500/40">
                    Walk-in / no profile
                  </button>
                  {clients.map((client) => (
                    <button key={client.id} type="button" onClick={() => setLaunchClientId(client.id)} className="rounded-lg border border-neutral-800 px-4 py-2 text-left text-neutral-300 hover:border-accent-500/40">
                      {client.name}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input value={newClientName} onChange={(event) => setNewClientName(event.target.value)} placeholder="New client name" className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-accent-500/50" />
                  <button
                    type="button"
                    disabled={!newClientName.trim()}
                    onClick={() => {
                      const client = addClient(newClientName.trim())
                      setNewClientName('')
                      setLaunchClientId(client.id)
                    }}
                    className="primary-action disabled:opacity-40"
                  >
                    Add client
                  </button>
                </div>
                <button type="button" onClick={closeLaunchpad} className="mt-4 w-full text-center text-sm text-neutral-500">Cancel</button>
              </>
            ) : (
              <>
                <header className="launchpad-header">
                  <div>
                    <p className="section-label">Ready to begin</p>
                    <h3 id="start-session-title" className="mt-1 text-2xl font-light text-neutral-100">{selectedClient?.name ?? 'Walk-in'}</h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {selectedTemplate.name} · {Math.round(sessionDurationSec(selectedTemplate.sections) / 60)} min
                    </p>
                  </div>
                  <button type="button" onClick={() => setLaunchClientId(undefined)} className="secondary-action">Change client</button>
                </header>

                {selectedClient ? (
                  <div className="launchpad-grid">
                    <LaunchField label="Relevant preferences" value={selectedClient.notes} placeholder="Communication, comfort, positioning…" onChange={(notes) => updateClient(selectedClient.id, { notes })} />
                    <LaunchField label="Planned focus areas" value={selectedClient.focusAreas ?? ''} placeholder="What matters most today…" onChange={(focusAreas) => updateClient(selectedClient.id, { focusAreas })} />
                    <LaunchField label="Contraindication reminders" value={selectedClient.contraindications ?? ''} placeholder="Areas or techniques to avoid…" onChange={(contraindications) => updateClient(selectedClient.id, { contraindications })} alert={Boolean(selectedClient.contraindications?.trim())} />
                    <div className="launchpad-panel">
                      <p className="launchpad-label">Previous session note</p>
                      <p className={previousSessionNote ? 'text-sm leading-relaxed text-neutral-300' : 'text-sm text-neutral-600'}>{previousSessionNote ?? 'No previous note yet'}</p>
                    </div>

                    <div className="launchpad-panel launchpad-span">
                      <p className="launchpad-label">Pressure by body zone</p>
                      {insights.length ? (
                        <div className="zone-insight-list">
                          {insights.map((insight) => (
                            <div key={insight.zone} className="zone-insight">
                              <BodyZoneDiagram activeZone={insight.zone} size={18} />
                              <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">{BODY_ZONE_LABELS[insight.zone]}</span>
                              <span className={`font-mono text-sm font-semibold tabular-nums ${insight.average > 0 ? 'text-orange-300' : insight.average < 0 ? 'text-sky-300' : 'text-neutral-500'}`}>
                                {insight.average > 0 ? '+' : ''}{insight.average}
                              </span>
                              <span className="text-xs text-neutral-600">{insight.sessionCount}×</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-neutral-600">No pressure history yet</p>}
                    </div>

                    <div className="launchpad-panel launchpad-span">
                      <p className="launchpad-label">Temperature preference</p>
                      <div className="flex flex-wrap gap-2">
                        {(['cooler', 'neutral', 'warmer'] as const).map((temperature) => (
                          <button
                            key={temperature}
                            type="button"
                            onClick={() => updateClient(selectedClient.id, { temperaturePreference: temperature })}
                            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${selectedClient.temperaturePreference === temperature ? 'border-accent-400/60 bg-accent-500/15 text-accent-200' : 'border-neutral-800 text-neutral-500'}`}
                          >
                            {temperature}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="launchpad-panel text-sm text-neutral-500">This session will run without a saved client profile or preference history.</p>
                )}

                <div className="readiness-row" aria-label="Session readiness">
                  <ReadinessItem ready={remoteConnected} label={remoteConnected ? 'Remote connected' : 'Remote not connected'} />
                  <ReadinessItem ready={remoteBattery === null || remoteBattery > 20} label={remoteBattery === null ? 'Battery unavailable' : `Remote battery ${remoteBattery}%`} neutral={remoteBattery === null} />
                  <ReadinessItem ready={isWakeLockSupported()} label={isWakeLockSupported() ? 'Screen awake ready' : 'Wake lock unavailable'} />
                  <ReadinessItem ready label={cueMode === 'off' ? 'Visual cues only' : cueMode === 'all' ? 'All cue sounds on' : 'Transition sounds on'} />
                </div>

                <div className="launchpad-actions">
                  <button type="button" onClick={closeLaunchpad} className="secondary-action">Cancel</button>
                  <button type="button" onClick={beginSession} className="primary-action launchpad-start">Start session</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LaunchField({ label, value, placeholder, onChange, alert = false }: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  alert?: boolean
}) {
  return (
    <label className={`launchpad-panel ${alert ? 'launchpad-alert' : ''}`}>
      <span className="launchpad-label">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={2} className="launchpad-textarea" />
    </label>
  )
}

function ReadinessItem({ ready, label, neutral = false }: { ready: boolean; label: string; neutral?: boolean }) {
  return (
    <span className={`readiness-item ${neutral ? 'neutral' : ready ? 'ready' : 'not-ready'}`}>
      <span className="readiness-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
