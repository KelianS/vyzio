import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'

export interface NotificationChannelListUido {
  channels: NotificationChannelSummary[]
  loading: boolean
}

export function buildInitialNotificationChannelListUido(): NotificationChannelListUido {
  return { channels: [], loading: true }
}
