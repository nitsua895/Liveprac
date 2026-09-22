import type { ClientOuttake, ClientProfile, PreferenceEvent, SessionTemplate } from '../types'

/** Shared between the checkout question and every place that later displays
 *  its answer, so the two can't drift into mismatched wording. */
export const OUTTAKE_PRESSURE_LABELS: Record<NonNullable<ClientOuttake['pressure']>, string> = {
  lighter: 'Too light',
  right: 'Just right',
  firmer: 'Too firm',
}

/**
 * ClinicSense and MassageBook don't publish a public API for third-party
 * apps, so there's no direct sync target yet. This produces plain text
 * formatted for pasting into either tool's client-notes field by hand.
 */
export function formatSessionSummary(
  template: SessionTemplate,
  client: ClientProfile | null,
  events: PreferenceEvent[],
): string {
  const lines: string[] = []
  lines.push(`${template.name} — ${new Date().toLocaleDateString()}`)
  if (client) lines.push(`Client: ${client.name}`)
  lines.push('')

  if (events.length === 0) {
    lines.push('No pressure/preference signals logged this session.')
    return lines.join('\n')
  }

  const bySection = new Map<string, PreferenceEvent[]>()
  for (const event of events) {
    const list = bySection.get(event.sectionName) ?? []
    list.push(event)
    bySection.set(event.sectionName, list)
  }

  const labels: Record<PreferenceEvent['type'], string> = {
    pressure_up: 'asked for more pressure',
    pressure_down: 'asked for less pressure',
    loved: 'loved this',
    flagged: 'flagged as not preferred',
  }

  for (const [sectionName, sectionEvents] of bySection) {
    lines.push(`${sectionName}:`)
    for (const event of sectionEvents) {
      lines.push(`  - ${labels[event.type]}`)
    }
  }

  return lines.join('\n')
}
