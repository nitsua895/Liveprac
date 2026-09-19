export type BodyZone =
  | 'head_scalp'
  | 'neck_shoulders'
  | 'back'
  | 'arms_hands'
  | 'legs'
  | 'feet'
  | 'none'

export interface SectionTemplate {
  id: string
  name: string
  durationSec: number
  bodyZone: BodyZone
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
  /** 1 = short rotation, 2 = medium, 3 = long. Always 1 for loved/flagged. */
  magnitude: number
}

export interface ActiveSession {
  instanceId: string
  templateId: string
  clientId: string | null
  /** Snapshot of the template's sections when the session started — edits here (Edit Plan, "+time") apply only to this run. */
  sections: SectionTemplate[]
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
