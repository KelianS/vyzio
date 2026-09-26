import type {
  NotificationChannelName,
  TestNotificationChannelResult,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

export class TestNotificationChannel {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<TestNotificationChannelResult> {
    return this.repository.testChannel(channel)
  }
}
