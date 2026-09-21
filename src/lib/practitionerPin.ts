const PIN_KEY = 'liveprac:v1:practitioner-pin'

/**
 * A same-device privacy curtain, not account security or encryption. The
 * commercial account layer must replace this with authenticated access.
 */
export function getPractitionerPin(): string | null {
  try {
    const value = localStorage.getItem(PIN_KEY)
    return value && /^\d{4}$/.test(value) ? value : null
  } catch {
    return null
  }
}

export function setPractitionerPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false
  try {
    localStorage.setItem(PIN_KEY, pin)
    return true
  } catch {
    return false
  }
}

export function verifyPractitionerPin(pin: string): boolean {
  return getPractitionerPin() === pin
}
