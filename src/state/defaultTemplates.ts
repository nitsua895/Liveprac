import type { BodyZone, SectionTemplate, SessionTemplate } from '../types'

let idCounter = 0
function id(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now()}_${idCounter}`
}

function sections(spec: [string, number, BodyZone][]): SectionTemplate[] {
  return spec.map(([name, minutes, bodyZone]) => ({
    id: id('section'),
    name,
    durationSec: minutes * 60,
    bodyZone,
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
        ['Back', 8, 'back'],
        ['Shoulders & Neck', 7, 'neck_shoulders'],
        ['Arms & Hands', 5, 'arms_hands'],
        ['Legs (Back)', 5, 'legs'],
        ['Feet', 5, 'feet'],
      ]),
    },
    {
      id: id('template'),
      name: '50-Minute Session',
      createdAt: Date.now(),
      sections: sections([
        ['Back', 12, 'back'],
        ['Shoulders & Neck', 9, 'neck_shoulders'],
        ['Arms & Hands', 7, 'arms_hands'],
        ['Legs (Back)', 7, 'legs'],
        ['Legs (Front)', 7, 'legs'],
        ['Feet', 4, 'feet'],
        ['Face & Scalp', 4, 'head_scalp'],
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
