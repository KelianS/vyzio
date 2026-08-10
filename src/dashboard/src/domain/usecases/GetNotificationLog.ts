import type {
  NotificationChannelName,
  NotificationLogEntry,
} from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class GetNotificationLog {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<NotificationLogEntry[]> {
    return this.repository.getNotificationLog(channel)
  }
}
