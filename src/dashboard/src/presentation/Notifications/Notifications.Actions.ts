import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { NotificationLogEntry } from '../../domain/entities/NotificationChannelConfig'
import type { ChannelId } from './Notifications.Uido'

export type NotificationsAction =
  | { type: 'CHANNEL_SELECTED'; channel: ChannelId }
  | { type: 'LOG_LOADED'; entries: NotificationLogEntry[] }
  | { type: 'LABELS_LOADED'; labels: DetectionLabel[] }
