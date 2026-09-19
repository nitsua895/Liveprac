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
const WARN_AHEAD_SEC = 60

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
  const warnedSectionRef = useRef<number | null>(null)

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

  // Heads-up while there's still time to finish the stroke, not just at zero.
  useEffect(() => {
    if (!activeSession || !section) return
    if (sectionRemainingSec > WARN_AHEAD_SEC || sectionRemainingSec <= 0) return
    if (section.durationSec <= WARN_AHEAD_SEC * 1.5) return
    if (warnedSectionRef.current === activeSession.currentSectionIndex) return
    warnedSectionRef.current = activeSession.currentSectionIndex
    pushAmbientCue({
      kind: 'timer',
      tone: 'next',
      message: nextSection ? `1 min → ${nextSection.name}` : '1 min left',
    })
  }, [activeSession, section, sectionRemainingSec, nextSection, pushAmbientCue])

  useEffect(() => {
    if (!activeSession || sectionRemainingSec > 0) return
    if (cuedSectionRef.current === activeSession.currentSectionIndex) return
    cuedSectionRef.current = activeSession.currentSectionIndex
    pushAmbientCue({
      kind: 'timer',
      tone: 'next',
      message: nextSection ? `Next: ${nextSection.name}` : 'Time is up',
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
            className="rounded-full bg-accent-500 px-5 py-2 text-sm font-medium text-neutral-950"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <p className="text-base text-neutral-500">
          {template.name}
          {client ? ` · ${client.name}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm uppercase tracking-wide text-neutral-600">Session</span>
          <span
            className={`font-mono text-2xl tabular-nums ${
              sessionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-400'
            }`}
          >
            {sessionRemainingSec < 0 ? '+' : ''}
            {formatClock(Math.abs(sessionRemainingSec))}
          </span>
        </div>
      </header>

      {/* Body zone beside the dial rather than stacked above it: fills the
          landscape screen and keeps everything above the fold. */}
      <div
        key={activeSession.currentSectionIndex}
        className="animate-section-enter grid grid-cols-[1fr_auto_1fr] items-center gap-6"
      >
        <div className="flex flex-col items-center gap-3">
          <BodyZoneDiagram activeZone={section.bodyZone} size={110} />
          <p className="text-center text-2xl uppercase tracking-widest text-accent-400">
            {section.name}
          </p>
        </div>

        <TimerDial
          sizePx={300}
          remainingFraction={sectionRemainingSec / section.durationSec}
          over={sectionRemainingSec < 0}
          strokeWidth={12}
        >
          <span
            className={`font-mono text-7xl tabular-nums ${
              sectionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-50'
            }`}
          >
            {formatClock(Math.abs(sectionRemainingSec))}
          </span>
          <PressureReadout net={netPressure} />
        </TimerDial>

        <div className="flex flex-col items-center gap-3">
          <NextUpCard section={nextSection} />
          <button
            type="button"
            onClick={() => extendCurrentSection(QUICK_EXTEND_SEC)}
            className="rounded-full border border-neutral-700 px-4 py-1.5 text-base text-neutral-400"
          >
            +2 min
          </button>
        </div>
      </div>

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
          className="rounded-full bg-accent-500 px-6 py-2.5 font-medium text-neutral-950 disabled:opacity-30"
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

function PressureReadout({ net }: { net: number }) {
  if (net === 0) return null
  const up = net > 0
  return (
    <span
      className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${
        up ? 'text-orange-300' : 'text-sky-300'
      }`}
    >
      {up ? '+' : ''}
      {net} pressure
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
  // Collapsed by default so the session screen fits without scrolling; this
  // whole panel goes away once real hardware exists.
  const [open, setOpen] = useState(false)
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
          className="text-xs uppercase tracking-wide text-neutral-600"
        >
          Remote simulator — hide
        </button>
        {isGamepadSupported() && (
          <button
            type="button"
            onClick={toggleGamepad}
            className={`rounded-full border px-3 py-1 text-xs ${
              gamepadOn ? 'border-accent-500/50 text-accent-300' : 'border-neutral-800 text-neutral-500'
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
