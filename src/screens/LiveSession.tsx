import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BodyZoneDiagram } from '../components/BodyZoneDiagram'
import { SectionListEditor } from '../components/SectionListEditor'
import { SectionTimeline } from '../components/SectionTimeline'
import { TimerDial } from '../components/TimerDial'
import { playSessionEndChime, stopSessionEndChime } from '../lib/chime'
import { isGamepadSupported } from '../lib/gamepad'
import { startMappedGamepadBridge } from '../lib/gamepadMapping'
import { remoteController } from '../lib/remote'
import { formatClock, sessionDurationSec } from '../lib/time'
import { acquireWakeLock, reacquireOnVisible, releaseWakeLock } from '../lib/wakeLock'
import { getPractitionerPin, setPractitionerPin, verifyPractitionerPin } from '../lib/practitionerPin'
import { useAppState } from '../state/AppStateContext'
import type { ClientOuttake } from '../types'

const QUICK_ADJUST_SEC = 60
const COMPLETED_SESSION_KEY = 'liveprac:v1:completedSession'

function completedSessionId(): string | null {
  try {
    return localStorage.getItem(COMPLETED_SESSION_KEY)
  } catch {
    return null
  }
}

function rememberCompletedSession(instanceId: string | null) {
  try {
    if (instanceId) localStorage.setItem(COMPLETED_SESSION_KEY, instanceId)
    else localStorage.removeItem(COMPLETED_SESSION_KEY)
  } catch {
    // The completion screen still works for this visit if storage is unavailable.
  }
}

export function LiveSession() {
  const {
    activeSession,
    templates,
    clients,
    events,
    advanceSection,
    endSession,
    extendCurrentSection,
    updateRuntimeSections,
    logPreferenceEvent,
    pushAmbientCue,
    sessionNotes,
    sessionRecords,
    setSessionNote,
    recordActiveSessionCompletion,
    setSessionOuttake,
    saveActiveSessionAsClientPlan,
  } = useAppState()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [editingPlan, setEditingPlan] = useState(false)
  const [showController, setShowController] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(
    () => Boolean(activeSession && completedSessionId() === activeSession.instanceId),
  )
  const [completionView, setCompletionView] = useState<'choice' | 'setup' | 'outtake' | 'thanks' | 'unlock' | 'closeout'>('choice')
  const [returnPin, setReturnPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [outtakePressure, setOuttakePressure] = useState<ClientOuttake['pressure']>(null)
  const [outtakeHighlight, setOuttakeHighlight] = useState('')
  const [outtakeNextFocus, setOuttakeNextFocus] = useState('')
  const [planSaved, setPlanSaved] = useState(false)
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  const cuedSectionRef = useRef<number | null>(null)
  const warnedSectionRef = useRef<number | null>(null)

  const completeSession = useCallback(() => {
    if (!activeSession || sessionEnded) return
    setSessionEnded(true)
    recordActiveSessionCompletion()
    rememberCompletedSession(activeSession.instanceId)
    playSessionEndChime()
  }, [activeSession, recordActiveSessionCompletion, sessionEnded])
  useEffect(() => {
    cuedSectionRef.current = null
    warnedSectionRef.current = null
  }, [activeSession?.instanceId, activeSession?.currentSectionIndex])

  const template = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined
  const section = activeSession ? activeSession.sections[activeSession.currentSectionIndex] : undefined
  const nextSection = activeSession ? activeSession.sections[activeSession.currentSectionIndex + 1] : undefined

  const sectionNow = now
  const sectionRemainingSec =
    activeSession && section
      ? section.durationSec - (sectionNow - activeSession.sectionStartedAt) / 1000
      : 0
  const warningSec = section ? Math.min(120, Math.max(60, section.durationSec * 0.25)) : 60

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return remoteController.onEvent((event) => {
      if (event.type === 'press' && event.kind === 'single') logPreferenceEvent('flagged')
      if (event.type === 'press' && event.kind === 'long') logPreferenceEvent('loved')
      if (event.type === 'dial') {
        logPreferenceEvent(event.delta > 0 ? 'pressure_up' : 'pressure_down', Math.abs(event.delta))
      }
    })
  }, [logPreferenceEvent])

  // Heads-up while there's still time to finish the stroke, not just at zero.
  useEffect(() => {
    if (!activeSession || !section) return
    if (sectionRemainingSec > warningSec || sectionRemainingSec <= 0) return
    if (warnedSectionRef.current === activeSession.currentSectionIndex) return
    warnedSectionRef.current = activeSession.currentSectionIndex
    pushAmbientCue({
      kind: 'timer',
      tone: 'next',
      message: nextSection ? `Coming up: ${nextSection.name}` : 'Session ending soon',
    })
  }, [activeSession, section, sectionRemainingSec, warningSec, nextSection, pushAmbientCue])

  useEffect(() => {
    if (!activeSession) return
    const fixedTotal = activeSession.plannedDurationSec
      ?? activeSession.sections.reduce((sum, item) => sum + item.durationSec, 0)
    const appointmentRemaining = activeSession.started
      ? fixedTotal - (now - activeSession.startedAt) / 1000
      : fixedTotal
    if (activeSession.started && appointmentRemaining <= 0) {
      completeSession()
      return
    }
    if (sectionRemainingSec > 0) return
    if (cuedSectionRef.current === activeSession.currentSectionIndex) return
    cuedSectionRef.current = activeSession.currentSectionIndex
    if (nextSection) {
      pushAmbientCue({ kind: 'timer', tone: 'next', message: `Now: ${nextSection.name}` })
      advanceSection()
    } else {
      // Last section ran out — stop the clock and hand off to the closing
      // screen instead of letting it count into overtime unattended.
      completeSession()
    }
  }, [activeSession, now, sectionRemainingSec, nextSection, pushAmbientCue, advanceSection, completeSession])

  // Safety net: never leave the chime playing after leaving this screen.
  useEffect(() => () => stopSessionEndChime(), [])

  // Keeps the screen (and the BLE remote's connection) alive for the whole
  // appointment — a backgrounded/locked screen is the single biggest cause
  // of a dropped remote over a long shift.
  useEffect(() => {
    if (!activeSession) return
    void acquireWakeLock()
    const stopReacquire = reacquireOnVisible()
    return () => {
      stopReacquire()
      releaseWakeLock()
    }
  }, [activeSession?.instanceId])

  // Some remotes (this pad included) pair through the OS's Bluetooth
  // settings and only show up to the page as a "gamepad" — see gamepad.ts.
  // Always listening for the whole session rather than a manual toggle,
  // since it idles harmlessly (via requestAnimationFrame) when nothing's
  // connected and dispatches whatever's mapped in Settings once one is.
  useEffect(() => {
    if (!activeSession) return
    return startMappedGamepadBridge()
  }, [activeSession?.instanceId])

  if (!activeSession) {
    navigate('/')
    return null
  }

  if (!template || !section) {
    endSession()
    navigate('/')
    return null
  }

  const client = clients.find((c) => c.id === activeSession.clientId)
  const totalDuration = activeSession.plannedDurationSec ?? sessionDurationSec(template.sections)
  const endsAt = new Date(activeSession.startedAt + totalDuration * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
  // The appointment clock is the source of truth. A section can pause, but
  // once Begin is pressed the agreed end time never moves.
  const sessionRemainingSec = activeSession.started
    ? totalDuration - (now - activeSession.startedAt) / 1000
    : totalDuration
  const displayedSectionRemainingSec = Math.min(sectionRemainingSec, sessionRemainingSec)
  const availableFollowingSec = activeSession.sections
    .slice(activeSession.currentSectionIndex + 1)
    .reduce((sum, upcoming) => sum + Math.max(0, upcoming.durationSec), 0)

  const currentSectionEvents = events.filter(
    (e) => e.sessionInstanceId === activeSession.instanceId && e.sectionId === section.id,
  )
  const netPressure = currentSectionEvents.reduce((sum, e) => {
    if (e.type === 'pressure_up') return sum + e.magnitude
    if (e.type === 'pressure_down') return sum - e.magnitude
    return sum
  }, 0)

  // Where each signal landed within the current section, for the ring markers.
  // Signals of the same type landing within ~2% of the ring collapse into one
  // marker, so a burst of dial turns doesn't pile up in the same spot.
  const dialMarkers = Object.values(
    currentSectionEvents.reduce<Record<string, { id: string; type: typeof currentSectionEvents[number]['type']; fraction: number }>>(
      (acc, e) => {
        const fraction = Math.min(
          1,
          Math.max(0, (e.timestamp - activeSession.sectionStartedAt) / 1000 / section.durationSec),
        )
        const key = `${e.type}:${Math.round(fraction * 50)}`
        if (!acc[key]) acc[key] = { id: e.id, type: e.type, fraction }
        return acc
      },
      {},
    ),
  )

  if (editingPlan) {
    return (
      <div className="session-editor-page flex h-full flex-col gap-4 overflow-y-auto sm:gap-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="page-title">Edit Plan</h1>
          <p className="text-sm text-neutral-500">Changes apply to this session only</p>
        </header>
        <SectionListEditor
          sections={activeSession.sections}
          onChange={updateRuntimeSections}
          preserveTotal
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditingPlan(false)}
            className="rounded-full bg-accent-500 px-5 py-2 text-sm font-medium text-white"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  if (sessionEnded) {
    const sessionEvents = events.filter((e) => e.sessionInstanceId === activeSession.instanceId)
    const lovedCount = sessionEvents.filter((e) => e.type === 'loved').length
    const pressureNet = sessionEvents.reduce((sum, event) => event.type === 'pressure_up' ? sum + event.magnitude : event.type === 'pressure_down' ? sum - event.magnitude : sum, 0)
    const note = sessionNotes.find((item) => item.sessionInstanceId === activeSession.instanceId)?.text ?? ''
    const completedRecord = sessionRecords.find((item) => item.id === activeSession.instanceId)

    function finishAndReturn() {
      stopSessionEndChime()
      rememberCompletedSession(null)
      endSession()
      navigate('/')
    }

    if (completionView === 'setup') {
      return (
        <div key={completionView} className="session-complete">
          <div className="completion-card client-handoff-card">
            <p className="completion-step">Client checkout · Secure handoff</p>
            <p className="section-label">Before handing over the iPad</p>
            <h1 className="mt-2 text-3xl font-light text-neutral-100">Set a practitioner PIN</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">The client will stay inside checkout mode until this four-digit PIN is entered.</p>
            <input value={returnPin} onChange={(event) => setReturnPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" aria-label="New practitioner PIN" placeholder="4-digit PIN" className="client-pin-input" />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCompletionView('choice')} className="secondary-action">Back</button>
              <button type="button" disabled={returnPin.length !== 4} onClick={() => { if (setPractitionerPin(returnPin)) { setReturnPin(''); setCompletionView('outtake') } }} className="primary-action">Enter client mode</button>
            </div>
          </div>
        </div>
      )
    }

    if (completionView === 'outtake') {
      return (
        <div key={completionView} className="session-complete">
          <div className="completion-card client-checkout-card">
            <p className="completion-step">Client checkout</p>
            <p className="section-label">Quick checkout</p>
            <h1 className="mt-2 text-3xl font-light text-neutral-100">How did that feel?</h1>
            <div className="mt-6">
              <p className="launchpad-label">Overall pressure</p>
              <div className="segmented">
                {(['lighter', 'right', 'firmer'] as const).map((value) => <button key={value} type="button" onClick={() => setOuttakePressure(value)} className={outtakePressure === value ? 'selected' : ''}>{value === 'right' ? 'Just right' : value}</button>)}
              </div>
            </div>
            <label className="mt-4 block">
              <span className="launchpad-label">What felt especially helpful?</span>
              <textarea value={outtakeHighlight} onChange={(event) => setOuttakeHighlight(event.target.value)} rows={2} className="closeout-textarea" />
            </label>
            <label className="mt-4 block">
              <span className="launchpad-label">Anything to focus on next time?</span>
              <textarea value={outtakeNextFocus} onChange={(event) => setOuttakeNextFocus(event.target.value)} rows={2} className="closeout-textarea" />
            </label>
            <button type="button" onClick={() => { setSessionOuttake(activeSession.instanceId, { pressure: outtakePressure, highlight: outtakeHighlight, nextFocus: outtakeNextFocus }); setCompletionView('thanks') }} className="primary-action mt-6 w-full">Save feedback</button>
          </div>
        </div>
      )
    }

    if (completionView === 'thanks' || completionView === 'unlock') {
      return (
        <div key={completionView} className="session-complete">
          <div className="completion-card client-handoff-card text-center">
            {completionView === 'thanks' ? (
              <>
                <p className="section-label">Complete</p>
                <h1 className="mt-3 text-3xl font-light text-neutral-100">Thank you</h1>
                <p className="mt-2 text-neutral-500">Your feedback has been saved.</p>
                <button type="button" onClick={() => setCompletionView('unlock')} className="secondary-action client-mode-return">Return to practitioner</button>
              </>
            ) : (
              <>
                <p className="section-label">Practitioner access</p>
                <h1 className="mt-3 text-2xl font-light text-neutral-100">Enter your PIN to continue</h1>
                <input value={returnPin} onChange={(event) => { setReturnPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(false) }} inputMode="numeric" aria-label="Practitioner PIN" placeholder="PIN" className="client-pin-input" />
                {pinError && <p className="mt-2 text-sm text-red-400" role="alert">Incorrect PIN</p>}
                <div className="mt-5 flex justify-center gap-2">
                  <button type="button" onClick={() => { setReturnPin(''); setPinError(false); setCompletionView('thanks') }} className="secondary-action">Back</button>
                  <button type="button" disabled={returnPin.length !== 4} onClick={() => { if (verifyPractitionerPin(returnPin)) setCompletionView('closeout'); else setPinError(true) }} className="primary-action">Unlock</button>
                </div>
              </>
            )}
          </div>
        </div>
      )
    }

    if (completionView === 'closeout') {
      return (
        <div key={completionView} className="session-complete">
          <div className="completion-card practitioner-closeout">
            <p className="section-label">Practitioner closeout</p>
            <h1 className="mt-2 text-3xl font-light text-neutral-100">Notes for next time</h1>
            <div className="closeout-summary">
              <span>{template.name}</span>
              <span>{sessionEvents.length} signals</span>
              {pressureNet !== 0 && <span>{pressureNet > 0 ? '+' : ''}{pressureNet} pressure</span>}
              {lovedCount > 0 && <span>{lovedCount} loved</span>}
            </div>
            {completedRecord && (
              <div className="allocation-summary">
                <p className="launchpad-label">Planned → actual</p>
                {completedRecord.plannedSections.map((planned, index) => (
                  <div key={planned.id}>
                    <span>{planned.name}</span>
                    <strong>{Math.round(planned.durationSec / 60)}m → {Math.round((completedRecord.actualSections[index]?.durationSec ?? 0) / 60)}m</strong>
                  </div>
                ))}
              </div>
            )}
            <textarea value={note} onChange={(event) => setSessionNote(activeSession.instanceId, event.target.value)} placeholder="What should you remember before the next visit?" rows={5} className="closeout-textarea mt-4" />
            {client && (
              <button type="button" onClick={() => { saveActiveSessionAsClientPlan(); setPlanSaved(true) }} className={`mt-3 w-full rounded-xl border px-4 py-3 text-sm ${planSaved ? 'border-accent-500/50 bg-accent-500/10 text-accent-200' : 'border-neutral-700 text-neutral-300'}`}>
                {planSaved ? 'Saved as client plan' : 'Save today’s plan for next time'}
              </button>
            )}
            <button type="button" onClick={finishAndReturn} className="primary-action mt-3 w-full">Finish</button>
          </div>
        </div>
      )
    }

    return (
      <div key={completionView} className="session-complete text-center">
        <div className="completion-choice">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent-400">Session complete</p>
          <h1 className="mt-3 text-3xl font-light text-neutral-100 sm:text-4xl">
            {template.name}
            {client ? ` · ${client.name}` : ''}
          </h1>
          {lovedCount > 0 && (
            <p className="mt-2 text-neutral-500">
              {lovedCount} moment{lovedCount === 1 ? '' : 's'} marked loved
            </p>
          )}
          <div className="completion-choice-actions">
            {client && <button type="button" onClick={() => setCompletionView(getPractitionerPin() ? 'outtake' : 'setup')} className="primary-action px-7 py-3 text-base">Hand to client</button>}
            <button type="button" onClick={() => setCompletionView('closeout')} className="secondary-action px-7 py-3 text-base">Add practitioner notes</button>
          </div>
          <button type="button" onClick={finishAndReturn} className="mt-5 text-sm text-neutral-600">Finish without notes</button>
        </div>
      </div>
    )
  }

  return (
    <div className="session-page flex flex-col gap-3 sm:gap-5">
      <header className="session-header flex min-w-0 items-center justify-between gap-3">
        <div className="session-identity min-w-0">
          <p className="truncate text-sm text-neutral-500 sm:text-base">
            {template.name}{client ? ` · ${client.name}` : ''}
          </p>
          <span className="session-ends">Ends {endsAt}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Controller controls"
            title="Controller controls"
            aria-expanded={showController}
            onClick={() => setShowController((value) => !value)}
            className="session-controller flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 transition-colors hover:border-accent-500/70 hover:text-accent-200"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <path d="M7.5 8h9a3.5 3.5 0 0 1 3.4 4.35l-.9 3.6a2 2 0 0 1-3.65.55l-1.1-1.7h-4.5l-1.1 1.7a2 2 0 0 1-3.65-.55l-.9-3.6A3.5 3.5 0 0 1 7.5 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M8 11.5v3M6.5 13h3M15.5 12.2h.01M17.5 14.2h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="End session"
            title="End session"
            onClick={() => {
              setConfirmingEnd(true)
            }}
            className="session-end-x flex h-11 w-11 items-center justify-center rounded-full border border-red-900/50 text-red-400/70 transition-colors hover:border-red-500/60 hover:text-red-300"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div
        key={activeSession.currentSectionIndex}
        className="session-stage grid items-center gap-6"
      >
        <div className="session-dial-column flex flex-col items-center">
          <div className="session-dial-with-adjustments">
            <button
              type="button"
              aria-label="Remove one minute from this section"
              title="Remove one minute"
              disabled={sectionRemainingSec <= QUICK_ADJUST_SEC}
              onClick={() => extendCurrentSection(-QUICK_ADJUST_SEC)}
              className="dial-adjust dial-adjust-minus"
            >
              −
            </button>
            <TimerDial
              sizePx={350}
              remainingFraction={displayedSectionRemainingSec / section.durationSec}
              sessionFraction={sessionRemainingSec / totalDuration}
              over={displayedSectionRemainingSec < 0}
              sessionOver={sessionRemainingSec < 0}
              strokeWidth={12}
              markers={dialMarkers}
            >
              <BodyZoneDiagram activeZone={section.bodyZone} size={42} />
              <span className="mt-1 max-w-60 text-center text-lg font-semibold text-accent-200">
                {section.name}
              </span>
              <span
                className={`session-primary-time mt-1 font-mono tabular-nums ${
                  displayedSectionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-50'
                }`}
              >
                {displayedSectionRemainingSec < 0 ? '+' : ''}
                {formatClock(Math.abs(displayedSectionRemainingSec))}
              </span>
            </TimerDial>
            <button
              type="button"
              aria-label="Add one minute to this section"
              title="Add one minute"
              disabled={availableFollowingSec <= 0}
              onClick={() => extendCurrentSection(QUICK_ADJUST_SEC)}
              className="dial-adjust dial-adjust-plus"
            >
              +
            </button>
          </div>
          {/* Outside the dial's own circle on purpose — text inside the ring
              scales with the SVG geometry, but this caption is plain HTML
              and doesn't, so at a small rendered dial size it used to spill
              past the ring and overlap the stroke. Living below the dial, it
              can never collide with it at any size. */}
          <div className="session-remaining mt-2 flex flex-col items-center gap-0.5 text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-[0.14em]">Session</span>
            <span
              className={`font-mono text-xl leading-none tabular-nums sm:text-2xl ${
                sessionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-400'
              }`}
            >
              {sessionRemainingSec < 0 ? '+' : ''}
              {formatClock(Math.abs(sessionRemainingSec))}
            </span>
          </div>
          <div className={`pressure-slot flex items-center justify-center ${netPressure === 0 ? 'empty' : ''}`}>
            <PressureReadout net={netPressure} />
          </div>
        </div>

        {/* Keep the two actions used during treatment beside the timer. */}
        <div className="session-controls flex flex-col items-stretch gap-3">
          {section.notes?.trim() && <SectionNotes notes={section.notes} />}
          <button
            type="button"
            onClick={() => {
              if (nextSection) advanceSection()
              else setConfirmingEnd(true)
            }}
            className="session-next rounded-full bg-accent-500 px-7 py-4 text-xl font-medium text-white disabled:opacity-30"
          >
            {nextSection ? 'Next Section' : 'Finish Session'}
          </button>
        </div>
      </div>

      <div className="session-timeline-row">
        <SectionTimeline
          sections={activeSession.sections}
          currentIndex={activeSession.currentSectionIndex}
          approaching={Boolean(activeSession.started && displayedSectionRemainingSec <= warningSec)}
        />
        <button
          type="button"
          onClick={() => setEditingPlan(true)}
          aria-label="Edit session plan"
          title="Edit plan"
          className="timeline-edit-button"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
            <path d="M4 20h4.1L19 9.1a2.1 2.1 0 0 0 0-3L17.9 5a2.1 2.1 0 0 0-3 0L4 15.9V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m13.5 6.4 4.1 4.1" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>

      {showController && (
        <div className="session-more-panel flex flex-wrap justify-center gap-3">
          <button type="button" className="secondary-action" onClick={() => setShowController(false)}>Close</button>
          <RemoteSimulator />
        </div>
      )}

      {confirmingEnd && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
            <p className="section-label">End session</p>
            <h2 id="end-session-title" className="mt-2 text-2xl font-light text-neutral-100">Finish before the scheduled end time?</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">Recorded feedback will be kept and you can still complete client checkout and practitioner notes.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmingEnd(false)} className="secondary-action">Keep session running</button>
              <button type="button" onClick={() => { setConfirmingEnd(false); completeSession() }} className="rounded-full border border-red-800/70 bg-red-950/35 px-5 py-2 text-sm font-medium text-red-200">End session now</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function SectionNotes({ notes }: { notes: string }) {
  const items = notes
    .split(/\n+/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean)

  if (!items.length) return null

  return (
    <aside className="section-notes" aria-label="Section notes">
      <div className="section-notes-heading">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
          <path d="M6 3.5h9l3 3V20.5H6v-17Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M15 3.5v3h3M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span>Notes</span>
      </div>
      <ul>
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </aside>
  )
}

function PressureReadout({ net }: { net: number }) {
  if (net === 0) return null
  const up = net > 0
  return (
    <span
      className={`mt-1 text-center font-mono text-lg font-semibold tabular-nums ${
        up ? 'text-orange-300' : 'text-sky-300'
      }`}
    >
      {up ? '+' : ''}{net} pressure
    </span>
  )
}

/**
 * Stands in for the physical Bluetooth remote until that hardware and its
 * native wrapper exist (see src/lib/remote.ts). Fires the same event shapes
 * a real dial/button would, so this panel can just be deleted later. The
 * game controller itself is always listening for the whole session (see the
 * effect above) — this panel is just the manual on-screen fallback plus a
 * reminder of the controller mapping.
 */
function RemoteSimulator() {
  // Collapsed by default so the session screen fits without scrolling; this
  // whole panel goes away once real hardware exists.
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto rounded-full border border-dashed border-neutral-800 px-4 py-1 text-sm text-neutral-600"
      >
        Test controls
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-600"
        >
          Remote simulator — hide
        </button>
        {isGamepadSupported() && (
          <span className="rounded-full border border-accent-500/50 px-3 py-1 text-xs text-accent-300">
            Game controller: listening
          </span>
        )}
      </div>
      {isGamepadSupported() && (
        <p className="mb-3 text-xs text-neutral-600">
          Controls are whatever's mapped in Settings → Game Controller. Nothing mapped yet? Head
          there to teach it.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => remoteController.simulate({ type: 'dial', delta: 1 })}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300"
        >
          Dial: more pressure
        </button>
        <button
          type="button"
          onClick={() => remoteController.simulate({ type: 'dial', delta: -1 })}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300"
        >
          Dial: less pressure
        </button>
        <button
          type="button"
          onClick={() => remoteController.simulate({ type: 'press', kind: 'long' })}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300"
        >
          Long-press: loved it
        </button>
        <button
          type="button"
          onClick={() => remoteController.simulate({ type: 'press', kind: 'single' })}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300"
        >
          Click: flag
        </button>
      </div>
    </div>
  )
}
