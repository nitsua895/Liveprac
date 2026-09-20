/** Small shared color math for anywhere a user-picked hex needs to become
 *  either a themed lightness ladder (accent) or an rgba glow (cue tones). */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  else if (max === gn) h = ((bn - rn) / d + 2) * 60
  else h = ((rn - gn) / d + 4) * 60
  return { h, s: s * 100, l: l * 100 }
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHsl(r, g, b)
}

/** rgba() string for a picked hex at a given alpha — used for glow/cue colors. */
export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** A light, readable tint of a hue — blends toward white, matching the
 *  pastel cue-text colors already hardcoded per tone. */
export function hexToLightText(hex: string, mix = 0.6): string {
  const { r, g, b } = hexToRgb(hex)
  const blend = (c: number) => Math.round(c + (255 - c) * mix)
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`
}

/** The four CSS custom properties index.css reads per [data-tone], derived
 *  from one picked hex — matches the shape of the hardcoded rgba() defaults. */
export function deriveCueVars(hex: string): Record<string, string> {
  return {
    '--vignette-soft': hexToRgba(hex, 0.72),
    '--vignette-flash': hexToRgba(hex, 0.95),
    '--cue-border': hexToRgba(hex, 0.7),
    '--cue-text': hexToLightText(hex, 0.62),
  }
}
