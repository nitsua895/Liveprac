import { hexToHsl } from './color'

export type AccentTheme = 'violet' | 'indigo' | 'teal' | 'sage' | 'amber' | 'crimson' | 'custom'

const STORAGE_KEY = 'liveprac:v1:accentTheme'
const CUSTOM_HEX_KEY = 'liveprac:v1:accentCustomHex'
const ACCENT_STEPS: { step: 200 | 300 | 400 | 500 | 700 | 900; lightness: number }[] = [
  { step: 200, lightness: 76 },
  { step: 300, lightness: 65 },
  { step: 400, lightness: 55 },
  { step: 500, lightness: 47 },
  { step: 700, lightness: 32 },
  { step: 900, lightness: 16 },
]

const DEFAULT_ACCENT: AccentTheme = 'violet'

export const ACCENT_THEMES: { value: Exclude<AccentTheme, 'custom'>; label: string }[] = [
  { value: 'violet', label: 'Deep Violet' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'teal', label: 'Teal' },
  { value: 'sage', label: 'Sage' },
  { value: 'amber', label: 'Amber' },
  { value: 'crimson', label: 'Crimson' },
]

/** Must match each palette's --color-accent-400 in index.css. Custom isn't
 *  here since its preview color is whatever hex was actually picked. */
export const ACCENT_PREVIEW_COLORS: Record<Exclude<AccentTheme, 'custom'>, string> = {
  violet: 'hsl(262 34% 55%)',
  indigo: 'hsl(222 38% 55%)',
  teal: 'hsl(180 32% 55%)',
  sage: 'hsl(135 26% 55%)',
  amber: 'hsl(36 45% 55%)',
  crimson: 'hsl(350 38% 55%)',
}

function isAccentTheme(value: string | null): value is AccentTheme {
  return value === 'custom' || ACCENT_THEMES.some((theme) => theme.value === value)
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

export function getCustomAccentHex(): string | null {
  try {
    return localStorage.getItem(CUSTOM_HEX_KEY)
  } catch {
    return null
  }
}

function clearCustomAccentVars(): void {
  for (const { step } of ACCENT_STEPS) {
    document.documentElement.style.removeProperty(`--color-accent-${step}`)
  }
}

/** Keeps the picked hue but reuses the same lightness ladder and a capped,
 *  muted saturation every preset already shares — this app runs a few feet
 *  from someone's face in a dim room, where a fully saturated custom pick
 *  would read as glare rather than the intended calm accent. */
function applyCustomAccentVars(hex: string): void {
  const { h, s } = hexToHsl(hex)
  const clampedS = Math.min(52, Math.max(18, s))
  for (const { step, lightness } of ACCENT_STEPS) {
    document.documentElement.style.setProperty(`--color-accent-${step}`, `hsl(${h} ${clampedS}% ${lightness}%)`)
  }
}

export function applyCustomAccent(hex: string): void {
  applyCustomAccentVars(hex)
  document.documentElement.setAttribute('data-accent', 'custom')
  try {
    localStorage.setItem(STORAGE_KEY, 'custom')
    localStorage.setItem(CUSTOM_HEX_KEY, hex)
  } catch {
    // Private browsing / storage full — pick just won't persist across reloads.
  }
}

export function applyAccent(theme: AccentTheme): void {
  if (theme === 'custom') {
    const hex = getCustomAccentHex()
    if (hex) {
      applyCustomAccent(hex)
      return
    }
    theme = DEFAULT_ACCENT
  }
  clearCustomAccentVars()
  document.documentElement.setAttribute('data-accent', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private browsing / storage full — theme just won't persist across reloads.
  }
}
