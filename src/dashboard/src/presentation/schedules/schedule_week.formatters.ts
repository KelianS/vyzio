import { endsNextDay, WEEK_DAYS } from '../../common/schedule/schedule_types'
import type { ScheduleRule, ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'

/** One range as a day shows it: from its start, or its tail when it began the day before. */
export interface WeekEntry {
  readonly rule: ScheduleRule
  /** The range continues from the previous evening (SPECS 7.3). */
  readonly tail: boolean
}

export interface WeekDay {
  readonly value: number
  readonly name: string
  readonly entries: readonly WeekEntry[]
}

const startOf = (entry: WeekEntry) => (entry.tail ? '00:00' : entry.rule.startTime)

/** The week, Monday first: each day lists what starts on it, and the tail of what started the day before. */
export function weekOf(rules: readonly ScheduleRule[]): WeekDay[] {
  return WEEK_DAYS.map(({ value, name }) => {
    const previous = (value + 6) % 7
    const starting = rules
      .filter((rule) => rule.daysOfWeek.includes(value))
      .map((rule) => ({ rule, tail: false }))
    const tails = rules
      .filter(
        (rule) => rule.daysOfWeek.includes(previous) && endsNextDay(rule.startTime, rule.endTime),
      )
      .map((rule) => ({ rule, tail: true }))
    const entries = [...tails, ...starting].sort((a, b) => startOf(a).localeCompare(startOf(b)))
    return { value, name, entries }
  })
}

/** The times of an entry, in the words of the week (DESIGN SYSTEM § Calendar). */
export function entryTimes(entry: WeekEntry): string {
  const { startTime, endTime } = entry.rule
  if (entry.tail) return `jusqu’à ${endTime}, depuis la veille`
  return endsNextDay(startTime, endTime)
    ? `${startTime} → ${endTime} le lendemain`
    : `${startTime} → ${endTime}`
}

/** Beyond two names the row would wrap on a phone: the rest is a count. */
const NAMES_SHOWN = 2

/** The targets a rule names that still exist (`nameOf` answers undefined otherwise); null when none is left. */
export function targetSummary(
  rule: ScheduleRule,
  nameOf: (kind: ScheduleRuleKind, id: string) => string | undefined,
): string | null {
  const names = rule.targetIds
    .map((id) => nameOf(rule.kind, id))
    .filter((name): name is string => name !== undefined)
  if (names.length === 0) return null
  const shown = names.slice(0, NAMES_SHOWN).join(', ')
  const rest = names.length - NAMES_SHOWN
  if (rest <= 0) return shown
  return rest === 1 ? `${shown} et 1 autre` : `${shown} et ${rest} autres`
}
