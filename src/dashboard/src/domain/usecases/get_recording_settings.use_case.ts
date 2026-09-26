import type { RecordingSettings } from '../entities/recording_settings.entity'
import type { RecordingSettingsRepository } from '../ports/recording_settings.port'

export class GetRecordingSettings {
  constructor(private readonly repository: RecordingSettingsRepository) {}
  execute(): Promise<RecordingSettings> {
    return this.repository.get()
  }
}
