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
      name: '15-Minute Session',
      createdAt: Date.now(),
      sections: sections([
        ['Back', 5, 'back'],
        ['Shoulders & Neck', 4, 'neck_shoulders'],
        ['Arms & Hands', 3, 'arms_hands'],
        ['Feet', 3, 'feet'],
      ]),
    },
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
      name: '60-Minute Session',
      createdAt: Date.now(),
      sections: sections([
        ['Back', 12, 'back'],
        ['Shoulders & Neck', 10, 'neck_shoulders'],
        ['Arms & Hands', 8, 'arms_hands'],
        ['Legs (Back)', 8, 'legs'],
        ['Legs (Front)', 8, 'legs'],
        ['Feet', 6, 'feet'],
        ['Face & Scalp', 8, 'head_scalp'],
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
