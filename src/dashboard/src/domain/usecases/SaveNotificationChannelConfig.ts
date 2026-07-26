import type {
  NotificationChannelConfig,
  SaveNotificationChannelConfigRequest,
} from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class SaveNotificationChannelConfig {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(
    channel: string,
    request: SaveNotificationChannelConfigRequest,
  ): Promise<NotificationChannelConfig> {
    return this.repository.saveChannelConfig(channel, request)
  }
}
