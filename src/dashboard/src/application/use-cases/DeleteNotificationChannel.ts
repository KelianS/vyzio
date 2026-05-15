import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'

export class DeleteNotificationChannel {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  execute(channel: string): Promise<boolean> {
    return this.repository.deleteChannel(channel)
  }
}
