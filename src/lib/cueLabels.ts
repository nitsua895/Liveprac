import type { CueTone, PreferenceEventType } from '../types'

/**
 * Per-tone color and per-signal label overrides for ambient cues. Absent
 * overrides fall through to the defaults already baked into index.css /
 * AppStateContext — this only ever stores what's actually been customized.
 */
const LABEL_KEY = 'liveprac:v1:cueLabels'
const COLOR_KEY = 'liveprac:v1:cueColors'

export const DEFAULT_CUE_LABELS: Record<PreferenceEventType, string> = {
  pressure_up: 'More pressure',
  pressure_down: 'Less pressure',
  loved: 'Loved this',
  flagged: 'Not a fan',
}

/** Hex equivalents of the rgba() defaults hardcoded per [data-tone] in index.css. */
export const DEFAULT_CUE_COLORS: Record<CueTone, string> = {
  pressure: '#d28228',
  love: '#dc2837',
  flag: '#2878dc',
  next: '#8246e6',
}

export const TONE_LABELS: Record<CueTone, string> = {
  pressure: 'Pressure',
  love: 'Loved',
  flag: 'Flagged',
  next: 'Section change',
}

function readMap<T extends string>(key: string): Partial<Record<T, string>> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Partial<Record<T, string>>) : {}
  } catch {
    return {}
  }
}

function writeMap<T extends string>(key: string, map: Partial<Record<T, string>>) {
  try {
    localStorage.setItem(key, JSON.stringify(map))
  } catch {
    // Storage unavailable — customization just won't persist across reloads.
  }
}

export function getCueLabel(type: PreferenceEventType): string {
  return readMap<PreferenceEventType>(LABEL_KEY)[type] ?? DEFAULT_CUE_LABELS[type]
}

export function setCueLabel(type: PreferenceEventType, label: string): void {
  const map = readMap<PreferenceEventType>(LABEL_KEY)
  writeMap(LABEL_KEY, { ...map, [type]: label })
}

export function resetCueLabel(type: PreferenceEventType): void {
  const map = readMap<PreferenceEventType>(LABEL_KEY)
  delete map[type]
  writeMap(LABEL_KEY, map)
}

/** null means "no override" — the CSS default for that tone applies. */
export function getCueColor(tone: CueTone): string | null {
  return readMap<CueTone>(COLOR_KEY)[tone] ?? null
}

export function setCueColor(tone: CueTone, hex: string): void {
  const map = readMap<CueTone>(COLOR_KEY)
  writeMap(COLOR_KEY, { ...map, [tone]: hex })
}

export function resetCueColor(tone: CueTone): void {
  const map = readMap<CueTone>(COLOR_KEY)
  delete map[tone]
  writeMap(COLOR_KEY, map)
}
