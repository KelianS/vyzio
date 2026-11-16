import type { HouseMoment } from './schedule_rule.entity'

/** Every channel holds its notifications until `until`; cameras keep filming and detecting. */
export interface Silence {
  /** An expired Silence is not active. */
  active: boolean
  until: HouseMoment | null
  /** When the mute ranges next start or stop: the "Jusqu'à" option, absent without a mute range. */
  scheduleNextChange: HouseMoment | null
}

/** Exactly one of the two: an end instant, or a duration in minutes from now. */
export type StartSilenceRequest = { until: string } | { minutes: number }
