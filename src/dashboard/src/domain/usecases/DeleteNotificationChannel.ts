import type { NotificationChannelName } from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

export class DeleteNotificationChannel {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  execute(channel: NotificationChannelName): Promise<boolean> {
    return this.repository.deleteChannel(channel)
  }
}
