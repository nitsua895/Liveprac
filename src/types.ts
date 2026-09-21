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
  /** Optional glanceable practitioner cues, one bullet per line. */
  notes?: string
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
  /** Explicit default routine. Kept under the legacy key for stored-data compatibility. */
  lastTemplateId?: string
  /** Stable, glanceable context shown before every session. */
  focusAreas?: string
  contraindications?: string
  temperaturePreference?: 'cooler' | 'neutral' | 'warmer'
  communicationPreference?: 'quiet' | 'check_ins' | 'collaborative'
  statedPressure?: Partial<Record<BodyZone, 'lighter' | 'moderate' | 'firmer'>>
  intakeCompletedAt?: number
  /** A client-specific plan is a durable copy, never a live link to its base routine. */
  plan?: {
    name: string
    sourceTemplateId: string
    sections: SectionTemplate[]
    updatedAt: number
  }
}

export type PreferenceEventType = 'pressure_up' | 'pressure_down' | 'loved' | 'flagged'

export interface PreferenceEvent {
  id: string
  timestamp: number
  sessionInstanceId: string
  clientId: string | null
  sectionId: string
  sectionName: string
  /** Snapshotted so long-term insights survive routine edits or deletion. */
  bodyZone?: BodyZone
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
  /** Immutable pre-session allocation for planned-versus-actual summaries. */
  plannedSections?: SectionTemplate[]
  startedAt: number
  /** Fixed appointment length. Section edits and pauses redistribute within it. */
  plannedDurationSec?: number
  currentSectionIndex: number
  sectionStartedAt: number
  paused: boolean
  pausedAt: number | null
  /** False until the first Resume — sessions start paused for intake/setup
   *  before the clock runs, distinct from a later mid-session pause. */
  started: boolean
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

/**
 * Which client a Google Calendar appointment belongs to. Kept entirely in
 * Liveprac and set by hand — never inferred from the event title or
 * attendees, and never written back to Google.
 */
export interface CalendarLink {
  googleEventId: string
  clientId: string
  /** Overrides the client's last-used routine for this one appointment only —
   *  set by picking one for this appointment specifically, before it's ever
   *  started. Once started, the client's lastTemplateId takes over again. */
  templateId?: string
}

/** A therapist's freeform write-up for one past session, added after the fact. */
export interface SessionNote {
  sessionInstanceId: string
  text: string
}

export interface ClientOuttake {
  pressure: 'lighter' | 'right' | 'firmer' | null
  highlight: string
  nextFocus: string
}

export interface SessionRecord {
  id: string
  clientId: string | null
  templateId: string
  templateName: string
  startedAt: number
  completedAt: number
  plannedDurationSec: number
  plannedSections: SectionTemplate[]
  actualSections: SectionTemplate[]
  outtake?: ClientOuttake
}
