import type {
  NotificationChannelName,
  NotificationLogEntry,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class GetNotificationLog {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<NotificationLogEntry[]> {
    return this.repository.getNotificationLog(channel)
  }
}
