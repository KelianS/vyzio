import type {
  ChannelPairing,
  NotificationChannelName,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class GetChannelPairing {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<ChannelPairing | null> {
    return this.repository.getPairing(channel)
  }
}
