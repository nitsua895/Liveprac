import type { BodyZone } from '../types'

export const BODY_ZONE_LABELS: Record<BodyZone, string> = {
  head_scalp: 'Head & Scalp',
  neck_shoulders: 'Neck & Shoulders',
  back: 'Back',
  arms_hands: 'Arms & Hands',
  legs: 'Legs',
  feet: 'Feet',
  none: 'No zone',
}

export const BODY_ZONES: BodyZone[] = [
  'none',
  'head_scalp',
  'neck_shoulders',
  'back',
  'arms_hands',
  'legs',
  'feet',
]
