import type { NotificationLogEntry } from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class GetNotificationLog {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: string): Promise<NotificationLogEntry[]> {
    return this.repository.getNotificationLog(channel)
  }
}
