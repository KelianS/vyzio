import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'

export type AddNotificationChannelAction =
  { type: 'LOAD_SUCCEEDED'; channels: NotificationChannelSummary[] } | { type: 'LOAD_FAILED' }
