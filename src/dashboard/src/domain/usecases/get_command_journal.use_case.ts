import type {
  CommandJournalEntry,
  NotificationChannelName,
} from '../entities/notification_channel_config.entity'
import type { NotificationSettingsRepository } from '../ports/notification_settings.port'

/** What the channel was asked, and how it ended (SPECS 5.4). */
export class GetCommandJournal {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<CommandJournalEntry[]> {
    return this.repository.getCommandJournal(channel)
  }
}
