import { BellOff, EyeOff, type LucideIcon } from 'lucide-react'
import {
  ScheduleRuleKind,
  ScheduleTargetKind,
  type ScheduleRule,
} from '../../domain/entities/schedule_rule.entity'

/** Where the house's calendar lives (ADR-15). */
export const SCHEDULES_PATH = '/settings/schedule'

/** Carries the type of a range to add, from the list it is added to (SCHED-10). */
export const KIND_PARAM = 'kind'

/** A rule type in the interface's words: the same name, icon and effect everywhere (DESIGN SYSTEM § Shared words). */
interface ScheduleTypeCopy {
  readonly name: string
  readonly effect: string
  readonly icon: LucideIcon
  readonly targetKind: ScheduleTargetKind
  /** The calendar's fill, a pattern as well as a colour (DESIGN SYSTEM § Palette). */
  readonly fill: string
}

export const SCHEDULE_TYPES: Record<ScheduleRuleKind, ScheduleTypeCopy> = {
  [ScheduleRuleKind.Privacy]: {
    name: 'Caméras coupées',
    effect: 'Aucun enregistrement, aucune détection, aucune notification.',
    icon: EyeOff,
    targetKind: ScheduleTargetKind.Camera,
    fill: 'bg-input text-ink-muted',
  },
  [ScheduleRuleKind.MuteNotifications]: {
    name: 'Silence',
    effect: 'Filme et enregistre, mais n’envoie aucune notification.',
    icon: BellOff,
    targetKind: ScheduleTargetKind.Channel,
    fill: 'bg-silence/22 text-silence',
  },
}

/** The order types are offered in. */
export const SCHEDULE_KINDS: readonly ScheduleRuleKind[] = [
  ScheduleRuleKind.Privacy,
  ScheduleRuleKind.MuteNotifications,
]

/** Monday first, as a French week reads; the values are the API's, 0 = Sunday. */
export const WEEK_DAYS: readonly {
  readonly value: number
  readonly name: string
  /** What fits beside a day's bar on a phone. */
  readonly short: string
}[] = [
  { value: 1, name: 'Lundi', short: 'Lun' },
  { value: 2, name: 'Mardi', short: 'Mar' },
  { value: 3, name: 'Mercredi', short: 'Mer' },
  { value: 4, name: 'Jeudi', short: 'Jeu' },
  { value: 5, name: 'Vendredi', short: 'Ven' },
  { value: 6, name: 'Samedi', short: 'Sam' },
  { value: 0, name: 'Dimanche', short: 'Dim' },
]

/** Minutes from midnight of an "HH:mm" time. */
export const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** A range ending before it starts runs into the next day (SCHED-05); an unset time says nothing. */
export const endsNextDay = (start: string, end: string) =>
  start !== '' && end !== '' && minutesOf(end) < minutesOf(start)

/** How many rules of one type aim at one camera or channel. */
export function rulesTargeting(rules: readonly ScheduleRule[], kind: ScheduleRuleKind, id: string) {
  return rules.filter((rule) => rule.kind === kind && rule.targetIds.includes(id)).length
}

/** How many ranges apply, said only when some do: none is the ordinary case (UI-31). */
export function rangeCount(count: number): string | null {
  if (count === 0) return null
  return count === 1 ? '1 plage' : `${count} plages`
}
