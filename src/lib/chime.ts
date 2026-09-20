/**
 * The session-end sound: a recorded chime file (or an uploaded replacement,
 * see soundSlots.ts) that loops gently until acknowledged so it cannot be
 * missed mid-stroke.
 *
 * Mobile browsers block audio.play() until the page has seen a real user
 * gesture. The live session screen has plenty of taps before a session ever
 * ends (Pause, Next Section, the dial itself), so primeChime() rides the
 * first one to unlock playback well ahead of time.
 */
import { getCustomSoundUrl, getVolume } from './soundSlots'

const DEFAULT_SRC = `${import.meta.env.BASE_URL}sounds/session-end-chime.mp3`
const FADE_MS = 3000

let audio: HTMLAudioElement | null = null
let currentSrc: string | null = null
let fadeTimer: ReturnType<typeof setInterval> | null = null
let primed = false

async function resolveSrc(): Promise<string> {
  const custom = await getCustomSoundUrl('sessionEnd')
  return custom ?? DEFAULT_SRC
}

/** Recreates the Audio element only when the desired source actually
 *  changes (e.g. a new upload), so normal playback doesn't reload it. */
async function getAudio(): Promise<HTMLAudioElement> {
  const src = await resolveSrc()
  if (!audio || currentSrc !== src) {
    audio = new Audio(src)
    audio.loop = true
    audio.preload = 'auto'
    currentSrc = src
  }
  return audio
}

function clearFade() {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

export async function primeChime(): Promise<void> {
  if (primed) return
  primed = true
  const el = await getAudio()
  el.volume = 0
  el.play()
    .then(() => el.pause())
    .catch(() => {
      // Still locked (e.g. no gesture yet, despite the listener) — the next
      // attempt at session end just won't have sound, timing is unaffected.
    })
}

export async function playSessionEndChime(): Promise<void> {
  const el = await getAudio()
  clearFade()
  el.currentTime = 0
  el.volume = 0
  void el.play().catch(() => {})

  const targetVolume = Math.min(1, Math.max(0, getVolume('sessionEnd') / 100))
  const steps = 30
  let step = 0
  fadeTimer = setInterval(() => {
    step += 1
    el.volume = Math.min(targetVolume, (step / steps) * targetVolume)
    if (step >= steps) clearFade()
  }, FADE_MS / steps)
}

export function stopSessionEndChime(): void {
  clearFade()
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
}
