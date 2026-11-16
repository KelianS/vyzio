import { CalendarClock } from 'lucide-react'
import type { AppError } from '../errors/app_error'
import type { ScheduleRule, ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'
import { ReadFailure } from '../components/error_message'
import { GroupedItem, GroupedRow } from '../components/grouped_list'
import { rangeCount, rulesTargeting, SCHEDULES_PATH } from './schedule_types'
import { Loading } from '../components/loading'

export const SCHEDULES_UNREAD = 'La planification n’a pas pu être lue.'

interface ScheduleCountLineProps {
  /** The house's rules; null while not read yet. */
  rules: ScheduleRule[] | null
  kind: ScheduleRuleKind
  /** The camera or channel the line speaks for. */
  targetId: string
  error: AppError | null
  onRetry: () => void
}

/** A grouped list's row to the calendar: a camera or a channel says how many ranges apply, not which (ADR-15). */
export function ScheduleCountLine({
  rules,
  kind,
  targetId,
  error,
  onRetry,
}: ScheduleCountLineProps) {
  // Unread rules are not "no range": saying so would be a false answer.
  if (error)
    return (
      <GroupedItem>
        <ReadFailure error={error} onRetry={onRetry} subject={SCHEDULES_UNREAD} className="p-4" />
      </GroupedItem>
    )
  if (rules === null)
    return (
      <GroupedItem>
        <Loading lines={1} className="px-4 py-5" />
      </GroupedItem>
    )

  return (
    <GroupedRow
      icon={CalendarClock}
      title="Planification"
      subtitle={rangeCount(rulesTargeting(rules, kind, targetId))}
      weight="action"
      to={SCHEDULES_PATH}
    />
  )
}
