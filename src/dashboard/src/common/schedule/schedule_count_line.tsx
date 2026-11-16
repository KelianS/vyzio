import { CalendarClock } from 'lucide-react'
import type { AppError } from '../errors/app_error'
import type { ScheduleRule, ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'
import { ReadFailure } from '../components/error_message'
import { appliesSentence, rulesTargeting, SCHEDULES_PATH } from './schedule_types'
import { Loading } from '../components/loading'
import { SecondaryButton } from '../components/secondary_button'

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

/** A camera or a channel does not list its ranges: it says how many apply, and where they are (ADR-15). */
export function ScheduleCountLine({
  rules,
  kind,
  targetId,
  error,
  onRetry,
}: ScheduleCountLineProps) {
  // Unread rules are not "no range": saying so would be a false answer.
  if (error) return <ReadFailure error={error} onRetry={onRetry} subject={SCHEDULES_UNREAD} />
  if (rules === null) return <Loading lines={1} className="py-3" />

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="mx-1">{appliesSentence(kind, rulesTargeting(rules, kind, targetId))}</p>
      <SecondaryButton icon={CalendarClock} to={SCHEDULES_PATH}>
        Voir la planification
      </SecondaryButton>
    </div>
  )
}
