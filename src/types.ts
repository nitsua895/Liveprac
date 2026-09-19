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
  /** Fixed appointment length. Section edits and pauses redistribute within it. */
  plannedDurationSec?: number
  currentSectionIndex: number
  sectionStartedAt: number
  paused: boolean
  pausedAt: number | null
}

/** Drives the glow colour, so the kind of alert reads peripherally without being read. */
export type CueTone = 'pressure' | 'love' | 'flag' | 'next'

export interface AmbientCue {
  id: string
  kind: 'preference' | 'timer'
  tone: CueTone
  message: string
  createdAt: number
  /** Repeats of the same signal fold into one cue rather than queueing up. */
  count: number
}
