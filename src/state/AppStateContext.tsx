import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loadJSON, saveJSON } from '../lib/storage'
import { getCueLabel } from '../lib/cueLabels'
import { buildDefaultTemplates, buildEightyMinuteTemplate, newSectionId, newTemplateId } from './defaultTemplates'
import type {
  ActiveSession,
  AmbientCue,
  CalendarLink,
  ClientProfile,
  CueTone,
  PreferenceEvent,
  PreferenceEventType,
  SectionTemplate,
  SessionNote,
  SessionTemplate,
} from '../types'

function remainingAppointmentSec(session: ActiveSession, now: number) {
  const total = session.plannedDurationSec
    ?? session.sections.reduce((sum, section) => sum + section.durationSec, 0)
  if (!session.started) return total
  return Math.max(0, total - (now - session.startedAt) / 1000)
}

/** Keeps each unfinished section's relative plan, then spreads any clock
 * difference evenly. This is the one rule used by pause, skip, back, and
 * manual time changes, so the appointment deadline can never move. */
function rebalanceRemainingSections(
  sections: SectionTemplate[],
  startIndex: number,
  targetSec: number,
  elapsedInFirstSec = 0,
): SectionTemplate[] {
  const next = sections.map((section) => ({ ...section }))
  const allocations = next.slice(startIndex).map((section, offset) =>
    Math.max(0, section.durationSec - (offset === 0 ? elapsedInFirstSec : 0)),
  )
  if (!allocations.length) return next

  let difference = Math.max(0, targetSec) - allocations.reduce((sum, value) => sum + value, 0)
  if (difference >= 0) {
    const share = difference / allocations.length
    allocations.forEach((value, index) => { allocations[index] = value + share })
  } else {
    let toRemove = -difference
    let adjustable = allocations.map((_, index) => index)
    while (toRemove > 0.001 && adjustable.length) {
      const share = toRemove / adjustable.length
      let removed = 0
      adjustable = adjustable.filter((index) => {
        const amount = Math.min(allocations[index], share)
        allocations[index] -= amount
        removed += amount
        return allocations[index] > 0.001
      })
      if (removed < 0.001) break
      toRemove -= removed
    }
  }

  allocations.forEach((value, offset) => {
    next[startIndex + offset].durationSec = value + (offset === 0 ? elapsedInFirstSec : 0)
  })
  return next
}

interface AppState {
  templates: SessionTemplate[]
  clients: ClientProfile[]
  events: PreferenceEvent[]
  activeSession: ActiveSession | null
  ambientCues: AmbientCue[]
  cueBump: number
  calendarLinks: CalendarLink[]
  sessionNotes: SessionNote[]

  saveTemplate: (template: SessionTemplate) => void
  deleteTemplate: (templateId: string) => void
  addClient: (name: string) => ClientProfile
  setClientLastTemplate: (clientId: string, templateId: string) => void
  deleteClient: (clientId: string) => void
  startSession: (templateId: string, clientId: string | null) => void
  advanceSection: () => void
  goToPreviousSection: () => void
  togglePause: () => void
  endSession: () => void
  extendCurrentSection: (extraSec: number) => void
  updateRuntimeSections: (sections: SectionTemplate[]) => void
  logPreferenceEvent: (type: PreferenceEventType, magnitude?: number) => void
  dismissAmbientCue: (cueId: string) => void
  pushAmbientCue: (cue: Omit<AmbientCue, 'id' | 'createdAt' | 'count'>) => void
  eventsForSession: (instanceId: string) => PreferenceEvent[]
  linkCalendarEvent: (googleEventId: string, clientId: string, templateId?: string) => void
  unlinkCalendarEvent: (googleEventId: string) => void
  setSessionNote: (sessionInstanceId: string, text: string) => void
}

const AppStateContext = createContext<AppState | null>(null)

let cueCounter = 0
function makeCueId() {
  cueCounter += 1
  return `cue_${Date.now()}_${cueCounter}`
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<SessionTemplate[]>(() =>
    loadJSON('templates', [] as SessionTemplate[]),
  )
  const [clients, setClients] = useState<ClientProfile[]>(() => loadJSON('clients', []))
  const [events, setEvents] = useState<PreferenceEvent[]>(() => loadJSON('events', []))
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => {
    const stored = loadJSON<ActiveSession | null>('activeSession', null)
    if (!stored) return null
    const now = Date.now()
    if (!stored.started) {
      return { ...stored, started: true, paused: false, pausedAt: null, startedAt: now, sectionStartedAt: now }
    }
    if (stored.paused && stored.pausedAt) {
      return { ...stored, paused: false, pausedAt: null, sectionStartedAt: stored.sectionStartedAt + now - stored.pausedAt }
    }
    return stored
  })
  const [ambientCues, setAmbientCues] = useState<AmbientCue[]>([])
  const [calendarLinks, setCalendarLinks] = useState<CalendarLink[]>(() =>
    loadJSON('calendarLinks', []),
  )
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>(() => loadJSON('sessionNotes', []))
  /** Increments on every signal, including repeats folded into an existing cue,
   *  so the glow can re-flash even when no new cue was added. */
  const [cueBump, setCueBump] = useState(0)

  useEffect(() => {
    if (templates.length === 0) {
      setTemplates(buildDefaultTemplates())
      saveJSON('seededEightyMinute', true)
      return
    }
    // One-time top-up for installs that already existed before the
    // 80-minute default was added — guarded by a flag rather than just
    // "no 80-Minute Session present" so deleting it on purpose sticks.
    if (!loadJSON('seededEightyMinute', false)) {
      setTemplates((prev) => [...prev, buildEightyMinuteTemplate()])
      saveJSON('seededEightyMinute', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => saveJSON('templates', templates), [templates])
  useEffect(() => saveJSON('clients', clients), [clients])
  useEffect(() => saveJSON('events', events), [events])
  useEffect(() => saveJSON('activeSession', activeSession), [activeSession])
  useEffect(() => saveJSON('calendarLinks', calendarLinks), [calendarLinks])
  useEffect(() => saveJSON('sessionNotes', sessionNotes), [sessionNotes])

  function saveTemplate(template: SessionTemplate) {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === template.id)
      return exists ? prev.map((t) => (t.id === template.id ? template : t)) : [...prev, template]
    })
  }

  function deleteTemplate(templateId: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId))
  }

  function addClient(name: string): ClientProfile {
    const client: ClientProfile = {
      id: newTemplateId(),
      name,
      notes: '',
      createdAt: Date.now(),
    }
    setClients((prev) => [...prev, client])
    return client
  }

  function setClientLastTemplate(clientId: string, templateId: string) {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, lastTemplateId: templateId } : c)))
  }

  function deleteClient(clientId: string) {
    const orphanedInstanceIds = new Set(
      events.filter((e) => e.clientId === clientId).map((e) => e.sessionInstanceId),
    )
    setClients((prev) => prev.filter((c) => c.id !== clientId))
    setEvents((prev) => prev.filter((e) => e.clientId !== clientId))
    setSessionNotes((prev) => prev.filter((n) => !orphanedInstanceIds.has(n.sessionInstanceId)))
    setCalendarLinks((prev) => prev.filter((l) => l.clientId !== clientId))
  }

  function startSession(templateId: string, clientId: string | null) {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    const now = Date.now()
    setActiveSession({
      instanceId: newSectionId(),
      templateId,
      clientId,
      sections: template.sections.map((s) => ({ ...s })),
      startedAt: now,
      plannedDurationSec: template.sections.reduce((sum, section) => sum + section.durationSec, 0),
      currentSectionIndex: 0,
      sectionStartedAt: now,
      // A session starts as soon as the client is selected. Its end time is
      // fixed from this moment onward.
      paused: false,
      pausedAt: null,
      started: true,
    })
    setAmbientCues([])
    // Whatever routine actually got used — updates every time, since it
    // commonly changes (50 minutes one week, 30 the next).
    if (clientId) setClientLastTemplate(clientId, templateId)
  }

  function advanceSection() {
    setActiveSession((prev) => {
      if (!prev) return prev
      const nextIndex = prev.currentSectionIndex + 1
      if (nextIndex >= prev.sections.length) {
        return prev
      }
      const transitionAt = Date.now()
      const current = prev.sections[prev.currentSectionIndex]
      const sectionClockAt = prev.pausedAt ?? transitionAt
      const elapsedSec = Math.max(0, (sectionClockAt - prev.sectionStartedAt) / 1000)
      const sections = prev.sections.map((section) => ({ ...section }))
      sections[prev.currentSectionIndex].durationSec = Math.min(current.durationSec, elapsedSec)
      const balanced = rebalanceRemainingSections(
        sections,
        nextIndex,
        remainingAppointmentSec(prev, transitionAt),
      )
      return { ...prev, sections: balanced, currentSectionIndex: nextIndex, sectionStartedAt: transitionAt, pausedAt: prev.paused ? transitionAt : null }
    })
  }

  function extendCurrentSection(extraSec: number) {
    setActiveSession((prev) => {
      if (!prev) return prev
      const now = Date.now()
      const sectionClockAt = prev.pausedAt ?? now
      const elapsedSec = Math.max(0, (sectionClockAt - prev.sectionStartedAt) / 1000)
      let sections = rebalanceRemainingSections(
        prev.sections,
        prev.currentSectionIndex,
        remainingAppointmentSec(prev, now),
        elapsedSec,
      )
      if (extraSec > 0) {
        const followingTotal = sections.slice(prev.currentSectionIndex + 1)
          .reduce((sum, section) => sum + section.durationSec, 0)
        const moved = Math.min(extraSec, followingTotal)
        sections[prev.currentSectionIndex].durationSec += moved
        sections = rebalanceRemainingSections(
          sections,
          prev.currentSectionIndex + 1,
          followingTotal - moved,
        )
      } else if (extraSec < 0) {
        const current = sections[prev.currentSectionIndex]
        const released = Math.min(Math.max(0, current.durationSec - elapsedSec), -extraSec)
        current.durationSec -= released
        const nextIndex = prev.currentSectionIndex + 1
        const followingTotal = sections.slice(nextIndex).reduce((sum, section) => sum + section.durationSec, 0)
        sections = rebalanceRemainingSections(sections, nextIndex, followingTotal + released)
      }
      return { ...prev, sections }
    })
  }

  function updateRuntimeSections(sections: SectionTemplate[]) {
    setActiveSession((prev) => {
      if (!prev) return prev
      const activeId = prev.sections[prev.currentSectionIndex]?.id
      const currentSectionIndex = Math.max(0, sections.findIndex((section) => section.id === activeId))
      if (!prev.started) return { ...prev, sections, currentSectionIndex }
      const now = Date.now()
      const sectionClockAt = prev.pausedAt ?? now
      const elapsedSec = Math.max(0, (sectionClockAt - prev.sectionStartedAt) / 1000)
      return {
        ...prev,
        sections: rebalanceRemainingSections(
          sections,
          currentSectionIndex,
          remainingAppointmentSec(prev, now),
          elapsedSec,
        ),
        currentSectionIndex,
      }
    })
  }

  function goToPreviousSection() {
    setActiveSession((prev) => {
      if (!prev || prev.currentSectionIndex === 0) return prev
      const now = Date.now()
      const currentSectionIndex = prev.currentSectionIndex - 1
      return {
        ...prev,
        sections: rebalanceRemainingSections(
          prev.sections,
          currentSectionIndex,
          remainingAppointmentSec(prev, now),
        ),
        currentSectionIndex,
        sectionStartedAt: now,
        pausedAt: prev.paused ? now : null,
      }
    })
  }

  function togglePause() {
    setActiveSession((prev) => {
      if (!prev) return prev
      if (prev.paused) {
        // Preparing the room is not appointment time. Start both clocks only
        // when Begin is pressed; subsequent pauses keep the original deadline.
        if (!prev.started) {
          const now = Date.now()
          return { ...prev, started: true, paused: false, pausedAt: null, startedAt: now, sectionStartedAt: now }
        }
        const now = Date.now()
        const pausedMs = prev.pausedAt ? now - prev.pausedAt : 0
        const elapsedSec = Math.max(0, ((prev.pausedAt ?? now) - prev.sectionStartedAt) / 1000)
        const sections = rebalanceRemainingSections(
          prev.sections,
          prev.currentSectionIndex,
          remainingAppointmentSec(prev, now),
          elapsedSec,
        )
        return {
          ...prev,
          sections,
          paused: false,
          pausedAt: null,
          started: true,
          sectionStartedAt: prev.sectionStartedAt + pausedMs,
        }
      }
      return { ...prev, paused: true, pausedAt: Date.now() }
    })
  }

  function endSession() {
    setActiveSession(null)
    setAmbientCues([])
  }

  // Repeats of the same signal fold into the existing cue instead of stacking:
  // a client turning the dial up five times is one request, not five
  // notifications to tap away.
  function pushAmbientCue(cue: Omit<AmbientCue, 'id' | 'createdAt' | 'count'>) {
    setCueBump((n) => n + 1)
    setAmbientCues((prev) => {
      const match = prev.find((c) => c.tone === cue.tone && c.message === cue.message)
      if (match) {
        return [
          ...prev.filter((c) => c.id !== match.id),
          { ...match, count: match.count + 1, createdAt: Date.now() },
        ]
      }
      return [...prev, { ...cue, id: makeCueId(), createdAt: Date.now(), count: 1 }]
    })
  }

  function dismissAmbientCue(cueId: string) {
    setAmbientCues((prev) => prev.filter((c) => c.id !== cueId))
  }

  // Reads activeSession directly rather than through a setActiveSession
  // updater: updaters must be pure, and doing the logging inside one made React
  // run it twice, double-counting every signal.
  function logPreferenceEvent(type: PreferenceEventType, magnitude = 1) {
    if (!activeSession) return
    const section = activeSession.sections[activeSession.currentSectionIndex]
    if (!section) return

    const event: PreferenceEvent = {
      id: makeCueId(),
      timestamp: Date.now(),
      sessionInstanceId: activeSession.instanceId,
      clientId: activeSession.clientId,
      sectionId: section.id,
      sectionName: section.name,
      type,
      magnitude,
    }
    setEvents((prev) => [...prev, event])

    // Tone is fixed per signal (drives the glow color); the message text is
    // customizable in Settings and kept short on purpose — read at a glance
    // from across the table, not studied.
    const tones: Record<PreferenceEventType, CueTone> = {
      pressure_up: 'pressure',
      pressure_down: 'pressure',
      loved: 'love',
      flagged: 'flag',
    }
    pushAmbientCue({ kind: 'preference', tone: tones[type], message: getCueLabel(type) })
  }

  function eventsForSession(instanceId: string) {
    return events.filter((e) => e.sessionInstanceId === instanceId)
  }

  function linkCalendarEvent(googleEventId: string, clientId: string, templateId?: string) {
    setCalendarLinks((prev) => [
      ...prev.filter((link) => link.googleEventId !== googleEventId),
      { googleEventId, clientId, templateId },
    ])
  }

  function unlinkCalendarEvent(googleEventId: string) {
    setCalendarLinks((prev) => prev.filter((link) => link.googleEventId !== googleEventId))
  }

  function setSessionNote(sessionInstanceId: string, text: string) {
    setSessionNotes((prev) => {
      const rest = prev.filter((n) => n.sessionInstanceId !== sessionInstanceId)
      return text.trim() ? [...rest, { sessionInstanceId, text }] : rest
    })
  }

  const value = useMemo<AppState>(
    () => ({
      templates,
      clients,
      events,
      activeSession,
      ambientCues,
      cueBump,
      calendarLinks,
      sessionNotes,
      saveTemplate,
      deleteTemplate,
      addClient,
      setClientLastTemplate,
      deleteClient,
      startSession,
      advanceSection,
      goToPreviousSection,
      togglePause,
      endSession,
      extendCurrentSection,
      updateRuntimeSections,
      logPreferenceEvent,
      dismissAmbientCue,
      pushAmbientCue,
      eventsForSession,
      linkCalendarEvent,
      unlinkCalendarEvent,
      setSessionNote,
    }),
    [templates, clients, events, activeSession, ambientCues, cueBump, calendarLinks, sessionNotes],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
