import type { RecordingSettings, RecordingSettingsUpdate } from '../entities/RecordingSettings'
import type { RecordingSettingsRepository } from '../ports/RecordingSettingsRepository'

export class SaveRecordingSettings {
  constructor(private readonly repository: RecordingSettingsRepository) {}
  execute(update: RecordingSettingsUpdate): Promise<RecordingSettings> {
    return this.repository.save(update)
  }
}
