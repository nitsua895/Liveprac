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
      role="img"
      aria-label={{ pressure_up: 'More pressure', pressure_down: 'Less pressure', loved: 'Loved this', flagged: 'Not a fan' }[type]}
      className="flex items-center justify-center rounded-full bg-neutral-950 leading-none"
      style={{
        width: sizePx,
        height: sizePx,
        border: `1.5px solid ${EVENT_COLOR[type]}`,
        color: EVENT_COLOR[type],
        fontSize: sizePx * 0.58,
      }}
    >
      <svg viewBox="0 0 24 24" width="75%" height="75%" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {type === 'pressure_up' && <path d="M12 19V5m-6 6 6-6 6 6" />}
        {type === 'pressure_down' && <path d="M12 5v14m-6-6 6 6 6-6" />}
        {type === 'loved' && <path d="M12 20 4 12C-1 5 8 1 12 7c4-6 13-2 8 5Z" fill="currentColor" strokeWidth="1" />}
        {type === 'flagged' && <><path d="M12 5v9" /><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" /></>}
      </svg>
    </span>
  )
}
