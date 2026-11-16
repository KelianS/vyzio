import type { HouseMoment } from './schedule_rule.entity'

/** Every channel holds its notifications until `until`, or until the user ends it; cameras keep filming and detecting. */
export interface Silence {
  /** An expired Silence is not active. */
  active: boolean
  /** Null while active: it holds until the user ends it. */
  until: HouseMoment | null
  /** When the mute ranges next start or stop: the "Jusqu'à" option, absent without a mute range. */
  scheduleNextChange: HouseMoment | null
}
