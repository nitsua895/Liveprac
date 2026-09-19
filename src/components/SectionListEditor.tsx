import { newSectionId } from '../state/defaultTemplates'
import { BODY_ZONE_LABELS, BODY_ZONES } from '../lib/bodyZones'
import type { SectionTemplate } from '../types'
import { BodyZoneDiagram } from './BodyZoneDiagram'

export function SectionListEditor({
  sections,
  onChange,
}: {
  sections: SectionTemplate[]
  onChange: (sections: SectionTemplate[]) => void
}) {
  function updateSection(index: number, patch: Partial<SectionTemplate>) {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addSection() {
    onChange([...sections, { id: newSectionId(), name: 'New Section', durationSec: 5 * 60, bodyZone: 'none' }])
  }

  function removeSection(index: number) {
    onChange(sections.filter((_, i) => i !== index))
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section, index) => (
        <div
          key={section.id}
          className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3"
        >
          <BodyZoneDiagram activeZone={section.bodyZone} size={40} />
          <input
            value={section.name}
            onChange={(e) => updateSection(index, { name: e.target.value })}
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-200 outline-none focus:border-accent-500/50"
          />
          <select
            value={section.bodyZone}
            onChange={(e) => updateSection(index, { bodyZone: e.target.value as SectionTemplate['bodyZone'] })}
            className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-neutral-300 outline-none focus:border-accent-500/50"
          >
            {BODY_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {BODY_ZONE_LABELS[zone]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={Math.round(section.durationSec / 60)}
            onChange={(e) => updateSection(index, { durationSec: Number(e.target.value) * 60 })}
            className="w-20 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-center text-neutral-200 outline-none focus:border-accent-500/50"
          />
          <span className="text-sm text-neutral-500">min</span>
          <button type="button" onClick={() => moveSection(index, -1)} className="px-2 text-neutral-500">
            ↑
          </button>
          <button type="button" onClick={() => moveSection(index, 1)} className="px-2 text-neutral-500">
            ↓
          </button>
          <button type="button" onClick={() => removeSection(index)} className="px-2 text-red-400/80">
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addSection}
        className="rounded-xl border border-dashed border-neutral-800 py-3 text-sm text-neutral-500"
      >
        + Add section
      </button>
    </div>
  )
}
