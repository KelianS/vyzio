import type { ChannelPairing, NotificationChannelName } from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class GetChannelPairing {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<ChannelPairing | null> {
    return this.repository.getPairing(channel)
  }
}
