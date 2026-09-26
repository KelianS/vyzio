import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'

export interface AddNotificationChannelUido {
  channels: NotificationChannelSummary[]
  loading: boolean
}

export function buildInitialAddNotificationChannelUido(): AddNotificationChannelUido {
  return { channels: [], loading: true }
}
