export type AccentTheme = 'violet' | 'indigo' | 'teal' | 'sage' | 'amber' | 'crimson'

const STORAGE_KEY = 'liveprac:v1:accentTheme'

const DEFAULT_ACCENT: AccentTheme = 'violet'

export const ACCENT_THEMES: { value: AccentTheme; label: string }[] = [
  { value: 'violet', label: 'Deep Violet' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'teal', label: 'Teal' },
  { value: 'sage', label: 'Sage' },
  { value: 'amber', label: 'Amber' },
  { value: 'crimson', label: 'Crimson' },
]

/** Must match each palette's --color-accent-400 in index.css. */
export const ACCENT_PREVIEW_COLORS: Record<AccentTheme, string> = {
  violet: 'hsl(262 34% 55%)',
  indigo: 'hsl(222 38% 55%)',
  teal: 'hsl(180 32% 55%)',
  sage: 'hsl(135 26% 55%)',
  amber: 'hsl(36 45% 55%)',
  crimson: 'hsl(350 38% 55%)',
}

function isAccentTheme(value: string | null): value is AccentTheme {
  return ACCENT_THEMES.some((theme) => theme.value === value)
}

export function getStoredAccent(): AccentTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isAccentTheme(stored)) return stored
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return DEFAULT_ACCENT
}

export function applyAccent(theme: AccentTheme): void {
  document.documentElement.setAttribute('data-accent', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private browsing / storage full — theme just won't persist across reloads.
  }
}
