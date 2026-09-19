import { BodyZoneDiagram } from './BodyZoneDiagram'
import { BODY_ZONE_LABELS } from '../lib/bodyZones'
import type { SectionTemplate } from '../types'

export function NextUpCard({ section }: { section: SectionTemplate | undefined }) {
  if (!section) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-neutral-700 px-5 py-4 text-neutral-400">
        <span>Final section — no more after this</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-accent-500/25 bg-neutral-900/80 px-5 py-4">
      <BodyZoneDiagram dimZone={section.bodyZone} size={60} />
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400">Up next</p>
        <p className="text-xl text-neutral-50">{section.name}</p>
        <p className="text-sm text-neutral-400">
          {BODY_ZONE_LABELS[section.bodyZone]} · {Math.round(section.durationSec / 60)} min
        </p>
      </div>
    </div>
  )
}
