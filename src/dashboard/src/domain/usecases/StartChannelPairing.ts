import type { ChannelPairing, NotificationChannelName } from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

/** Issues the code the user carries over to the conversation; pairing always starts here (ADR-50). */
export class StartChannelPairing {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<ChannelPairing | null> {
    return this.repository.startPairing(channel)
  }
}
