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

/** Inverse of hexToHsl — used to turn a wheel's plain hue back into the hex
 *  format the rest of the cue-color storage already speaks. */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
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
