import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionTimeline } from '../components/SectionTimeline'
import { remoteController } from '../lib/remote'
import { formatClock, sessionDurationSec } from '../lib/time'
import { useAppState } from '../state/AppStateContext'

export function LiveSession() {
  const { activeSession, templates, clients, advanceSection, goToPreviousSection, togglePause, endSession, logPreferenceEvent, pushAmbientCue } =
    useAppState()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const cuedSectionRef = useRef<number | null>(null)

  const template = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined
  const section = template && activeSession ? template.sections[activeSession.currentSectionIndex] : undefined
  const nextSection =
    template && activeSession ? template.sections[activeSession.currentSectionIndex + 1] : undefined

  const effectiveNow =
    activeSession?.paused && activeSession.pausedAt ? activeSession.pausedAt : now
  const sectionRemainingSec =
    activeSession && section
      ? section.durationSec - (effectiveNow - activeSession.sectionStartedAt) / 1000
      : 0

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return remoteController.onEvent((event) => {
      if (event.type === 'press' && event.kind === 'single') logPreferenceEvent('flagged')
      if (event.type === 'press' && event.kind === 'long') logPreferenceEvent('loved')
      if (event.type === 'dial') logPreferenceEvent(event.delta > 0 ? 'pressure_up' : 'pressure_down')
    })
  }, [logPreferenceEvent])

  useEffect(() => {
    if (!activeSession || sectionRemainingSec > 0) return
    if (cuedSectionRef.current === activeSession.currentSectionIndex) return
    cuedSectionRef.current = activeSession.currentSectionIndex
    pushAmbientCue({
      kind: 'timer',
      message: nextSection ? `Time to move on — next: ${nextSection.name}` : 'Final section time is up',
    })
  }, [activeSession, sectionRemainingSec, nextSection, pushAmbientCue])

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
  const totalDuration = sessionDurationSec(template.sections)
  const sessionRemainingSec = totalDuration - (effectiveNow - activeSession.startedAt) / 1000

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center justify-between text-sm text-neutral-500">
        <span>{template.name}{client ? ` · ${client.name}` : ''}</span>
        <span className={sessionRemainingSec < 0 ? 'text-red-400' : ''}>
          {sessionRemainingSec < 0 ? 'over by ' : ''}
          {formatClock(Math.abs(sessionRemainingSec))} session
        </span>
      </header>

      <div className="flex flex-col items-center gap-3 py-10">
        <p className="text-lg uppercase tracking-widest text-amber-400/80">{section.name}</p>
        <p
          className={`font-mono text-8xl tabular-nums ${
            sectionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-100'
          }`}
        >
          {formatClock(Math.abs(sectionRemainingSec))}
        </p>
        {nextSection && <p className="text-neutral-600">Up next: {nextSection.name}</p>}
      </div>

      <SectionTimeline sections={template.sections} currentIndex={activeSession.currentSectionIndex} />

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={goToPreviousSection}
          disabled={activeSession.currentSectionIndex === 0}
          className="rounded-full border border-neutral-800 px-5 py-2.5 text-neutral-400 disabled:opacity-30"
        >
          Back
        </button>
        <button
          type="button"
          onClick={togglePause}
          className="rounded-full border border-neutral-800 px-5 py-2.5 text-neutral-400"
        >
          {activeSession.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={advanceSection}
          disabled={!nextSection}
          className="rounded-full bg-amber-500 px-6 py-2.5 font-medium text-neutral-950 disabled:opacity-30"
        >
          Next Section
        </button>
        <button
          type="button"
          onClick={() => {
            endSession()
            navigate('/')
          }}
          className="rounded-full border border-red-900/60 px-5 py-2.5 text-red-400/80"
        >
          End
        </button>
      </div>

      <RemoteSimulator />
    </div>
  )
}

/**
 * Stands in for the physical Bluetooth remote until that hardware and its
 * native wrapper exist (see src/lib/remote.ts). Fires the same event shapes
 * a real dial/button would, so this panel can just be deleted later.
 */
function RemoteSimulator() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-800 p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-neutral-600">
        Remote simulator (no hardware paired yet)
      </p>
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
