import type { BodyZone } from '../types'

/**
 * Abstract top-down view of a person on a table — not anatomical, just
 * enough shape per zone to be recognizable at a glance. "Legs (Back)" and
 * "Legs (Front)" both highlight the same leg shapes; the diagram can't show
 * which side of the client is up, only which region is being worked.
 */
const ZONES: { zone: BodyZone; path: string }[] = [
  { zone: 'head_scalp', path: 'M 100 14 a 22 22 0 1 0 0.01 0' },
  { zone: 'neck_shoulders', path: 'M 62 40 h 76 a 8 8 0 0 1 8 8 v 10 h -92 v -10 a 8 8 0 0 1 8 -8 z' },
  { zone: 'back', path: 'M 70 60 h 60 v 90 a 30 30 0 0 1 -60 0 z' },
  {
    zone: 'arms_hands',
    path:
      'M 62 60 h -14 a 8 8 0 0 0 -8 8 v 80 a 8 8 0 0 0 8 8 h 10 a 8 8 0 0 0 8 -8 v -88 z ' +
      'M 138 60 h 14 a 8 8 0 0 1 8 8 v 80 a 8 8 0 0 1 -8 8 h -10 a 8 8 0 0 1 -8 -8 v -88 z',
  },
  {
    zone: 'legs',
    path:
      'M 74 150 h 22 v 90 a 11 11 0 0 1 -22 0 z ' +
      'M 104 150 h 22 v 90 a 11 11 0 0 1 -22 0 z',
  },
  {
    zone: 'feet',
    path:
      'M 74 240 h 22 v 22 a 11 11 0 0 1 -22 0 z ' +
      'M 104 240 h 22 v 22 a 11 11 0 0 1 -22 0 z',
  },
]

export function BodyZoneDiagram({
  activeZone,
  dimZone,
  size = 120,
}: {
  activeZone?: BodyZone
  dimZone?: BodyZone
  size?: number
}) {
  return (
    <svg
      viewBox="0 0 200 280"
      width={size}
      height={(size * 280) / 200}
      className="overflow-visible"
    >
      {ZONES.map(({ zone, path }) => {
        const isActive = zone === activeZone
        const isNext = zone === dimZone && zone !== activeZone
        return (
          <path
            key={zone}
            d={path}
            className={`transition-all duration-700 ${
              isActive
                ? 'fill-amber-400/90 stroke-amber-300'
                : isNext
                  ? 'fill-amber-500/15 stroke-amber-500/40'
                  : 'fill-neutral-800/60 stroke-neutral-700'
            }`}
            strokeWidth={1.5}
          />
        )
      })}
    </svg>
  )
}
