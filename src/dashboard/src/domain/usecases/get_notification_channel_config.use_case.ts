import type {
  NotificationChannelConfig,
  NotificationChannelName,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class GetNotificationChannelConfig {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<NotificationChannelConfig | null> {
    return this.repository.getChannelConfig(channel)
  }
}
