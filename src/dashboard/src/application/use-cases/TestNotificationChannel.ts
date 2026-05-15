import type { TestNotificationChannelResult } from '../../domain/entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'

export class TestNotificationChannel {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: string): Promise<TestNotificationChannelResult> {
    return this.repository.testChannel(channel)
  }
}
