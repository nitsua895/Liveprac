import type { BodyZone, PreferenceEvent, SessionTemplate } from '../types'

export interface ZonePressureInsight {
  zone: BodyZone
  average: number
  sessionCount: number
}

/**
 * Averages each session's net pressure request before averaging over time.
 * That prevents a long or button-heavy session from outweighing every other
 * visit and keeps the number interpretable as a per-session tendency.
 */
export function pressureInsights(
  clientId: string,
  events: PreferenceEvent[],
  templates: SessionTemplate[],
): ZonePressureInsight[] {
  const inferredZones = new Map<string, BodyZone>()
  templates.forEach((template) => template.sections.forEach((section) => {
    inferredZones.set(section.id, section.bodyZone)
  }))

  const perSessionZone = new Map<string, { zone: BodyZone; net: number }>()
  events
    .filter((event) => event.clientId === clientId && (event.type === 'pressure_up' || event.type === 'pressure_down'))
    .forEach((event) => {
      const zone = event.bodyZone ?? inferredZones.get(event.sectionId)
      if (!zone || zone === 'none') return
      const key = `${event.sessionInstanceId}:${zone}`
      const current = perSessionZone.get(key) ?? { zone, net: 0 }
      current.net += event.type === 'pressure_up' ? event.magnitude : -event.magnitude
      perSessionZone.set(key, current)
    })

  const totals = new Map<BodyZone, { total: number; count: number }>()
  perSessionZone.forEach(({ zone, net }) => {
    const current = totals.get(zone) ?? { total: 0, count: 0 }
    current.total += net
    current.count += 1
    totals.set(zone, current)
  })

  return Array.from(totals.entries())
    .map(([zone, value]) => ({
      zone,
      average: Math.round((value.total / value.count) * 10) / 10,
      sessionCount: value.count,
    }))
    .sort((a, b) => Math.abs(b.average) - Math.abs(a.average))
}
