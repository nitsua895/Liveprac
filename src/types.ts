export interface SectionTemplate {
  id: string
  name: string
  durationSec: number
}

export interface SessionTemplate {
  id: string
  name: string
  sections: SectionTemplate[]
  createdAt: number
}

export interface ClientProfile {
  id: string
  name: string
  notes: string
  createdAt: number
}

export type PreferenceEventType = 'pressure_up' | 'pressure_down' | 'loved' | 'flagged'

export interface PreferenceEvent {
  id: string
  timestamp: number
  sessionInstanceId: string
  clientId: string | null
  sectionId: string
  sectionName: string
  type: PreferenceEventType
}

export interface ActiveSession {
  instanceId: string
  templateId: string
  clientId: string | null
  startedAt: number
  currentSectionIndex: number
  sectionStartedAt: number
  paused: boolean
  pausedAt: number | null
}

export interface AmbientCue {
  id: string
  kind: 'preference' | 'timer'
  message: string
  createdAt: number
}
