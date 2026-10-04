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
  const railRef = useRef<HTMLDivElement>(null)

  // Only matters when the plan overflows (very long plans, or the
  // single-row strip on a sideways phone). Adjusts the timeline's own
  // scroll offset rather than calling scrollIntoView, which would also
  // scroll the page around it.
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    function keepCurrentInView() {
      const item = rail?.children[currentIndex] as HTMLElement | undefined
      if (!rail || !item) return
      const railBox = rail.getBoundingClientRect()
      const itemBox = item.getBoundingClientRect()
      if (rail.scrollHeight > rail.clientHeight) rail.scrollTop += itemBox.top - railBox.top
      if (rail.scrollWidth > rail.clientWidth) rail.scrollLeft += itemBox.left - railBox.left
    }
    keepCurrentInView()
    window.addEventListener('resize', keepCurrentInView)
    return () => window.removeEventListener('resize', keepCurrentInView)
  }, [currentIndex, sections.length])

  return (
    <div
      ref={railRef}
      role="list"
      aria-label="Session timeline"
      className="section-timeline w-full pb-1"
    >
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
              className={`timeline-section-name mt-2 w-full text-center text-xs font-medium ${
                isCurrent
                  ? 'text-accent-300'
                    : isNext
                    ? 'text-neutral-400'
                    : 'text-neutral-400'
              }`}
            >
              {section.name}
            </p>
            <span className="timeline-section-time mt-1 text-center font-mono text-xs font-medium tabular-nums text-neutral-400">
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
