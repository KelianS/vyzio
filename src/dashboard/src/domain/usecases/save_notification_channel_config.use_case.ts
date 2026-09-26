import type {
  NotificationChannelConfig,
  NotificationChannelName,
  SaveNotificationChannelConfigRequest,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class SaveNotificationChannelConfig {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(
    channel: NotificationChannelName,
    request: SaveNotificationChannelConfigRequest,
  ): Promise<NotificationChannelConfig> {
    return this.repository.saveChannelConfig(channel, request)
  }
}
