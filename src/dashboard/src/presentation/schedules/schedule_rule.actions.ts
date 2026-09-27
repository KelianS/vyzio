import type { AppError } from '../../common/errors/app_error'
import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'
import type { ScheduleRule } from '../../domain/entities/schedule_rule.entity'

export type ScheduleRuleAction =
  | { type: 'LOAD_STARTED' }
  | {
      type: 'LOAD_SUCCEEDED'
      rule: ScheduleRule | null
      channels: NotificationChannelSummary[]
    }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'RULE_GONE' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVED'; rule: ScheduleRule }
  | { type: 'ADDED' }
  | { type: 'SAVE_FAILED'; error: AppError }
  | { type: 'DELETE_ASKED' }
  | { type: 'DELETE_CANCELLED' }
  | { type: 'DELETE_STARTED' }
  | { type: 'DELETE_FAILED'; error: AppError }
