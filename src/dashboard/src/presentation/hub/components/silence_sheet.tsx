import { Sheet, type SheetOption } from '../../../common/components/sheet'
import type { Silence, StartSilenceRequest } from '../../../domain/entities/silence.entity'
import { formatHouseEnd } from '../../../common/schedule/house_moment'

/** The fixed durations, in this order (NOTIF-34). */
const DURATIONS: readonly { minutes: number; title: string }[] = [
  { minutes: 30, title: '30 minutes' },
  { minutes: 60, title: '1 heure' },
  { minutes: 120, title: '2 heures' },
  { minutes: 240, title: '4 heures' },
]

/** How long the Silence lasts: until the schedule next changes when a Silence range exists, then the durations. */
export function SilenceSheet({
  scheduleNextChange,
  now,
  onStart,
  onClose,
}: {
  scheduleNextChange: Silence['scheduleNextChange']
  now: Date
  onStart: (request: StartSilenceRequest) => void
  onClose: () => void
}) {
  const options: SheetOption[] = [
    ...(scheduleNextChange
      ? [
          {
            key: 'schedule',
            title: `Jusqu’à ${formatHouseEnd(scheduleNextChange, now)}`,
            detail: 'Ensuite, la planification reprend',
            onPick: () => onStart({ until: scheduleNextChange.at }),
          },
        ]
      : []),
    ...DURATIONS.map(({ minutes, title }) => ({
      key: String(minutes),
      title,
      onPick: () => onStart({ minutes }),
    })),
  ]

  return (
    <Sheet
      title="Silence"
      effect="Plus de notifications. Les caméras continuent de filmer et de détecter."
      options={options}
      onClose={onClose}
    />
  )
}
