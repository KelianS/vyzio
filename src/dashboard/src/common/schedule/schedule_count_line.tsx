import { Link } from 'react-router'
import type { AppError } from '../errors/app_error'
import type { ScheduleRule, ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'
import { ReadFailure } from '../components/error_message'
import { appliesSentence, rulesTargeting, SCHEDULES_PATH } from './schedule_types'

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

/** A camera or a channel does not list its ranges: it says how many apply, and where they are (ADR-63). */
export function ScheduleCountLine({
  rules,
  kind,
  targetId,
  error,
  onRetry,
}: ScheduleCountLineProps) {
  // Unread rules are not "no range": saying so would be a false answer.
  if (error) return <ReadFailure error={error} onRetry={onRetry} subject={SCHEDULES_UNREAD} />
  if (rules === null) return <p className="py-3 text-sm text-muted-foreground">Chargement…</p>

  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
      <span>{appliesSentence(kind, rulesTargeting(rules, kind, targetId))}</span>
      <Link to={SCHEDULES_PATH} className="text-sm underline underline-offset-2">
        Voir la planification
      </Link>
    </p>
  )
}
