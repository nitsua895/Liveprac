import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BodyZoneDiagram } from '../components/BodyZoneDiagram'
import { NextUpCard } from '../components/NextUpCard'
import { SectionListEditor } from '../components/SectionListEditor'
import { SectionTimeline } from '../components/SectionTimeline'
import { TimerDial } from '../components/TimerDial'
import { isGamepadSupported, startGamepadBridge } from '../lib/gamepad'
import { remoteController } from '../lib/remote'
import { formatClock, sessionDurationSec } from '../lib/time'
import { useAppState } from '../state/AppStateContext'

const QUICK_EXTEND_SEC = 2 * 60

export function LiveSession() {
  const {
    activeSession,
    templates,
    clients,
    events,
    advanceSection,
    goToPreviousSection,
    togglePause,
    endSession,
    extendCurrentSection,
    updateRuntimeSections,
    logPreferenceEvent,
    pushAmbientCue,
  } = useAppState()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [editingPlan, setEditingPlan] = useState(false)
  const cuedSectionRef = useRef<number | null>(null)

  const template = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined
  const section = activeSession ? activeSession.sections[activeSession.currentSectionIndex] : undefined
  const nextSection = activeSession ? activeSession.sections[activeSession.currentSectionIndex + 1] : undefined

  const effectiveNow = activeSession?.paused && activeSession.pausedAt ? activeSession.pausedAt : now
  const sectionRemainingSec =
    activeSession && section
      ? section.durationSec - (effectiveNow - activeSession.sectionStartedAt) / 1000
      : 0

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
  const totalDuration = sessionDurationSec(activeSession.sections)
  const sessionRemainingSec = totalDuration - (effectiveNow - activeSession.startedAt) / 1000

  const currentSectionEvents = events.filter(
    (e) => e.sessionInstanceId === activeSession.instanceId && e.sectionId === section.id,
  )
  const netPressure = currentSectionEvents.reduce((sum, e) => {
    if (e.type === 'pressure_up') return sum + e.magnitude
    if (e.type === 'pressure_down') return sum - e.magnitude
    return sum
  }, 0)

  if (editingPlan) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-light text-neutral-200">Edit Plan</h1>
          <p className="text-sm text-neutral-500">Changes apply to this session only</p>
        </header>
        <SectionListEditor sections={activeSession.sections} onChange={updateRuntimeSections} />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditingPlan(false)}
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-neutral-950"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <p className="pt-2 text-sm text-neutral-500">
          {template.name}
          {client ? ` · ${client.name}` : ''}
        </p>
        <TimerDial
          sizePx={64}
          remainingFraction={sessionRemainingSec / totalDuration}
          over={sessionRemainingSec < 0}
          strokeWidth={4}
        >
          <span className="text-[9px] uppercase tracking-wide text-neutral-500">Session</span>
          <span className={`font-mono text-xs ${sessionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-300'}`}>
            {formatClock(Math.abs(sessionRemainingSec))}
          </span>
        </TimerDial>
      </header>

      <div
        key={activeSession.currentSectionIndex}
        className="animate-section-enter flex flex-col items-center gap-3"
      >
        <BodyZoneDiagram activeZone={section.bodyZone} size={80} />
        <p className="text-lg uppercase tracking-widest text-amber-400/80">{section.name}</p>
        <TimerDial
          sizePx={280}
          remainingFraction={sectionRemainingSec / section.durationSec}
          over={sectionRemainingSec < 0}
          strokeWidth={10}
        >
          <span
            className={`font-mono text-6xl tabular-nums ${
              sectionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-100'
            }`}
          >
            {formatClock(Math.abs(sectionRemainingSec))}
          </span>
        </TimerDial>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => extendCurrentSection(QUICK_EXTEND_SEC)}
            className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-400"
          >
            +2 min
          </button>
          <PressurePill net={netPressure} />
        </div>
      </div>

      <NextUpCard section={nextSection} />

      <SectionTimeline sections={activeSession.sections} currentIndex={activeSession.currentSectionIndex} />

      <div className="flex flex-wrap justify-center gap-3">
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
          onClick={() => setEditingPlan(true)}
          className="rounded-full border border-neutral-800 px-5 py-2.5 text-neutral-400"
        >
          Edit Plan
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

function PressurePill({ net }: { net: number }) {
  if (net === 0) {
    return (
      <span className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-600">
        Pressure: no change
      </span>
    )
  }
  const up = net > 0
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        up ? 'border-amber-500/40 text-amber-300' : 'border-sky-500/40 text-sky-300'
      }`}
    >
      Pressure {up ? '+' : ''}
      {net}
    </span>
  )
}

/**
 * Stands in for the physical Bluetooth remote until that hardware and its
 * native wrapper exist (see src/lib/remote.ts). Fires the same event shapes
 * a real dial/button would, so this panel can just be deleted later.
 */
function RemoteSimulator() {
  const [gamepadOn, setGamepadOn] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  function toggleGamepad() {
    if (gamepadOn) {
      stopRef.current?.()
      stopRef.current = null
      setGamepadOn(false)
    } else {
      stopRef.current = startGamepadBridge()
      setGamepadOn(true)
    }
  }

  useEffect(() => () => stopRef.current?.(), [])

  return (
    <div className="rounded-xl border border-dashed border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-neutral-600">
          Remote simulator (no hardware paired yet)
        </p>
        {isGamepadSupported() && (
          <button
            type="button"
            onClick={toggleGamepad}
            className={`rounded-full border px-3 py-1 text-xs ${
              gamepadOn ? 'border-amber-500/50 text-amber-300' : 'border-neutral-800 text-neutral-500'
            }`}
          >
            {gamepadOn ? 'Game controller: on' : 'Use game controller'}
          </button>
        )}
      </div>
      {gamepadOn && (
        <p className="mb-3 text-xs text-neutral-600">
          Left stick up/down = pressure (hold longer for a bigger nudge). Button A/Cross = tap to flag, hold to
          mark loved.
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
