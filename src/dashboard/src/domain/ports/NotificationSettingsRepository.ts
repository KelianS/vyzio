import type {
  NotificationChannelConfig,
  NotificationChannelName,
  NotificationChannelSummary,
  NotificationLogEntry,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../entities/NotificationChannelConfig'

export interface NotificationSettingsRepository {
  listChannels(): Promise<NotificationChannelSummary[]>
  getChannelConfig(channel: NotificationChannelName): Promise<NotificationChannelConfig | null>
  saveChannelConfig(
    channel: NotificationChannelName,
    request: SaveNotificationChannelConfigRequest,
  ): Promise<NotificationChannelConfig>
  testChannel(channel: NotificationChannelName): Promise<TestNotificationChannelResult>
  deleteChannel(channel: NotificationChannelName): Promise<boolean>
  getNotificationLog(channel: NotificationChannelName): Promise<NotificationLogEntry[]>
}
