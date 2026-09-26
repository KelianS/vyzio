import type {
  ChannelPairing,
  NotificationChannelName,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

/** Issues the code the user carries over to the conversation; pairing always starts here (ADR-50). */
export class StartChannelPairing {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<ChannelPairing | null> {
    return this.repository.startPairing(channel)
  }
}
