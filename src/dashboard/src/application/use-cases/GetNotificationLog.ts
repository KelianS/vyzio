import type { NotificationLogEntry } from '../../domain/entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'

export class GetNotificationLog {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: string): Promise<NotificationLogEntry[]> {
    return this.repository.getNotificationLog(channel)
  }
}
