import { useEffect, useState } from 'react'
import { newSectionId } from '../state/defaultTemplates'
import { BODY_ZONE_LABELS, BODY_ZONES } from '../lib/bodyZones'
import type { SectionTemplate } from '../types'
import { BodyZoneDiagram } from './BodyZoneDiagram'

const STEP_SEC = 60
const MIN_SEC = 60

export function SectionListEditor({
  sections,
  onChange,
  preserveTotal = false,
}: {
  sections: SectionTemplate[]
  onChange: (sections: SectionTemplate[]) => void
  /** Live sessions keep their appointment end fixed while allocations change. */
  preserveTotal?: boolean
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [orderedSections, setOrderedSections] = useState(sections)

  useEffect(() => {
    if (!draggingId) setOrderedSections(sections)
  }, [sections, draggingId])

  function updateSection(index: number, patch: Partial<SectionTemplate>) {
    onChange(sections.map((section, sectionIndex) =>
      sectionIndex === index ? { ...section, ...patch } : section,
    ))
  }

  function changeDuration(index: number, deltaSec: number) {
    const next = sections.map((section) => ({ ...section }))
    if (!preserveTotal) {
      next[index].durationSec = Math.max(MIN_SEC, next[index].durationSec + deltaSec)
      onChange(next)
      return
    }

    if (deltaSec < 0) {
      const released = Math.min(-deltaSec, Math.max(0, next[index].durationSec - MIN_SEC))
      if (!released) return
      next[index].durationSec -= released
      const receivers = next.filter((_, sectionIndex) => sectionIndex !== index)
      const share = released / receivers.length
      receivers.forEach((section) => { section.durationSec += share })
      onChange(next)
      return
    }

    let needed = deltaSec
    let donors = next.map((_, donorIndex) => donorIndex).filter((donorIndex) => donorIndex !== index)
    while (needed > 0.001 && donors.length) {
      const share = needed / donors.length
      let takenThisPass = 0
      donors = donors.filter((donorIndex) => {
        const available = Math.max(0, next[donorIndex].durationSec - MIN_SEC)
        const taken = Math.min(available, share)
        next[donorIndex].durationSec -= taken
        takenThisPass += taken
        return available - taken > 0.001
      })
      if (takenThisPass < 0.001) break
      needed -= takenThisPass
    }
    const received = deltaSec - needed
    if (!received) return
    next[index].durationSec += received
    onChange(next)
  }

  function addSection() {
    const next = sections.map((section) => ({ ...section }))
    const durationSec = preserveTotal ? MIN_SEC : 5 * 60
    if (preserveTotal) {
      const donor = [...next].reverse().find((section) => section.durationSec >= MIN_SEC * 2)
      if (!donor) return
      donor.durationSec -= durationSec
    }
    next.push({ id: newSectionId(), name: 'New Section', durationSec, bodyZone: 'none', notes: '' })
    onChange(next)
  }

  function removeSection(index: number) {
    if (sections.length === 1) return
    const next = sections.map((section) => ({ ...section }))
    if (preserveTotal) {
      const receiverIndex = index + 1 < next.length ? index + 1 : index - 1
      next[receiverIndex].durationSec += next[index].durationSec
    }
    onChange(next.filter((_, sectionIndex) => sectionIndex !== index))
  }

  function moveSection(index: number, target: number, source = sections) {
    if (target < 0 || target >= source.length || index === target) return source
    const next = [...source]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
    return next
  }

  function beginDrag(index: number, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    let working = sections.map((section) => ({ ...section }))
    const draggedId = sections[index].id
    const dragged = working[index]
    const sourceRow = event.currentTarget.closest<HTMLElement>('[data-section-row]')
    const sourceBox = sourceRow?.getBoundingClientRect()
    const startY = event.clientY
    const preview = sourceRow?.cloneNode(true) as HTMLElement | undefined

    if (preview && sourceBox) {
      preview.removeAttribute('data-section-row')
      preview.classList.add('section-drag-preview')
      Object.assign(preview.style, {
        position: 'fixed',
        zIndex: '100',
        pointerEvents: 'none',
        left: `${sourceBox.left}px`,
        top: `${sourceBox.top}px`,
        width: `${sourceBox.width}px`,
        height: `${sourceBox.height}px`,
        margin: '0',
      })
      document.body.appendChild(preview)
    }

    setDraggingId(draggedId)
    setDropTargetId(null)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is unavailable in a few embedded WebViews; the
      // window listeners below still keep the gesture alive there.
    }

    function move(pointerEvent: PointerEvent) {
      pointerEvent.preventDefault()
      if (preview) preview.style.transform = `translate3d(0, ${pointerEvent.clientY - startY}px, 0)`
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-section-row]'))
        .filter((row) => row.dataset.sectionId !== draggedId)
      const remaining = working.filter((section) => section.id !== draggedId)
      const insertionIndex = rows.findIndex((row) => {
        const box = row.getBoundingClientRect()
        return pointerEvent.clientY < box.top + box.height / 2
      })
      const target = insertionIndex < 0 ? remaining.length : insertionIndex
      const next = [...remaining]
      next.splice(target, 0, dragged)
      const nextOrder = next.map((section) => section.id).join('|')
      if (nextOrder !== working.map((section) => section.id).join('|')) {
        working = next
        setOrderedSections(next)
      }
      setDropTargetId(remaining[target]?.id ?? remaining.at(-1)?.id ?? null)
    }

    function finish() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      preview?.remove()
      onChange(working)
      setDraggingId(null)
      setDropTargetId(null)
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish, { once: true })
    window.addEventListener('pointercancel', finish, { once: true })
  }

  return (
    <div className="flex flex-col gap-2">
      {orderedSections.map((section, index) => (
        <div
          key={section.id}
          data-section-row
          data-section-id={section.id}
          data-dragging={draggingId === section.id}
          data-drop-target={dropTargetId === section.id}
          className="section-editor-row grid items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3"
        >
          <button
            type="button"
            aria-label={`Drag ${section.name} to reorder`}
            aria-grabbed={draggingId === section.id}
            onPointerDown={(event) => beginDrag(index, event)}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') moveSection(index, index - 1)
              if (event.key === 'ArrowDown') moveSection(index, index + 1)
            }}
            className="section-drag cursor-grab touch-none px-2 text-neutral-500 active:cursor-grabbing"
          >
            <svg viewBox="0 0 18 24" width="18" height="24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" />
              <circle cx="5" cy="12" r="1.5" /><circle cx="13" cy="12" r="1.5" />
              <circle cx="5" cy="19" r="1.5" /><circle cx="13" cy="19" r="1.5" />
            </svg>
          </button>
          <div className="section-body"><BodyZoneDiagram activeZone={section.bodyZone} size={34} /></div>
          <div className="section-fields min-w-0">
            <input
              aria-label="Section name"
              value={section.name}
              onChange={(event) => updateSection(index, { name: event.target.value })}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-200 outline-none focus:border-accent-500/50"
            />
            <select
              aria-label="Body zone"
              value={section.bodyZone}
              onChange={(event) => updateSection(index, { bodyZone: event.target.value as SectionTemplate['bodyZone'] })}
              className="mt-2 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-neutral-300 outline-none focus:border-accent-500/50"
            >
              {BODY_ZONES.map((zone) => (
                <option key={zone} value={zone}>{BODY_ZONE_LABELS[zone]}</option>
              ))}
            </select>
            <textarea
              aria-label="Section notes"
              value={section.notes ?? ''}
              onChange={(event) => updateSection(index, { notes: event.target.value })}
              rows={2}
              placeholder="Notes · one cue per line"
              className="mt-2 w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-relaxed text-neutral-300 outline-none placeholder:text-neutral-700 focus:border-accent-500/50"
            />
          </div>
          <div className="section-duration flex items-center justify-center rounded-full border border-neutral-700 bg-neutral-950">
            <button
              type="button"
              aria-label={`Remove one minute from ${section.name}`}
              disabled={section.durationSec <= MIN_SEC}
              onClick={() => changeDuration(index, -STEP_SEC)}
              className="w-11 rounded-full text-xl text-neutral-300"
            >
              −
            </button>
            <span className="min-w-20 text-center font-mono text-base tabular-nums text-neutral-100">
              {formatDuration(section.durationSec)}
            </span>
            <button
              type="button"
              aria-label={`Add one minute to ${section.name}`}
              onClick={() => changeDuration(index, STEP_SEC)}
              className="w-11 rounded-full text-xl text-neutral-300"
            >
              +
            </button>
          </div>
          <button
            type="button"
            aria-label={`Remove ${section.name}`}
            disabled={sections.length === 1}
            onClick={() => removeSection(index)}
            className="section-remove w-11 rounded-full text-xl text-red-300/80"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addSection}
        className="rounded-xl border border-dashed border-neutral-700 py-3 text-sm text-neutral-400"
      >
        + Add section
      </button>
      {preserveTotal && (
        <p className="text-center text-xs text-neutral-500">
          Changes are shared evenly across the remaining plan. The session end time stays fixed.
        </p>
      )}
    </div>
  )
}

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return remainder ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${minutes} min`
}
