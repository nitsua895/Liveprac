const NAMESPACE = 'liveprac:v1:'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NAMESPACE + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NAMESPACE + key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable (private browsing) — session state just won't persist across reloads.
  }
}
