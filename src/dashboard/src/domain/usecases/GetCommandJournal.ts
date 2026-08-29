import type {
  CommandJournalEntry,
  NotificationChannelName,
} from '../entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../ports/NotificationSettingsRepository'

/** What the channel was asked, and how it ended (SPECS 5.4). */
export class GetCommandJournal {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  async execute(channel: NotificationChannelName): Promise<CommandJournalEntry[]> {
    return this.repository.getCommandJournal(channel)
  }
}
