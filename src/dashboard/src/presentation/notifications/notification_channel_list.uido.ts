import type { AppError } from '../../common/errors/app_error'
import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'

export interface NotificationChannelListUido {
  channels: NotificationChannelSummary[]
  loading: boolean
  error: AppError | null
}

export function buildInitialNotificationChannelListUido(): NotificationChannelListUido {
  return { channels: [], loading: true, error: null }
}
