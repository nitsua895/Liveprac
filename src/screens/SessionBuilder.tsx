import { useState } from 'react'
import { newSectionId, newTemplateId } from '../state/defaultTemplates'
import { useAppState } from '../state/AppStateContext'
import type { SectionTemplate, SessionTemplate } from '../types'
import { sessionDurationSec } from '../lib/time'

function emptyTemplate(): SessionTemplate {
  return { id: newTemplateId(), name: 'New Session', sections: [], createdAt: Date.now() }
}

export function SessionBuilder() {
  const { templates, deleteTemplate } = useAppState()
  const [editing, setEditing] = useState<SessionTemplate | null>(null)

  if (editing) {
    return <TemplateEditor template={editing} onDone={() => setEditing(null)} />
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-neutral-200">Session Templates</h1>
        <button
          type="button"
          onClick={() => setEditing(emptyTemplate())}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950"
        >
          New Template
        </button>
      </header>

      <div className="flex flex-col gap-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4"
          >
            <div>
              <p className="text-neutral-100">{template.name}</p>
              <p className="text-sm text-neutral-500">
                {template.sections.length} sections · {Math.round(sessionDurationSec(template.sections) / 60)} min
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(template)}
                className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteTemplate(template.id)}
                className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-400/80"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TemplateEditor({ template, onDone }: { template: SessionTemplate; onDone: () => void }) {
  const { saveTemplate } = useAppState()
  const [draft, setDraft] = useState<SessionTemplate>(template)

  function updateSection(index: number, patch: Partial<SectionTemplate>) {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }))
  }

  function addSection() {
    setDraft((prev) => ({
      ...prev,
      sections: [...prev.sections, { id: newSectionId(), name: 'New Section', durationSec: 5 * 60 }],
    }))
  }

  function removeSection(index: number) {
    setDraft((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== index) }))
  }

  function moveSection(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.sections.length) return prev
      const sections = [...prev.sections]
      ;[sections[index], sections[target]] = [sections[target], sections[index]]
      return { ...prev, sections }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <input
        value={draft.name}
        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
        className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-xl text-neutral-100 outline-none focus:border-amber-500/50"
      />

      <div className="flex flex-col gap-2">
        {draft.sections.map((section, index) => (
          <div
            key={section.id}
            className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3"
          >
            <input
              value={section.name}
              onChange={(e) => updateSection(index, { name: e.target.value })}
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-200 outline-none focus:border-amber-500/50"
            />
            <input
              type="number"
              min={1}
              value={Math.round(section.durationSec / 60)}
              onChange={(e) => updateSection(index, { durationSec: Number(e.target.value) * 60 })}
              className="w-20 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-center text-neutral-200 outline-none focus:border-amber-500/50"
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

      <p className="text-sm text-neutral-500">
        Total: {Math.round(sessionDurationSec(draft.sections) / 60)} minutes
      </p>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm text-neutral-500">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            saveTemplate(draft)
            onDone()
          }}
          className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-neutral-950"
        >
          Save
        </button>
      </div>
    </div>
  )
}
