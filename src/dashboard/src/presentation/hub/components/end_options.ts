import type { SheetOption } from '../../../common/components/sheet'
import type { ChosenEnd } from '../../../domain/entities/chosen_end.entity'
import type { HouseMoment } from '../../../domain/entities/schedule_rule.entity'
import { formatHouseEnd } from '../../../common/schedule/house_moment'

/** The fixed durations, in this order (NOTIF-34, PRIV-22). */
const DURATIONS: readonly { minutes: number; title: string }[] = [
  { minutes: 30, title: '30 minutes' },
  { minutes: 60, title: '1 heure' },
  { minutes: 120, title: '2 heures' },
  { minutes: 240, title: '4 heures' },
]

/** Until when the Silence or the cut lasts: until ended, until the schedule next changes when a range exists, then the durations. */
export function endOptions(
  scheduleNextChange: HouseMoment | null,
  now: Date,
  onPick: (end: ChosenEnd) => void,
): SheetOption[] {
  return [
    { key: 'resumed', title: 'Jusqu’à réactivation', onPick: () => onPick({}) },
    ...(scheduleNextChange
      ? [
          {
            key: 'schedule',
            title: `Jusqu’à ${formatHouseEnd(scheduleNextChange, now)}`,
            detail: 'Ensuite, la planification reprend',
            onPick: () => onPick({ until: scheduleNextChange.at }),
          },
        ]
      : []),
    ...DURATIONS.map(({ minutes, title }) => ({
      key: String(minutes),
      title,
      onPick: () => onPick({ minutes }),
    })),
  ]
}
