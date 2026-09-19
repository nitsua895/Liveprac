import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BodyZoneDiagram } from '../components/BodyZoneDiagram'
import { NowPlayingBar } from '../components/NowPlayingBar'
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
  const [showMore, setShowMore] = useState(false)
  const cuedSectionRef = useRef<number | null>(null)
  const warnedSectionRef = useRef<number | null>(null)
  useEffect(() => {
    cuedSectionRef.current = null
    warnedSectionRef.current = null
  }, [activeSession?.instanceId, activeSession?.currentSectionIndex])

  const template = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined
  const section = activeSession ? activeSession.sections[activeSession.currentSectionIndex] : undefined
  const nextSection = activeSession ? activeSession.sections[activeSession.currentSectionIndex + 1] : undefined

  const effectiveNow = activeSession?.paused && activeSession.pausedAt ? activeSession.pausedAt : now
  const sectionRemainingSec =
    activeSession && section
      ? section.durationSec - (effectiveNow - activeSession.sectionStartedAt) / 1000
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
    if (!activeSession || activeSession.paused || !section) return
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
    if (!activeSession || activeSession.paused || sectionRemainingSec > 0) return
    if (cuedSectionRef.current === activeSession.currentSectionIndex) return
    cuedSectionRef.current = activeSession.currentSectionIndex
    pushAmbientCue({
      kind: 'timer',
      tone: 'next',
      message: nextSection ? `Now: ${nextSection.name}` : 'Session complete',
    })
    if (nextSection) advanceSection()
  }, [activeSession, sectionRemainingSec, nextSection, pushAmbientCue, advanceSection])

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
  const sessionRemainingSec = totalDuration - (effectiveNow - activeSession.startedAt) / 1000
  const displayedSectionRemainingSec = Math.min(sectionRemainingSec, sessionRemainingSec)
  const showNext = activeSession.paused || displayedSectionRemainingSec <= warningSec
  const availableFollowingSec = activeSession.sections
    .slice(activeSession.currentSectionIndex + 1)
    .reduce((sum, upcoming) => sum + Math.max(0, upcoming.durationSec - 60), 0)

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
      <div className="flex flex-col gap-4 sm:gap-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-light text-neutral-200">Edit Plan</h1>
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
            className="rounded-full bg-accent-500 px-5 py-2 text-sm font-medium text-neutral-950"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="session-page flex flex-col gap-3 sm:gap-5">
      <header className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-neutral-500 sm:text-base">
          {template.name}
          {client ? ` · ${client.name}` : ''}
        </p>
        <div className="flex items-center gap-4">
          <span className="whitespace-nowrap font-mono text-lg tabular-nums text-neutral-500 sm:text-2xl">
            {new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <div
        key={activeSession.currentSectionIndex}
        className="session-stage grid items-center gap-6"
      >
        <div className="flex flex-col items-center">
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
            <div className="session-remaining mt-2 flex flex-col items-center gap-0.5 text-neutral-400">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Session</span>
              <span
                className={`font-mono text-xl leading-none tabular-nums sm:text-2xl ${
                  sessionRemainingSec < 0 ? 'text-red-400' : 'text-neutral-400'
                }`}
              >
                {sessionRemainingSec < 0 ? '+' : ''}
                {formatClock(Math.abs(sessionRemainingSec))}
              </span>
            </div>
          </TimerDial>
          <div className="flex h-12 items-center justify-center">
            <PressureReadout net={netPressure} />
          </div>
        </div>

        {/* Controls live beside the dial: the two used mid-session are big and
            near the timer, the rest are tucked behind "More". */}
        <div className="session-controls flex flex-col items-stretch gap-3">
          <div
            className={`mb-2 min-h-24 rounded-xl border border-neutral-800 p-4 transition-opacity duration-700 ${
              showNext ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!showNext}
          >
            <p className="text-sm text-neutral-400">
              {activeSession.paused ? 'Paused' : 'Coming up'}
            </p>
            <p className="mt-1 text-2xl font-medium text-accent-200">{nextSection?.name ?? 'Finish session'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (nextSection) advanceSection()
              else if (window.confirm('Finish this session? Recorded feedback will be kept.')) {
                endSession()
                navigate('/')
              }
            }}
            disabled={Boolean(nextSection) && activeSession.paused}
            className="rounded-full bg-accent-500 px-7 py-4 text-xl font-medium text-white disabled:opacity-30"
          >
            {nextSection ? 'Next Section' : 'Finish Session'}
          </button>
          <button
            type="button"
            onClick={togglePause}
            className="rounded-full border border-neutral-700 px-7 py-3 text-lg text-neutral-300"
          >
            {activeSession.paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => extendCurrentSection(QUICK_EXTEND_SEC)}
            disabled={availableFollowingSec <= 0}
            className="rounded-full border border-neutral-800 px-7 py-2 text-base text-neutral-400"
          >
            +2 min from next
          </button>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="text-sm text-neutral-600"
          >
            {showMore ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      <SectionTimeline
        sections={activeSession.sections}
        currentIndex={activeSession.currentSectionIndex}
      />

      {showMore && (
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={goToPreviousSection}
            disabled={activeSession.currentSectionIndex === 0}
            className="rounded-full border border-neutral-800 px-5 py-2.5 text-neutral-400 disabled:opacity-30"
          >
            Previous Section
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
              if (!window.confirm('End this session? Recorded feedback will be kept.')) return
              endSession()
              navigate('/')
            }}
            className="rounded-full border border-red-900/60 px-5 py-2.5 text-red-400/80"
          >
            End Session
          </button>
          <RemoteSimulator />
        </div>
      )}

      <NowPlayingBar compact />
    </div>
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
