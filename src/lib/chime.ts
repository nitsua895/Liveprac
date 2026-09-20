/**
 * The session-end sound: a gentle chime that fades in and loops softly until
 * the therapist closes out, like a soft alarm rather than a single ding that
 * can be missed mid-stroke.
 *
 * Mobile browsers block audio.play() until the page has seen a real user
 * gesture. The live session screen has plenty of taps before a session ever
 * ends (Pause, Next Section, the dial itself), so primeChime() rides the
 * first one to unlock playback well ahead of time.
 */
const SRC = `${import.meta.env.BASE_URL}sounds/session-end-chime.mp3`
const FADE_MS = 3000
const TARGET_VOLUME = 0.65

let audio: HTMLAudioElement | null = null
let fadeTimer: ReturnType<typeof setInterval> | null = null
let primed = false

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SRC)
    audio.loop = true
    audio.preload = 'auto'
  }
  return audio
}

function clearFade() {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

export function primeChime(): void {
  if (primed) return
  primed = true
  const el = getAudio()
  el.volume = 0
  el.play()
    .then(() => el.pause())
    .catch(() => {
      // Still locked (e.g. no gesture yet, despite the listener) — the next
      // attempt at session end just won't have sound, timing is unaffected.
    })
}

export function playSessionEndChime(): void {
  const el = getAudio()
  clearFade()
  el.currentTime = 0
  el.volume = 0
  void el.play().catch(() => {})

  const steps = 30
  let step = 0
  fadeTimer = setInterval(() => {
    step += 1
    el.volume = Math.min(TARGET_VOLUME, (step / steps) * TARGET_VOLUME)
    if (step >= steps) clearFade()
  }, FADE_MS / steps)
}

export function stopSessionEndChime(): void {
  clearFade()
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
}
