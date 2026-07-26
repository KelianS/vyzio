import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { NotificationLogEntry } from '../../domain/entities/NotificationChannelConfig'

export type ChannelId = 'telegram'

export interface NotificationsUido {
  selectedChannel: ChannelId
  notifLog: NotificationLogEntry[]
  detectionLabels: DetectionLabel[]
}

export function buildInitialNotificationsUido(): NotificationsUido {
  return {
    selectedChannel: 'telegram',
    notifLog: [],
    detectionLabels: [],
  }
}
