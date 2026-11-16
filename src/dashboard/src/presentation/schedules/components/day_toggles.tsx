import { PressableControl } from '../../../common/components/pressable'
import { WEEK_DAYS } from '../../../common/schedule/schedule_types'
import { cn } from '../../../common/ui/utils'

/** The seven days as round toggles, Monday first: each says by its fill whether the range runs that day. */
export function DayToggles({
  days,
  onToggle,
}: {
  days: readonly number[]
  onToggle: (day: number) => void
}) {
  return (
    <div role="group" aria-label="Jours" className="flex justify-between gap-1">
      {WEEK_DAYS.map((day) => {
        const on = days.includes(day.value)
        return (
          <PressableControl key={day.value}>
            <button
              type="button"
              aria-pressed={on}
              aria-label={day.name}
              className={cn(
                'size-11 shrink-0 rounded-full text-body outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                on ? 'bg-foreground font-bold text-background' : 'bg-secondary font-semibold',
              )}
              onClick={() => onToggle(day.value)}
            >
              {day.short.charAt(0)}
            </button>
          </PressableControl>
        )
      })}
    </div>
  )
}
