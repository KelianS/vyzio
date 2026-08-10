import type { NotificationChannelSummary } from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class ListNotificationChannels {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(): Promise<NotificationChannelSummary[]> {
    return this.repository.listChannels()
  }
}
