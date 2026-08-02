import type { RecordingSettings } from '../entities/RecordingSettings'
import type { RecordingSettingsRepository } from '../ports/RecordingSettingsRepository'

export class GetRecordingSettings {
  constructor(private readonly repository: RecordingSettingsRepository) {}
  execute(): Promise<RecordingSettings> {
    return this.repository.get()
  }
}
