import { BodyZoneDiagram } from './BodyZoneDiagram'
import type { SectionTemplate } from '../types'

export function NextUpCard({ section }: { section: SectionTemplate | undefined }) {
  if (!section) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-700 px-6 py-5 text-center">
        <span className="text-base uppercase tracking-wide text-neutral-500">Up next</span>
        <span className="text-xl text-neutral-400">Last section</span>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl border-2 px-6 py-5 text-center"
      style={{ borderColor: 'rgba(166, 134, 220, 0.4)', background: 'rgba(138, 100, 200, 0.08)' }}
    >
      <span className="text-base uppercase tracking-wide" style={{ color: 'rgb(206, 186, 245)' }}>
        Up next
      </span>
      <BodyZoneDiagram dimZone={section.bodyZone} size={72} />
      <span className="text-2xl leading-tight text-neutral-50">{section.name}</span>
      <span className="text-lg text-neutral-400">{Math.round(section.durationSec / 60)} min</span>
    </div>
  )
}
