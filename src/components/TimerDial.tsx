import { EventMarker } from './EventMarker'
import type { PreferenceEventType } from '../types'

export interface DialMarker {
  id: string
  type: PreferenceEventType
  /** 0 = section start (top of the dial), 1 = section end. */
  fraction: number
}

export function TimerDial({
  sizePx,
  remainingFraction,
  over,
  strokeWidth,
  markers = [],
  children,
}: {
  sizePx: number
  /** 0 = time's up, 1 = full time remaining. Can go negative when over. */
  remainingFraction: number
  over: boolean
  strokeWidth: number
  /** Signals from the client, placed around the ring at the moment they happened. */
  markers?: DialMarker[]
  children: React.ReactNode
}) {
  const radius = sizePx / 2 - strokeWidth
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, remainingFraction))
  const dashoffset = circumference * (1 - clamped)
  const markerSize = Math.max(18, Math.round(sizePx * 0.075))

  return (
    <div className="relative" style={{ width: sizePx, height: sizePx }}>
      <svg width={sizePx} height={sizePx} className="-rotate-90">
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-neutral-800"
        />
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          className={`transition-[stroke-dashoffset] duration-500 ease-linear ${
            over ? 'stroke-red-400' : 'stroke-accent-400'
          }`}
        />
      </svg>

      {markers.map((marker) => {
        // Ring starts at 12 o'clock and runs clockwise, matching the countdown.
        const angle = marker.fraction * 2 * Math.PI - Math.PI / 2
        const x = sizePx / 2 + radius * Math.cos(angle)
        const y = sizePx / 2 + radius * Math.sin(angle)
        return (
          <span
            key={marker.id}
            className="absolute"
            style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
          >
            <EventMarker type={marker.type} sizePx={markerSize} />
          </span>
        )
      })}

      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
