import type { HouseMoment } from './schedule_rule.entity'

/** What the cut of every camera offers besides its durations (PRIV-22). */
export interface CamerasCut {
  /** When the privacy ranges next start or stop: the "Jusqu'à" option, absent without a privacy range. */
  scheduleNextChange: HouseMoment | null
}
