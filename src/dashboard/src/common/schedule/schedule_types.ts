import { BellOff, EyeOff, type LucideIcon } from 'lucide-react'
import {
  ScheduleRuleKind,
  ScheduleTargetKind,
  type ScheduleRule,
} from '../../domain/entities/schedule_rule.entity'

/** Where the house's calendar lives (ADR-63). */
export const SCHEDULES_PATH = '/settings/planification'

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
    name: 'Vie privée',
    effect: 'Aucun enregistrement, aucune détection, aucune notification.',
    icon: EyeOff,
    targetKind: ScheduleTargetKind.Camera,
    fill: 'bg-surface-inverse text-surface-inverse-foreground',
  },
  [ScheduleRuleKind.MuteNotifications]: {
    name: 'Sans notification',
    effect: 'Filme et enregistre, mais n’envoie aucune notification.',
    icon: BellOff,
    targetKind: ScheduleTargetKind.Channel,
    fill: 'bg-stripes text-accent-foreground',
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

/** A range ending before it starts runs into the next day (SPECS 7.3); an unset time says nothing. */
export const endsNextDay = (start: string, end: string) =>
  start !== '' && end !== '' && minutesOf(end) < minutesOf(start)

/** How many rules of one type aim at one camera or channel. */
export function rulesTargeting(rules: readonly ScheduleRule[], kind: ScheduleRuleKind, id: string) {
  return rules.filter((rule) => rule.kind === kind && rule.targetIds.includes(id)).length
}

/** What a camera or a channel says about the ranges of one type that apply to it. */
export function appliesSentence(kind: ScheduleRuleKind, count: number): string {
  const name = `« ${SCHEDULE_TYPES[kind].name} »`
  if (count === 0) return `Aucune plage ${name} ne s’applique`
  return count === 1 ? `1 plage ${name} s’applique` : `${count} plages ${name} s’appliquent`
}
