import type { NotificationChannelName } from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class RevokeChannelPairing {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<boolean> {
    return this.repository.revokePairing(channel)
  }
}
