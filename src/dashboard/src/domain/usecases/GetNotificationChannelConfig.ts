import type {
  NotificationChannelConfig,
  NotificationChannelName,
} from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class GetNotificationChannelConfig {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<NotificationChannelConfig | null> {
    return this.repository.getChannelConfig(channel)
  }
}
