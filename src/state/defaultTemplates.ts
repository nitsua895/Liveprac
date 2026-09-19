import type { SectionTemplate, SessionTemplate } from '../types'

let idCounter = 0
function id(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now()}_${idCounter}`
}

function sections(spec: [string, number][]): SectionTemplate[] {
  return spec.map(([name, minutes]) => ({
    id: id('section'),
    name,
    durationSec: minutes * 60,
  }))
}

/**
 * Starting point only — this is a generic Swedish-style sequence, not
 * Shelby's actual routine. Edit or replace these in the Session Builder
 * once her real body-part sequence and per-section timing are confirmed.
 */
export function buildDefaultTemplates(): SessionTemplate[] {
  return [
    {
      id: id('template'),
      name: '30-Minute Session',
      createdAt: Date.now(),
      sections: sections([
        ['Back', 8],
        ['Shoulders & Neck', 7],
        ['Arms & Hands', 5],
        ['Legs (Back)', 5],
        ['Feet', 5],
      ]),
    },
    {
      id: id('template'),
      name: '60-Minute Session',
      createdAt: Date.now(),
      sections: sections([
        ['Back', 12],
        ['Shoulders & Neck', 10],
        ['Arms & Hands', 8],
        ['Legs (Back)', 8],
        ['Legs (Front)', 8],
        ['Feet', 6],
        ['Face & Scalp', 8],
      ]),
    },
  ]
}

export function newSectionId(): string {
  return id('section')
}

export function newTemplateId(): string {
  return id('template')
}
