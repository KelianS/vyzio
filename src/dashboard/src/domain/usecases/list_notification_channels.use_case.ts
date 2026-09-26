import type { NotificationChannelSummary } from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class ListNotificationChannels {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(): Promise<NotificationChannelSummary[]> {
    return this.repository.listChannels()
  }
}
