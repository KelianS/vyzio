import type { AppError } from '../../common/errors/app_error'
import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'
import type { ScheduleRule } from '../../domain/entities/schedule_rule.entity'

export interface ScheduleRuleUido {
  /** The rule being edited; null when adding one. */
  rule: ScheduleRule | null
  /** The channels a notification range can target. */
  channels: NotificationChannelSummary[]
  loading: boolean
  readError: AppError | null
  /** The rule was deleted meanwhile: said as such, never as a failed read. */
  gone: boolean
  saving: boolean
  confirmDelete: boolean
  deleting: boolean
}

export function buildInitialScheduleRuleUido(): ScheduleRuleUido {
  return {
    rule: null,
    channels: [],
    loading: true,
    readError: null,
    gone: false,
    saving: false,
    confirmDelete: false,
    deleting: false,
  }
}
