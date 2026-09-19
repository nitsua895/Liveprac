import type { PreferenceEventType } from '../types'

export const EVENT_GLYPH: Record<PreferenceEventType, string> = {
  loved: '♥',
  flagged: '!',
  pressure_up: '▲',
  pressure_down: '▼',
}

export const EVENT_COLOR: Record<PreferenceEventType, string> = {
  loved: 'rgb(222, 100, 100)',
  flagged: 'rgb(104, 160, 214)',
  pressure_up: 'rgb(224, 158, 84)',
  pressure_down: 'rgb(224, 158, 84)',
}

export function EventMarker({ type, sizePx }: { type: PreferenceEventType; sizePx: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full bg-neutral-950 leading-none"
      style={{
        width: sizePx,
        height: sizePx,
        border: `1.5px solid ${EVENT_COLOR[type]}`,
        color: EVENT_COLOR[type],
        fontSize: sizePx * 0.58,
      }}
    >
      {EVENT_GLYPH[type]}
    </span>
  )
}
