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
  sessionFraction,
  sessionOver = false,
  markers = [],
  children,
}: {
  sizePx: number
  /** 0 = time's up, 1 = full time remaining. Can go negative when over. */
  remainingFraction: number
  over: boolean
  strokeWidth: number
  /** Optional outer ring for the full appointment, distinct from the section ring. */
  sessionFraction?: number
  sessionOver?: boolean
  /** Signals from the client, placed around the ring at the moment they happened. */
  markers?: DialMarker[]
  children: React.ReactNode
}) {
  const hasSessionRing = sessionFraction !== undefined
  const outerStroke = Math.max(4, Math.round(strokeWidth * 0.45))
  const outerRadius = sizePx / 2 - outerStroke
  const radius = sizePx / 2 - strokeWidth - (hasSessionRing ? outerStroke + 8 : 0)
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, remainingFraction))
  const dashoffset = circumference * (1 - clamped)
  const markerSize = Math.max(18, Math.round(sizePx * 0.075))
  const outerCircumference = 2 * Math.PI * outerRadius
  const outerClamped = Math.max(0, Math.min(1, sessionFraction ?? 0))

  return (
    <div className="relative" style={{ width: sizePx, height: sizePx }}>
      <svg width={sizePx} height={sizePx} className="-rotate-90">
        {hasSessionRing && (
          <>
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={outerRadius}
              fill="none"
              strokeWidth={outerStroke}
              className="stroke-neutral-900"
            />
            <circle
              cx={sizePx / 2}
              cy={sizePx / 2}
              r={outerRadius}
              fill="none"
              strokeWidth={outerStroke}
              strokeLinecap="round"
              strokeDasharray={outerCircumference}
              strokeDashoffset={outerCircumference * (1 - outerClamped)}
              className={`transition-[stroke-dashoffset] duration-500 ease-linear ${
                sessionOver ? 'stroke-red-500/60' : 'stroke-accent-700/80'
              }`}
            />
          </>
        )}
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
