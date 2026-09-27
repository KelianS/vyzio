import type { AppError } from '../../common/errors/app_error'
import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'
import type { ScheduleRule } from '../../domain/entities/schedule_rule.entity'

export interface ScheduleWeekUido {
  rules: ScheduleRule[]
  /** Read with the rules: a channel is named by its display name, never its identifier. */
  channels: NotificationChannelSummary[]
  loading: boolean
  error: AppError | null
}

export function buildInitialScheduleWeekUido(): ScheduleWeekUido {
  return { rules: [], channels: [], loading: true, error: null }
}
