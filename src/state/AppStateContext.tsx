import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loadJSON, saveJSON } from '../lib/storage'
import { buildDefaultTemplates, newSectionId, newTemplateId } from './defaultTemplates'
import type {
  ActiveSession,
  AmbientCue,
  ClientProfile,
  CueTone,
  PreferenceEvent,
  PreferenceEventType,
  SectionTemplate,
  SessionTemplate,
} from '../types'

const MIN_SECTION_SEC = 60

function takeFromFollowingSections(
  sections: SectionTemplate[],
  currentIndex: number,
  requestedSec: number,
): { sections: SectionTemplate[]; takenSec: number } {
  const next = sections.map((section) => ({ ...section }))
  let remaining = Math.max(0, requestedSec)
  for (let index = currentIndex + 1; index < next.length && remaining > 0; index += 1) {
    const available = Math.max(0, next[index].durationSec - MIN_SECTION_SEC)
    const taken = Math.min(available, remaining)
    next[index].durationSec -= taken
    remaining -= taken
  }
  return { sections: next, takenSec: requestedSec - remaining }
}

interface AppState {
  templates: SessionTemplate[]
  clients: ClientProfile[]
  events: PreferenceEvent[]
  activeSession: ActiveSession | null
  ambientCues: AmbientCue[]
  cueBump: number

  saveTemplate: (template: SessionTemplate) => void
  deleteTemplate: (templateId: string) => void
  addClient: (name: string) => ClientProfile
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
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() =>
    loadJSON('activeSession', null),
  )
  const [ambientCues, setAmbientCues] = useState<AmbientCue[]>([])
  /** Increments on every signal, including repeats folded into an existing cue,
   *  so the glow can re-flash even when no new cue was added. */
  const [cueBump, setCueBump] = useState(0)

  useEffect(() => {
    if (templates.length === 0) {
      setTemplates(buildDefaultTemplates())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => saveJSON('templates', templates), [templates])
  useEffect(() => saveJSON('clients', clients), [clients])
  useEffect(() => saveJSON('events', events), [events])
  useEffect(() => saveJSON('activeSession', activeSession), [activeSession])

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
      paused: false,
      pausedAt: null,
    })
    setAmbientCues([])
  }

  function advanceSection() {
    setActiveSession((prev) => {
      if (!prev) return prev
      const nextIndex = prev.currentSectionIndex + 1
      if (nextIndex >= prev.sections.length) {
        return prev
      }
      const transitionAt = prev.pausedAt ?? Date.now()
      const current = prev.sections[prev.currentSectionIndex]
      const elapsedSec = Math.max(0, (transitionAt - prev.sectionStartedAt) / 1000)
      const unusedSec = Math.max(0, current.durationSec - elapsedSec)
      const sections = prev.sections.map((section) => ({ ...section }))
      sections[prev.currentSectionIndex].durationSec = Math.min(current.durationSec, elapsedSec)
      sections[nextIndex].durationSec += unusedSec
      return { ...prev, sections, currentSectionIndex: nextIndex, sectionStartedAt: transitionAt }
    })
  }

  function extendCurrentSection(extraSec: number) {
    setActiveSession((prev) => {
      if (!prev) return prev
      let sections = prev.sections.map((section) => ({ ...section }))
      if (extraSec > 0) {
        const result = takeFromFollowingSections(sections, prev.currentSectionIndex, extraSec)
        sections = result.sections
        sections[prev.currentSectionIndex].durationSec += result.takenSec
      } else if (extraSec < 0) {
        const current = sections[prev.currentSectionIndex]
        const released = Math.min(Math.max(0, current.durationSec - MIN_SECTION_SEC), -extraSec)
        current.durationSec -= released
        const receiver = sections[prev.currentSectionIndex + 1]
        if (receiver) receiver.durationSec += released
      }
      return { ...prev, sections }
    })
  }

  function updateRuntimeSections(sections: SectionTemplate[]) {
    setActiveSession((prev) => (prev ? { ...prev, sections } : prev))
  }

  function goToPreviousSection() {
    setActiveSession((prev) => {
      if (!prev || prev.currentSectionIndex === 0) return prev
      return {
        ...prev,
        currentSectionIndex: prev.currentSectionIndex - 1,
        sectionStartedAt: prev.pausedAt ?? Date.now(),
      }
    })
  }

  function togglePause() {
    setActiveSession((prev) => {
      if (!prev) return prev
      if (prev.paused) {
        const pausedMs = prev.pausedAt ? Date.now() - prev.pausedAt : 0
        const result = takeFromFollowingSections(
          prev.sections,
          prev.currentSectionIndex,
          pausedMs / 1000,
        )
        return {
          ...prev,
          sections: result.sections,
          paused: false,
          pausedAt: null,
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

    // Kept short on purpose — these are read at a glance from across the
    // table, not studied.
    const cues: Record<PreferenceEventType, { message: string; tone: CueTone }> = {
      pressure_up: { message: 'More pressure', tone: 'pressure' },
      pressure_down: { message: 'Less pressure', tone: 'pressure' },
      loved: { message: 'Loved this', tone: 'love' },
      flagged: { message: 'Not a fan', tone: 'flag' },
    }
    pushAmbientCue({ kind: 'preference', ...cues[type] })
  }

  function eventsForSession(instanceId: string) {
    return events.filter((e) => e.sessionInstanceId === instanceId)
  }

  const value = useMemo<AppState>(
    () => ({
      templates,
      clients,
      events,
      activeSession,
      ambientCues,
      cueBump,
      saveTemplate,
      deleteTemplate,
      addClient,
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
    }),
    [templates, clients, events, activeSession, ambientCues, cueBump],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
