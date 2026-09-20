import type { AmbientCue, CueTone } from '../types'
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

function note(ctx: AudioContext, frequency: number, start: number, duration: number, peak = 0.025) {
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

/** One gentle default per tone — distinguishable by ear the way the glow
 *  colors are distinguishable by eye, without any of them sounding like an
 *  alarm in a quiet treatment room. */
function playPattern(tone: CueTone) {
  const ctx = context()
  if (ctx.state !== 'running') return
  const start = ctx.currentTime + 0.025

  if (tone === 'next') {
    // Two low, consonant notes read as a transition.
    note(ctx, 392, start, 0.48, 0.022)
    note(ctx, 523.25, start + 0.18, 0.58, 0.018)
  } else if (tone === 'love') {
    // A warmer, rising two-note lift for positive feedback.
    note(ctx, 523.25, start, 0.34, 0.014)
    note(ctx, 659.25, start + 0.12, 0.42, 0.012)
  } else if (tone === 'flag') {
    // Lower and single-note — acknowledges without sounding negative.
    note(ctx, 329.63, start, 0.4, 0.011)
  } else {
    // pressure — a neutral, unobtrusive single blip.
    note(ctx, 440, start, 0.42, 0.012)
  }
}

async function playCustomTone(tone: CueTone): Promise<void> {
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
    playPattern(cue.tone)
  } catch {
    // Keep every visual cue working if the browser suspends Web Audio.
  }
}

/** Plays whatever this tone is currently configured to use — its uploaded
 *  sound if any, otherwise the built-in pattern — ignoring the on/off mode.
 *  Used by the Settings preview buttons so testing a sound always works,
 *  even while cue sound is set to Off. */
export async function previewTone(tone: CueTone): Promise<void> {
  if (hasCustomSound(tone)) {
    await playCustomTone(tone).catch(() => {})
    return
  }
  const ctx = context()
  if (ctx.state === 'suspended') await ctx.resume()
  playPattern(tone)
}

export async function previewCueSound(mode: CueSoundMode) {
  if (mode === 'off') return
  try {
    const ctx = context()
    if (ctx.state === 'suspended') await ctx.resume()
    playPattern(mode === 'all' ? 'pressure' : 'next')
  } catch {
    // Settings still persist even on a browser that cannot create an audio context.
  }
}
