export function TimerDial({
  sizePx,
  remainingFraction,
  over,
  strokeWidth,
  children,
}: {
  sizePx: number
  /** 0 = time's up, 1 = full time remaining. Can go negative when over. */
  remainingFraction: number
  over: boolean
  strokeWidth: number
  children: React.ReactNode
}) {
  const radius = sizePx / 2 - strokeWidth
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, remainingFraction))
  const dashoffset = circumference * (1 - clamped)

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
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
