import { useEffect, useRef } from 'react'
import type { SectionTemplate } from '../types'

/**
 * A deliberately quiet overview. Body zones and preference markers belong to
 * the active dial; the timeline only answers where we are and what comes next.
 */
export function SectionTimeline({
  sections,
  currentIndex,
  approaching = false,
}: {
  sections: SectionTemplate[]
  currentIndex: number
  approaching?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const rail = container.current
    const target = rail?.children[currentIndex] as HTMLElement | undefined
    if (!rail || !target) return
    rail.scrollTo({ left: Math.max(0, target.offsetLeft - rail.offsetLeft - rail.clientWidth / 3), behavior: 'auto' })
  }, [currentIndex])
  return (
    <div ref={container} role="list" aria-label="Session timeline" tabIndex={0} className={`section-timeline flex w-full gap-2 overflow-x-auto pb-1 ${sections.length > 6 ? 'many-sections' : ''}`}>
      {sections.map((section, index) => {
        const isCurrent = index === currentIndex
        const isNext = index === currentIndex + 1
        return (
          <div
            key={section.id}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            title={section.name}
            data-next={isNext && approaching ? 'true' : undefined}
            className={`flex min-w-0 flex-1 flex-col rounded-xl px-1.5 py-2 ${
              isCurrent ? 'bg-accent-900/35' : ''
            }`}
          >
            <div
              className={`h-1.5 w-full rounded-full transition-colors duration-500 ${
                index < currentIndex
                  ? 'bg-accent-700/60'
                  : isCurrent
                    ? 'bg-accent-400'
                    : 'bg-neutral-800'
              }`}
            />
            <p
              className={`mt-2 w-full truncate text-center text-xs font-medium ${
                isCurrent
                  ? 'text-accent-300'
                    : isNext
                    ? 'text-neutral-400'
                    : 'text-neutral-400'
              }`}
            >
              {section.name}
            </p>
            <span className="mt-1 h-3 text-center font-mono text-[11px] tabular-nums text-neutral-500">
              {isCurrent ? 'Now · ' : isNext && approaching ? 'Next · ' : ''}{formatAllocation(section.durationSec)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatAllocation(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return remainder ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${minutes}m`
}
