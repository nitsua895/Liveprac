export type AccentTheme = 'violet' | 'indigo' | 'teal' | 'sage' | 'amber' | 'crimson' | 'custom'

const STORAGE_KEY = 'liveprac:v1:accentTheme'
const CUSTOM_HUE_KEY = 'liveprac:v1:accentCustomHue'
const ACCENT_STEPS: { step: 200 | 300 | 400 | 500 | 700 | 900; lightness: number }[] = [
  { step: 200, lightness: 76 },
  { step: 300, lightness: 65 },
  { step: 400, lightness: 55 },
  { step: 500, lightness: 47 },
  { step: 700, lightness: 32 },
  { step: 900, lightness: 16 },
]
/** A custom pick only ever chooses a hue — saturation is fixed at the same
 *  muted level the presets sit around, so there's no way to land on
 *  something jarring. A hue wheel with saturation/lightness sliders too
 *  would just let someone recreate the "ugly, oversaturated" outcome this
 *  is specifically designed to avoid. */
const CUSTOM_SATURATION = 36

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
 *  here since its preview color is whatever hue was actually picked. */
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

export function getCustomHue(): number | null {
  try {
    const raw = localStorage.getItem(CUSTOM_HUE_KEY)
    const value = raw !== null ? Number(raw) : NaN
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/** For rendering the custom swatch/wheel — the actual muted color a given
 *  hue resolves to, at the same lightness as each preset's own swatch. */
export function customAccentPreview(hue: number): string {
  return `hsl(${hue} ${CUSTOM_SATURATION}% 55%)`
}

function clearCustomAccentVars(): void {
  for (const { step } of ACCENT_STEPS) {
    document.documentElement.style.removeProperty(`--color-accent-${step}`)
  }
}

function applyCustomAccentVars(hue: number): void {
  for (const { step, lightness } of ACCENT_STEPS) {
    document.documentElement.style.setProperty(`--color-accent-${step}`, `hsl(${hue} ${CUSTOM_SATURATION}% ${lightness}%)`)
  }
}

export function applyCustomAccent(hue: number): void {
  applyCustomAccentVars(hue)
  document.documentElement.setAttribute('data-accent', 'custom')
  try {
    localStorage.setItem(STORAGE_KEY, 'custom')
    localStorage.setItem(CUSTOM_HUE_KEY, String(hue))
  } catch {
    // Private browsing / storage full — pick just won't persist across reloads.
  }
}

export function applyAccent(theme: AccentTheme): void {
  if (theme === 'custom') {
    const hue = getCustomHue()
    if (hue !== null) {
      applyCustomAccent(hue)
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
