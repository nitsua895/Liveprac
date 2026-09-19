import { BodyZoneDiagram } from './BodyZoneDiagram'
import { BODY_ZONE_LABELS } from '../lib/bodyZones'
import type { SectionTemplate } from '../types'

export function NextUpCard({ section }: { section: SectionTemplate | undefined }) {
  if (!section) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-neutral-800 px-4 py-3 text-neutral-600">
        <span className="text-sm">Final section — no more after this</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <BodyZoneDiagram dimZone={section.bodyZone} size={44} />
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-600">Up next</p>
        <p className="text-neutral-200">{section.name}</p>
        <p className="text-xs text-neutral-500">
          {BODY_ZONE_LABELS[section.bodyZone]} · {Math.round(section.durationSec / 60)} min
        </p>
      </div>
    </div>
  )
}
