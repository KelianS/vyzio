import type {
  ChannelListening,
  NotificationChannelName,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

/** Whether the channel still hears commands — a pairing that holds says nothing about it (ADR-52). */
export class GetChannelListening {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<ChannelListening | null> {
    return this.repository.getListening(channel)
  }
}
