import type { NotificationChannelName } from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class RevokeChannelPairing {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<boolean> {
    return this.repository.revokePairing(channel)
  }
}
