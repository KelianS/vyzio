import type {
  NotificationChannelConfig,
  NotificationChannelName,
  SaveNotificationChannelConfigRequest,
} from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class SaveNotificationChannelConfig {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(
    channel: NotificationChannelName,
    request: SaveNotificationChannelConfigRequest,
  ): Promise<NotificationChannelConfig> {
    return this.repository.saveChannelConfig(channel, request)
  }
}
