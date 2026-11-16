import { Sheet } from '../../../common/components/sheet'
import type { ChosenEnd } from '../../../domain/entities/chosen_end.entity'
import type { Silence } from '../../../domain/entities/silence.entity'
import { endOptions } from './end_options'

/** How long the Silence lasts (NOTIF-34). */
export function SilenceSheet({
  scheduleNextChange,
  now,
  onStart,
  onClose,
}: {
  scheduleNextChange: Silence['scheduleNextChange']
  now: Date
  onStart: (end: ChosenEnd) => void
  onClose: () => void
}) {
  return (
    <Sheet
      title="Silence"
      effect="Plus de notifications. Les caméras continuent de filmer et de détecter."
      options={endOptions(scheduleNextChange, now, onStart)}
      onClose={onClose}
    />
  )
}
