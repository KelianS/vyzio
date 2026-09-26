import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../entities/recording_settings.entity'
import type { RecordingSettingsRepository } from '../ports/recording_settings.port'

export class SaveRecordingSettings {
  constructor(private readonly repository: RecordingSettingsRepository) {}
  execute(update: RecordingSettingsUpdate): Promise<RecordingSettings> {
    return this.repository.save(update)
  }
}
