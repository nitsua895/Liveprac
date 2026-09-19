export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function sessionDurationSec(sections: { durationSec: number }[]): number {
  return sections.reduce((sum, s) => sum + s.durationSec, 0)
}
