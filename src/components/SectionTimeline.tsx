import { BodyZoneDiagram } from './BodyZoneDiagram'
import { EventMarker } from './EventMarker'
import type { PreferenceEvent, SectionTemplate } from '../types'

const MAX_MARKERS = 3

/**
 * Carries both the plan and the review: each section shows its body zone, and
 * the signals logged during it. The next section is called out here rather than
 * in a separate card.
 */
export function SectionTimeline({
  sections,
  currentIndex,
  events = [],
}: {
  sections: SectionTemplate[]
  currentIndex: number
  events?: PreferenceEvent[]
}) {
  return (
    <div className="flex w-full gap-2">
      {sections.map((section, index) => {
        const sectionEvents = events.filter((e) => e.sectionId === section.id)
        const isCurrent = index === currentIndex
        const isNext = index === currentIndex + 1
        return (
          <div
            key={section.id}
            className={`flex flex-1 flex-col items-center rounded-xl px-1 pb-2 pt-1 ${
              isNext ? 'bg-[rgba(138,100,200,0.12)]' : ''
            }`}
          >
            <BodyZoneDiagram
              activeZone={isCurrent ? section.bodyZone : undefined}
              dimZone={isNext ? section.bodyZone : undefined}
              size={isCurrent || isNext ? 34 : 26}
            />
            <div
              className={`mt-1 h-1.5 w-full rounded-full transition-colors duration-500 ${
                index < currentIndex
                  ? 'bg-accent-700/60'
                  : isCurrent
                    ? 'bg-accent-400'
                    : 'bg-neutral-800'
              }`}
            />
            <p
              className={`mt-1 truncate text-center text-sm ${
                isCurrent
                  ? 'text-accent-300'
                  : isNext
                    ? 'text-[rgb(206,186,245)]'
                    : 'text-neutral-600'
              }`}
            >
              {isNext ? `Next · ${section.name}` : section.name}
            </p>
            <div className="mt-0.5 flex h-4 items-center justify-center gap-1">
              {sectionEvents.slice(0, MAX_MARKERS).map((event) => (
                <EventMarker key={event.id} type={event.type} sizePx={14} />
              ))}
              {sectionEvents.length > MAX_MARKERS && (
                <span className="text-[10px] text-neutral-600">
                  +{sectionEvents.length - MAX_MARKERS}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
