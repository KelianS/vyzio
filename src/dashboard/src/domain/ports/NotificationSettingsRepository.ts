import type {
  NotificationChannelConfig,
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
}
