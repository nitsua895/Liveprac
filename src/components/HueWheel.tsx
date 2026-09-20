import { useRef } from 'react'

/**
 * A single-axis picker — rotate around the ring to choose a hue. There's no
 * saturation or lightness control on purpose: those are what turn "any
 * color" into "an ugly, oversaturated color," so the app fixes them (via
 * `saturation`/`lightness`, set per use — muted for the accent theme, vivid
 * for notification glows) and only ever hands over the one knob that's safe
 * to turn freely.
 */
export function HueWheel({
  hue,
  onChange,
  size = 168,
  saturation = 36,
  lightness = 55,
  label = 'Hue',
}: {
  hue: number
  onChange: (hue: number) => void
  size?: number
  saturation?: number
  lightness?: number
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  function angleFromPoint(clientX: number, clientY: number): number {
    const rect = ref.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let deg = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI) + 90
    if (deg < 0) deg += 360
    return deg
  }

  function handleMove(e: React.PointerEvent) {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return
    onChange(angleFromPoint(e.clientX, e.clientY))
  }

  const radius = size / 2
  const knobRadius = radius - 11
  const rad = ((hue - 90) * Math.PI) / 180
  const knobX = radius + knobRadius * Math.cos(rad)
  const knobY = radius + knobRadius * Math.sin(rad)

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
        handleMove(e)
      }}
      onPointerMove={handleMove}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((hue + 5) % 360)
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((hue - 5 + 360) % 360)
      }}
      className="relative touch-none select-none rounded-full outline-none"
      style={{
        width: size,
        height: size,
        background:
          'conic-gradient(from 90deg, hsl(0 75% 58%), hsl(60 75% 58%), hsl(120 75% 58%), hsl(180 75% 58%), hsl(240 75% 58%), hsl(300 75% 58%), hsl(360 75% 58%))',
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          inset: '20%',
          background: `hsl(${hue} ${saturation}% ${lightness}%)`,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      />
      <div
        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        style={{ left: knobX, top: knobY, background: `hsl(${hue} 75% 58%)` }}
      />
    </div>
  )
}
