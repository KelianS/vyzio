import type {
  ChannelListening,
  NotificationChannelName,
} from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

/** Whether the channel still hears commands — a pairing that holds says nothing about it (ADR-52). */
export class GetChannelListening {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<ChannelListening | null> {
    return this.repository.getListening(channel)
  }
}
