import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { BodyZoneDiagram } from '../components/BodyZoneDiagram'
import { RemoteStatusPill } from '../components/RemoteStatusPill'
import { TodaysAppointments } from '../components/TodaysAppointments'
import { bluetoothRemote, type BleStatus } from '../lib/bluetoothRemote'
import { BODY_ZONE_LABELS, BODY_ZONES } from '../lib/bodyZones'
import { pressureInsights } from '../lib/clientInsights'
import { getCueSoundMode, primeCueAudio } from '../lib/cueSound'
import { sessionDurationSec } from '../lib/time'
import { isVisible } from '../lib/visibility'
import { isWakeLockSupported } from '../lib/wakeLock'
import { getPractitionerPin, setPractitionerPin, verifyPractitionerPin } from '../lib/practitionerPin'
import { useAppState } from '../state/AppStateContext'
import type { ClientProfile } from '../types'

export function Hub() {
  const {
    templates, clients, events, sessionNotes, addClient, updateClient, startSession, activeSession,
  } = useAppState()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pickingTemplateId, setPickingTemplateId] = useState<string | null>(null)
  // undefined = choosing; null = walk-in; string = selected client.
  const [launchClientId, setLaunchClientId] = useState<string | null | undefined>(undefined)
  const [newClientName, setNewClientName] = useState('')
  const [bleStatus, setBleStatus] = useState<BleStatus>(() => bluetoothRemote.getStatus())
  const [remoteBattery, setRemoteBattery] = useState<number | null>(() => bluetoothRemote.getBattery())
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [showClientIntake, setShowClientIntake] = useState(false)

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

  useEffect(() => {
    const templateId = searchParams.get('template')
    const clientId = searchParams.get('client')
    if (!templateId || !templates.some((template) => template.id === templateId)) return
    setPickingTemplateId(templateId)
    setLaunchClientId(clientId && clients.some((client) => client.id === clientId) ? clientId : null)
  }, [clients, searchParams, templates])

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
    setShowClientIntake(false)
    setSearchParams({})
  }

  function beginSession() {
    if (!pickingTemplateId || launchClientId === undefined) return
    void primeCueAudio()
    const planSections = selectedClient?.plan?.sourceTemplateId === pickingTemplateId
      ? selectedClient.plan.sections
      : undefined
    startSession(pickingTemplateId, launchClientId, planSections)
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
            {showClientIntake && selectedClient ? (
              <ClientIntakePanel
                client={selectedClient}
                onUpdate={(changes) => updateClient(selectedClient.id, changes)}
                onClose={() => setShowClientIntake(false)}
              />
            ) : launchClientId === undefined ? (
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

                {selectedClient && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-950/35 px-3 py-2">
                    <p className="text-sm text-neutral-500">
                      {selectedClient.intakeCompletedAt ? 'Client intake on file' : 'No client intake yet'}
                      {selectedClient.plan?.sourceTemplateId === selectedTemplate.id ? ' · Using client plan' : ' · Using base routine'}
                    </p>
                    <button type="button" onClick={() => setShowClientIntake(true)} className="text-sm text-accent-300">
                      {selectedClient.intakeCompletedAt ? 'Update intake' : 'Hand to client'}
                    </button>
                  </div>
                )}

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

function ClientIntakePanel({ client, onUpdate, onClose }: {
  client: ClientProfile
  onUpdate: (changes: Partial<Pick<ClientProfile, 'notes' | 'focusAreas' | 'contraindications' | 'temperaturePreference' | 'communicationPreference' | 'statedPressure' | 'intakeCompletedAt'>>) => void
  onClose: () => void
}) {
  const [stage, setStage] = useState<'setup' | 'form' | 'thanks' | 'unlock'>(() => getPractitionerPin() ? 'form' : 'setup')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [preferences, setPreferences] = useState(client.notes)
  const [focus, setFocus] = useState(client.focusAreas ?? '')
  const [avoid, setAvoid] = useState(client.contraindications ?? '')
  const [temperature, setTemperature] = useState(client.temperaturePreference ?? 'neutral')
  const [communication, setCommunication] = useState(client.communicationPreference ?? 'quiet')
  const [pressure, setPressure] = useState<NonNullable<ClientProfile['statedPressure']>>(() => {
    if (client.statedPressure) return client.statedPressure
    return Object.fromEntries(
      BODY_ZONES.filter((zone) => zone !== 'none').map((zone) => [zone, 'moderate']),
    ) as NonNullable<ClientProfile['statedPressure']>
  })

  if (stage === 'setup') {
    return (
      <div className="client-mode-setup">
        <p className="section-label">Before handing over the iPad</p>
        <h3 className="mt-2 text-2xl font-light text-neutral-100">Set a practitioner PIN</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
          This four-digit screen lock keeps the client inside intake mode. It is a privacy curtain on this iPad, not encrypted account security.
        </p>
        <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="off" aria-label="New practitioner PIN" placeholder="4-digit PIN" className="client-pin-input" />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="secondary-action">Cancel</button>
          <button type="button" disabled={pin.length !== 4} onClick={() => { if (setPractitionerPin(pin)) { setPin(''); setStage('form') } }} className="primary-action">Enter client mode</button>
        </div>
      </div>
    )
  }

  if (stage === 'thanks') {
    return (
      <div className="client-mode-complete">
        <p className="section-label">All set</p>
        <h3 className="mt-3 text-3xl font-light text-neutral-100">Thank you, {client.name}</h3>
        <p className="mt-2 text-neutral-500">Your practitioner will take it from here.</p>
        <button type="button" onClick={() => setStage('unlock')} className="mt-10 text-sm text-neutral-700">Practitioner</button>
      </div>
    )
  }

  if (stage === 'unlock') {
    return (
      <div className="client-mode-complete">
        <p className="section-label">Practitioner access</p>
        <input value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(false) }} inputMode="numeric" autoComplete="off" aria-label="Practitioner PIN" placeholder="PIN" className="client-pin-input" />
        {pinError && <p className="mt-2 text-sm text-red-400">Incorrect PIN</p>}
        <button type="button" disabled={pin.length !== 4} onClick={() => { if (verifyPractitionerPin(pin)) onClose(); else setPinError(true) }} className="primary-action mt-5">Unlock</button>
      </div>
    )
  }

  const zones = BODY_ZONES.filter((zone) => zone !== 'none')
  return (
    <div className="client-intake">
      <p className="section-label">Welcome, {client.name}</p>
      <h3 className="mt-2 text-2xl font-light text-neutral-100">What would help you feel comfortable today?</h3>
      <div className="client-intake-grid">
        <LaunchField label="Areas to focus" value={focus} placeholder="Shoulders, lower back…" onChange={setFocus} />
        <LaunchField label="Areas or techniques to avoid" value={avoid} placeholder="Injuries, sensitivities…" onChange={setAvoid} alert={Boolean(avoid.trim())} />
        <LaunchField label="Anything else to know" value={preferences} placeholder="Positioning, comfort, communication…" onChange={setPreferences} />
        <div className="launchpad-panel">
          <p className="launchpad-label">Room temperature</p>
          <Segmented values={['cooler', 'neutral', 'warmer']} value={temperature} onChange={(value) => setTemperature(value as NonNullable<ClientProfile['temperaturePreference']>)} />
        </div>
        <div className="launchpad-panel launchpad-span">
          <p className="launchpad-label">Communication</p>
          <Segmented values={['quiet', 'check_ins', 'collaborative']} labels={['Mostly quiet', 'Occasional check-ins', 'Collaborative']} value={communication} onChange={(value) => setCommunication(value as NonNullable<ClientProfile['communicationPreference']>)} />
        </div>
        <div className="launchpad-panel launchpad-span">
          <p className="launchpad-label">Pressure by area</p>
          <div className="intake-pressure-grid">
            {zones.map((zone) => (
              <div key={zone} className="intake-pressure-row">
                <span>{BODY_ZONE_LABELS[zone]}</span>
                <Segmented values={['lighter', 'moderate', 'firmer']} value={pressure[zone] ?? 'moderate'} onChange={(value) => setPressure((current) => ({ ...current, [zone]: value as 'lighter' | 'moderate' | 'firmer' }))} compact />
              </div>
            ))}
          </div>
        </div>
      </div>
      <button type="button" onClick={() => { onUpdate({ notes: preferences, focusAreas: focus, contraindications: avoid, temperaturePreference: temperature, communicationPreference: communication, statedPressure: pressure, intakeCompletedAt: Date.now() }); setStage('thanks') }} className="primary-action mt-5 w-full">Submit intake</button>
    </div>
  )
}

function Segmented({ values, labels, value, onChange, compact = false }: { values: string[]; labels?: string[]; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return (
    <div className={`segmented ${compact ? 'compact' : ''}`}>
      {values.map((item, index) => <button key={item} type="button" onClick={() => onChange(item)} className={value === item ? 'selected' : ''}>{labels?.[index] ?? item.replace('_', ' ')}</button>)}
    </div>
  )
}
