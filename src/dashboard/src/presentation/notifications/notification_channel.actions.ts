import type { AppError } from '../../common/errors/app_error'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type {
  ChannelListening,
  ChannelPairing,
  CommandJournalEntry,
  NotificationChannelConfig,
  NotificationLogEntry,
} from '../../domain/entities/notification_channel_config.entity'

export type NotificationChannelAction =
  | { type: 'CHANNEL_OPENED' }
  | { type: 'CONFIG_STARTED' }
  | { type: 'CONFIG_LOADED'; config: NotificationChannelConfig | null }
  | { type: 'CONFIG_FAILED'; error: AppError }
  | { type: 'CONFIG_REFRESH_FAILED' }
  | { type: 'LABELS_STARTED' }
  | { type: 'LABELS_LOADED'; labels: DetectionLabel[] }
  | { type: 'LABELS_FAILED'; error: AppError }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
  | { type: 'ENABLE_ASKED' }
  | { type: 'ENABLE_CLOSED' }
  | { type: 'TEST_STARTED' }
  | { type: 'TEST_FINISHED' }
  | { type: 'REMOVE_ASKED' }
  | { type: 'REMOVE_CANCELLED' }
  | { type: 'REMOVE_STARTED' }
  | { type: 'REMOVE_FINISHED' }
  | { type: 'PAIRING_STARTED' }
  | { type: 'PAIRING_LOADED'; pairing: ChannelPairing | null }
  | { type: 'PAIRING_FAILED'; error: AppError }
  | { type: 'PAIRING_REFRESH_FAILED' }
  | { type: 'LISTENING_STARTED' }
  | { type: 'LISTENING_LOADED'; listening: ChannelListening | null }
  | { type: 'LISTENING_FAILED'; error: AppError }
  | { type: 'LISTENING_REFRESH_FAILED' }
  | { type: 'START_PAIRING_STARTED' }
  | { type: 'START_PAIRING_FINISHED' }
  | { type: 'REVOKE_ASKED' }
  | { type: 'REVOKE_CANCELLED' }
  | { type: 'REVOKE_STARTED' }
  | { type: 'REVOKE_FINISHED' }
  | { type: 'LOG_STARTED' }
  | { type: 'LOG_LOADED'; log: NotificationLogEntry[] }
  | { type: 'LOG_FAILED'; error: AppError }
  | { type: 'LOG_REFRESH_FAILED' }
  | { type: 'JOURNAL_STARTED' }
  | { type: 'JOURNAL_LOADED'; journal: CommandJournalEntry[] }
  | { type: 'JOURNAL_FAILED'; error: AppError }
  | { type: 'JOURNAL_REFRESH_FAILED' }
