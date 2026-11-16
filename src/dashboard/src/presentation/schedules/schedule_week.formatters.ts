import { endsNextDay, minutesOf, WEEK_DAYS } from '../../common/schedule/schedule_types'
import { formatHouseTime } from '../../common/schedule/house_moment'
import type { ScheduleRule, ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'

/** One range as a day shows it: from its start, or its tail when it began the day before. */
export interface WeekEntry {
  readonly rule: ScheduleRule
  /** The range continues from the previous evening (SCHED-05). */
  readonly tail: boolean
}

export interface WeekDay {
  readonly value: number
  readonly name: string
  readonly short: string
  readonly entries: readonly WeekEntry[]
}

const startOf = (entry: WeekEntry) => (entry.tail ? '00:00' : entry.rule.startTime)

/** The week, Monday first: each day lists what starts on it, and the tail of what started the day before. */
export function weekOf(rules: readonly ScheduleRule[]): WeekDay[] {
  return WEEK_DAYS.map(({ value, name, short }) => {
    const previous = (value + 6) % 7
    const starting = rules
      .filter((rule) => rule.daysOfWeek.includes(value))
      .map((rule) => ({ rule, tail: false }))
    // A range ending at midnight sharp leaves nothing on the next day.
    const tails = rules
      .filter(
        (rule) =>
          rule.daysOfWeek.includes(previous) &&
          endsNextDay(rule.startTime, rule.endTime) &&
          minutesOf(rule.endTime) > 0,
      )
      .map((rule) => ({ rule, tail: true }))
    const entries = [...tails, ...starting].sort((a, b) => startOf(a).localeCompare(startOf(b)))
    return { value, name, short, entries }
  })
}

export const DAY_MINUTES = 24 * 60

/** A block is drawn at least as wide as its icon; lanes are packed on that span so drawn blocks never touch. */
const PACKED_SPAN_MINUTES = 120

/** One block of a day's bar, in minutes from midnight. */
export interface BarBlock {
  readonly entry: WeekEntry
  readonly start: number
  readonly end: number
  /** The range goes on into the next day. */
  readonly continues: boolean
  /** The row of the bar that keeps this block clear of the others. */
  readonly lane: number
}

/** A day's entries placed on its 24-hour bar, overlapping ones stacked in lanes (SCHED-05). */
export function barOf(entries: readonly WeekEntry[]): { blocks: BarBlock[]; lanes: number } {
  const laneEnds: number[] = []
  const blocks = entries.map((entry) => {
    const { startTime, endTime } = entry.rule
    const crosses = endsNextDay(startTime, endTime)
    const start = entry.tail ? 0 : minutesOf(startTime)
    const end = entry.tail || !crosses ? minutesOf(endTime) : DAY_MINUTES
    const free = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    const lane = free === -1 ? laneEnds.length : free
    laneEnds[lane] = Math.max(end, start + PACKED_SPAN_MINUTES)
    const continues = !entry.tail && crosses && minutesOf(endTime) > 0
    return { entry, start, end, continues, lane }
  })
  return { blocks, lanes: Math.max(1, laneEnds.length) }
}

/** A range's hours as its row titles them: « 22 h – 7 h » (DESIGN SYSTEM § Shared words). */
export function rangeTimes(rule: Pick<ScheduleRule, 'startTime' | 'endTime'>): string {
  return `${formatHouseTime(rule.startTime)} – ${formatHouseTime(rule.endTime)}`
}

/** The times of an entry, in the words of the week (SCHED-05). */
export function entryTimes(entry: WeekEntry): string {
  const { startTime, endTime } = entry.rule
  if (entry.tail) return `jusqu’à ${formatHouseTime(endTime)}, depuis la veille`
  return endsNextDay(startTime, endTime)
    ? `${rangeTimes(entry.rule)} le lendemain`
    : rangeTimes(entry.rule)
}

/** Its days as a sentence reads them, Monday first: « lundi au vendredi », « samedi et dimanche ». */
export function daysSummary(days: readonly number[]): string {
  if (WEEK_DAYS.every((day) => days.includes(day.value))) return 'tous les jours'
  // Consecutive days of three or more read as a span; shorter runs are named one by one.
  const runs: string[][] = []
  WEEK_DAYS.forEach((day, index) => {
    if (!days.includes(day.value)) return
    const previous = WEEK_DAYS[index - 1]
    const run = runs.at(-1)
    if (run && previous && days.includes(previous.value)) run.push(day.name.toLowerCase())
    else runs.push([day.name.toLowerCase()])
  })
  const parts = runs.flatMap((run) =>
    run.length >= 3 ? [`${run[0]} au ${run[run.length - 1]}`] : run,
  )
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`
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
