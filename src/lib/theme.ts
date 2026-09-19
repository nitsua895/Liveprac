export type AccentTheme = 'amber' | 'violet' | 'crimson'

const STORAGE_KEY = 'liveprac:v1:accentTheme'

export const ACCENT_THEMES: { value: AccentTheme; label: string }[] = [
  { value: 'amber', label: 'Amber' },
  { value: 'violet', label: 'Deep Violet' },
  { value: 'crimson', label: 'Deep Crimson' },
]

/** Must match the --color-accent-400 values defined per theme in index.css. */
export const ACCENT_PREVIEW_COLORS: Record<AccentTheme, string> = {
  amber: 'hsl(36 45% 52%)',
  violet: 'hsl(262 34% 55%)',
  crimson: 'hsl(350 38% 55%)',
}

export function getStoredAccent(): AccentTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'amber' || stored === 'violet' || stored === 'crimson') return stored
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return 'amber'
}

export function applyAccent(theme: AccentTheme): void {
  if (theme === 'amber') {
    document.documentElement.removeAttribute('data-accent')
  } else {
    document.documentElement.setAttribute('data-accent', theme)
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private browsing / storage full — theme just won't persist across reloads.
  }
}
