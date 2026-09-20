import { idbDeleteBlob, idbGetBlob, idbSetBlob } from './idb'

/**
 * Per-cue custom audio: an uploaded file overrides the built-in sound for
 * that slot, at a slot-specific volume. Matches CueTone 1:1 for the four
 * ambient cues, plus a fifth slot for the session-end chime.
 */
export type SoundSlot = 'pressure' | 'love' | 'flag' | 'next' | 'sessionEnd'

export const SOUND_SLOTS: SoundSlot[] = ['pressure', 'love', 'flag', 'next', 'sessionEnd']

export const SOUND_SLOT_LABELS: Record<SoundSlot, string> = {
  pressure: 'Pressure request',
  love: 'Loved it',
  flag: 'Flagged',
  next: 'Section change',
  sessionEnd: 'Session-end chime',
}

const VOLUME_PREFIX = 'liveprac:v1:soundVolume:'
const HAS_CUSTOM_PREFIX = 'liveprac:v1:soundCustom:'

const DEFAULT_VOLUME: Record<SoundSlot, number> = {
  pressure: 60,
  love: 60,
  flag: 60,
  next: 70,
  sessionEnd: 45,
}

export function getVolume(slot: SoundSlot): number {
  try {
    const raw = localStorage.getItem(VOLUME_PREFIX + slot)
    const value = raw !== null ? Number(raw) : NaN
    return Number.isFinite(value) ? value : DEFAULT_VOLUME[slot]
  } catch {
    return DEFAULT_VOLUME[slot]
  }
}

export function setVolume(slot: SoundSlot, percent: number): void {
  try {
    localStorage.setItem(VOLUME_PREFIX + slot, String(Math.round(percent)))
  } catch {
    // Storage unavailable — volume just won't persist across reloads.
  }
}

export function hasCustomSound(slot: SoundSlot): boolean {
  try {
    return localStorage.getItem(HAS_CUSTOM_PREFIX + slot) === 'true'
  } catch {
    return false
  }
}

const urlCache = new Map<SoundSlot, string>()

function invalidateUrl(slot: SoundSlot): void {
  const existing = urlCache.get(slot)
  if (existing) URL.revokeObjectURL(existing)
  urlCache.delete(slot)
}

export async function setCustomSound(slot: SoundSlot, file: File): Promise<void> {
  await idbSetBlob(slot, file)
  invalidateUrl(slot)
  try {
    localStorage.setItem(HAS_CUSTOM_PREFIX + slot, 'true')
  } catch {
    // Storage unavailable — the upload still played once, just won't stick.
  }
}

export async function clearCustomSound(slot: SoundSlot): Promise<void> {
  await idbDeleteBlob(slot)
  invalidateUrl(slot)
  try {
    localStorage.removeItem(HAS_CUSTOM_PREFIX + slot)
  } catch {
    // No-op if storage is unavailable.
  }
}

/** Object URL for the uploaded file, or null if this slot uses its default sound. */
export async function getCustomSoundUrl(slot: SoundSlot): Promise<string | null> {
  if (!hasCustomSound(slot)) return null
  const cached = urlCache.get(slot)
  if (cached) return cached
  const blob = await idbGetBlob(slot)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(slot, url)
  return url
}
