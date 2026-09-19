import type { BodyZone } from '../types'

/**
 * Calm, symmetrical table-view silhouette. It stays intentionally diagrammatic
 * but uses human proportions and rounded joins so it reads cleanly at dial size.
 */
const ZONES: { zone: BodyZone; path: string }[] = [
  { zone: 'head_scalp', path: 'M100 10a21 21 0 1 1 0 42 21 21 0 0 1 0-42Z' },
  { zone: 'neck_shoulders', path: 'M86 52h28l27 13-7 17-25-10H91L66 82l-7-17 27-13Z' },
  { zone: 'back', path: 'M82 70q18-8 36 0l8 77q-26 19-52 0l8-77Z' },
  {
    zone: 'arms_hands',
    path:
      'M62 68q-9 1-12 10l-17 68q-2 10 8 13 10 2 13-8l18-69-10-14Z ' +
      'M138 68q9 1 12 10l17 68q2 10-8 13-10 2-13-8l-18-69 10-14Z',
  },
  {
    zone: 'legs',
    path:
      'M75 145q12 7 23 4l-3 91q-1 12-12 12-12 0-12-12l4-95Z ' +
      'M125 145q-12 7-23 4l3 91q1 12 12 12 12 0 12-12l-4-95Z',
  },
  {
    zone: 'feet',
    path:
      'M71 239h24l-1 25q-1 11-13 11-13 0-12-12l2-24Z ' +
      'M105 239h24l2 24q1 12-12 12-12 0-13-11l-1-25Z',
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
      viewBox="24 4 152 276"
      width={size}
      height={(size * 280) / 200}
      className="overflow-visible drop-shadow-[0_0_12px_rgba(0,0,0,0.2)]"
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
                ? 'fill-accent-400/90 stroke-accent-300'
                : isNext
                  ? 'fill-accent-500/15 stroke-accent-500/40'
                  : 'fill-neutral-800/60 stroke-neutral-700'
            }`}
            strokeWidth={1.35}
            strokeLinejoin="round"
          />
        )
      })}
    </svg>
  )
}
