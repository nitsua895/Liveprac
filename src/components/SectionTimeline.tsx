import type { SectionTemplate } from '../types'

export function SectionTimeline({
  sections,
  currentIndex,
}: {
  sections: SectionTemplate[]
  currentIndex: number
}) {
  return (
    <div className="flex w-full gap-1.5">
      {sections.map((section, index) => (
        <div key={section.id} className="flex-1">
          <div
            className={`h-1.5 rounded-full transition-colors duration-500 ${
              index < currentIndex
                ? 'bg-amber-700/60'
                : index === currentIndex
                  ? 'bg-amber-400'
                  : 'bg-neutral-800'
            }`}
          />
          <p
            className={`mt-2 truncate text-center text-xs ${
              index === currentIndex ? 'text-amber-300' : 'text-neutral-600'
            }`}
          >
            {section.name}
          </p>
        </div>
      ))}
    </div>
  )
}
