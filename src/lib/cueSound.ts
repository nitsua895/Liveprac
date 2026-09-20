import type { AmbientCue } from '../types'
import { getCustomSoundUrl, getVolume, hasCustomSound } from './soundSlots'

export type CueSoundMode = 'off' | 'transitions' | 'all'

const STORAGE_KEY = 'liveprac-cue-sound'
const DEFAULT_MODE: CueSoundMode = 'transitions'
let audioContext: AudioContext | null = null

export function getCueSoundMode(): CueSoundMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'off' || stored === 'transitions' || stored === 'all'
    ? stored
    : DEFAULT_MODE
}

export function setCueSoundMode(mode: CueSoundMode) {
  localStorage.setItem(STORAGE_KEY, mode)
}

function context() {
  audioContext ??= new AudioContext()
  return audioContext
}

/** Call from a tap before the session starts so mobile browsers allow later cues. */
export async function primeCueAudio() {
  if (getCueSoundMode() === 'off') return
  try {
    const ctx = context()
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    // Audio is an enhancement; a blocked audio context must never block a session.
  }
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, peak = 0.025) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.06)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function playPattern(kind: AmbientCue['kind']) {
  const ctx = context()
  if (ctx.state !== 'running') return
  const start = ctx.currentTime + 0.025

  if (kind === 'timer') {
    // Two low-volume, consonant notes read as a transition without sounding
    // like an alarm in a quiet treatment room.
    tone(ctx, 392, start, 0.48, 0.022)
    tone(ctx, 523.25, start + 0.18, 0.58, 0.018)
  } else {
    tone(ctx, 440, start, 0.42, 0.012)
  }
}

async function playCustomTone(tone: AmbientCue['tone']): Promise<void> {
  const url = await getCustomSoundUrl(tone)
  if (!url) return
  const audio = new Audio(url)
  audio.volume = Math.min(1, Math.max(0, getVolume(tone) / 100))
  await audio.play()
}

export function playCueSound(cue: AmbientCue) {
  const mode = getCueSoundMode()
  if (mode === 'off' || (mode === 'transitions' && cue.kind !== 'timer')) return
  if (hasCustomSound(cue.tone)) {
    void playCustomTone(cue.tone).catch(() => {
      // Fall back silently — the visual glow is the primary signal either way.
    })
    return
  }
  try {
    playPattern(cue.kind)
  } catch {
    // Keep every visual cue working if the browser suspends Web Audio.
  }
}

/** Plays whatever this tone is currently configured to use — its uploaded
 *  sound if any, otherwise the built-in pattern — ignoring the on/off mode.
 *  Used by the Settings preview buttons so testing a sound always works,
 *  even while cue sound is set to Off. */
export async function previewTone(tone: AmbientCue['tone']): Promise<void> {
  if (hasCustomSound(tone)) {
    await playCustomTone(tone).catch(() => {})
    return
  }
  const ctx = context()
  if (ctx.state === 'suspended') await ctx.resume()
  playPattern(tone === 'next' ? 'timer' : 'preference')
}

export async function previewCueSound(mode: CueSoundMode) {
  if (mode === 'off') return
  try {
    const ctx = context()
    if (ctx.state === 'suspended') await ctx.resume()
    playPattern(mode === 'all' ? 'preference' : 'timer')
  } catch {
    // Settings still persist even on a browser that cannot create an audio context.
  }
}
