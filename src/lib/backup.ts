/**
 * Everything Liveprac stores lives only in this browser's localStorage on
 * this device — clearing site data, switching devices, or reinstalling
 * loses it all with no recovery path. This is the only backup mechanism
 * until a future version adds account-based cloud sync.
 *
 * Deliberately excludes auth tokens (Spotify/Google) and the in-progress
 * activeSession: tokens aren't meaningful to restore on another device or
 * after a fresh OAuth app setup, and resuming a stale mid-massage session
 * from a backup would be actively confusing rather than useful.
 */
const PREFIX = 'liveprac:v1:'
const DATA_KEYS = [
  'templates',
  'clients',
  'events',
  'calendarLinks',
  'sessionNotes',
  'bleMappings',
  'gamepadMappings',
]

export function exportData(): void {
  const payload: Record<string, unknown> = {
    app: 'Liveprac',
    exportedAt: new Date().toISOString(),
  }
  for (const key of DATA_KEYS) {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) continue
    try {
      payload[key] = JSON.parse(raw)
    } catch {
      // Corrupt entry — skip it rather than fail the whole export.
    }
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `liveprac-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Wipes every client, routine, and session record on this device. Reloads
 *  the page afterward so all in-memory state re-initializes from scratch. */
export function resetAllData(): void {
  for (const key of DATA_KEYS) {
    localStorage.removeItem(PREFIX + key)
  }
  localStorage.removeItem(`${PREFIX}activeSession`)
  window.location.reload()
}
