import type { NotificationChannelConfig } from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class GetNotificationChannelConfig {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: string): Promise<NotificationChannelConfig | null> {
    return this.repository.getChannelConfig(channel)
  }
}
