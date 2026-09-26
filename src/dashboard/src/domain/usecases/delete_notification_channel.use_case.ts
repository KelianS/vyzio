import type { NotificationChannelName } from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class DeleteNotificationChannel {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  execute(channel: NotificationChannelName): Promise<boolean> {
    return this.repository.deleteChannel(channel)
  }
}
