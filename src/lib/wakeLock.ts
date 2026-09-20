/**
 * Keeps the screen on while active. Backgrounding/locking the screen during
 * an 8-10 hour shift is the single biggest threat to BLE staying connected —
 * Android will throttle or suspend a backgrounded tab's radio activity, and
 * a locked screen makes that worse. This doesn't make the connection
 * bulletproof (nothing does, over a full shift, on a web page), but it
 * removes the most common cause of a dropped remote mid-session.
 */
let sentinel: WakeLockSentinel | null = null

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

export async function acquireWakeLock(): Promise<void> {
  if (!isWakeLockSupported()) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
  } catch {
    // Denied (e.g. low battery mode) or page not visible — not fatal.
  }
}

export function releaseWakeLock(): void {
  void sentinel?.release()
  sentinel = null
}

/** Wake locks are auto-released when the tab is hidden; re-acquire on return. */
export function reacquireOnVisible(): () => void {
  function handler() {
    if (document.visibilityState === 'visible' && sentinel === null) void acquireWakeLock()
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}
