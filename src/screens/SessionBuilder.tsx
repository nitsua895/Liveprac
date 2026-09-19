import { useState } from 'react'
import { newTemplateId } from '../state/defaultTemplates'
import { useAppState } from '../state/AppStateContext'
import type { SessionTemplate } from '../types'
import { sessionDurationSec } from '../lib/time'
import { SectionListEditor } from '../components/SectionListEditor'

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
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-neutral-950"
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

  return (
    <div className="flex flex-col gap-6">
      <input
        value={draft.name}
        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
        className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-xl text-neutral-100 outline-none focus:border-accent-500/50"
      />

      <SectionListEditor
        sections={draft.sections}
        onChange={(sections) => setDraft((prev) => ({ ...prev, sections }))}
      />

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
          className="rounded-full bg-accent-500 px-5 py-2 text-sm font-medium text-neutral-950"
        >
          Save
        </button>
      </div>
    </div>
  )
}
