import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type {
  ChannelListening,
  ChannelPairing,
  CommandJournalEntry,
  NotificationChannelConfig,
  NotificationLogEntry,
} from '../../domain/entities/notification_channel_config.entity'

export type NotificationChannelAction =
  | { type: 'CONFIG_STARTED' }
  | { type: 'CONFIG_LOADED'; config: NotificationChannelConfig | null }
  | { type: 'LABELS_LOADED'; labels: DetectionLabel[] }
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
  | { type: 'LISTENING_STARTED' }
  | { type: 'LISTENING_LOADED'; listening: ChannelListening | null }
  | { type: 'START_PAIRING_STARTED' }
  | { type: 'START_PAIRING_FINISHED' }
  | { type: 'REVOKE_ASKED' }
  | { type: 'REVOKE_CANCELLED' }
  | { type: 'REVOKE_STARTED' }
  | { type: 'REVOKE_FINISHED' }
  | { type: 'LOG_STARTED' }
  | { type: 'LOG_LOADED'; log: NotificationLogEntry[] }
  | { type: 'JOURNAL_STARTED' }
  | { type: 'JOURNAL_LOADED'; journal: CommandJournalEntry[] }
