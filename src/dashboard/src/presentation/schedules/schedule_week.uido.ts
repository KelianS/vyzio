import type { AppError } from '../../common/errors/app_error'
import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'
import type { HouseClock, ScheduleRule } from '../../domain/entities/schedule_rule.entity'

export interface ScheduleWeekUido {
  rules: ScheduleRule[]
  /** Read with the rules: a channel is named by its display name, never its identifier. */
  channels: NotificationChannelSummary[]
  /** The house's current moment, marked on today's bar; null until read. */
  clock: HouseClock | null
  loading: boolean
  error: AppError | null
}

export function buildInitialScheduleWeekUido(): ScheduleWeekUido {
  return { rules: [], channels: [], clock: null, loading: true, error: null }
}
