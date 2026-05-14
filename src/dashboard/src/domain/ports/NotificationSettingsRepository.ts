import type {
  NotificationChannelConfig,
  NotificationLogEntry,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../entities/NotificationChannelConfig'

export interface NotificationSettingsRepository {
  getChannelConfig(channel: string): Promise<NotificationChannelConfig | null>
  saveChannelConfig(
    channel: string,
    request: SaveNotificationChannelConfigRequest,
  ): Promise<NotificationChannelConfig>
  testChannel(channel: string): Promise<TestNotificationChannelResult>
  deleteChannel(channel: string): Promise<boolean>
  getNotificationLog(channel: string): Promise<NotificationLogEntry[]>
}
