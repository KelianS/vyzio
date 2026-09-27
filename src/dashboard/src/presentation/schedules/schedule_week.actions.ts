import type { AppError } from '../../common/errors/app_error'
import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'
import type { ScheduleRule } from '../../domain/entities/schedule_rule.entity'

export type ScheduleWeekAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; rules: ScheduleRule[]; channels: NotificationChannelSummary[] }
  | { type: 'LOAD_FAILED'; error: AppError }
