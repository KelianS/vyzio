/** What a scheduled rule does to its targets during its range (ADR-63). */
export const ScheduleRuleKind = {
  Privacy: 'privacy',
  MuteNotifications: 'mute_notifications',
} as const

export type ScheduleRuleKind = (typeof ScheduleRuleKind)[keyof typeof ScheduleRuleKind]

const KNOWN_KINDS: ReadonlySet<string> = new Set(Object.values(ScheduleRuleKind))

export function isScheduleRuleKind(value: string): value is ScheduleRuleKind {
  return KNOWN_KINDS.has(value)
}

/** What the identifiers of a rule's targets name: the type declares it. */
export const ScheduleTargetKind = {
  Camera: 'camera',
  Channel: 'channel',
} as const

export type ScheduleTargetKind = (typeof ScheduleTargetKind)[keyof typeof ScheduleTargetKind]

/** The range and the targets, the part of a rule that can change once it exists. */
export interface ScheduleRuleInput {
  targetIds: string[]
  /** [0..6], 0 = Sunday. */
  daysOfWeek: number[]
  /** "HH:mm", the house's clock. */
  startTime: string
  /** "HH:mm"; before the start, the range ends the next day. */
  endTime: string
}

export interface NewScheduleRule extends ScheduleRuleInput {
  kind: ScheduleRuleKind
}

export interface ScheduleRule extends NewScheduleRule {
  id: string
  createdAt: string
}

/** The current moment in the house's clock (ADR-63), never the consulting device's. */
export interface HouseClock {
  /** [0..6], 0 = Sunday. */
  dayOfWeek: number
  /** "HH:mm". */
  time: string
}
