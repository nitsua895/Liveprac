import { EventMarker } from './EventMarker'
import type { PreferenceEvent, SectionTemplate } from '../types'

const MAX_MARKERS = 4

export function SectionTimeline({
  sections,
  currentIndex,
  events = [],
}: {
  sections: SectionTemplate[]
  currentIndex: number
  /** Signals for this session, shown under the section they happened in. */
  events?: PreferenceEvent[]
}) {
  return (
    <div className="flex w-full gap-1.5">
      {sections.map((section, index) => {
        const sectionEvents = events.filter((e) => e.sectionId === section.id)
        return (
          <div key={section.id} className="flex flex-1 flex-col">
            <div
              className={`h-1.5 rounded-full transition-colors duration-500 ${
                index < currentIndex
                  ? 'bg-accent-700/60'
                  : index === currentIndex
                    ? 'bg-accent-400'
                    : 'bg-neutral-800'
              }`}
            />
            <p
              className={`mt-2 truncate text-center text-xs ${
                index === currentIndex ? 'text-accent-300' : 'text-neutral-600'
              }`}
            >
              {section.name}
            </p>
            <div className="mt-1 flex h-5 items-center justify-center gap-1">
              {sectionEvents.slice(0, MAX_MARKERS).map((event) => (
                <EventMarker key={event.id} type={event.type} sizePx={16} />
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
