import type { RecordingSettings, RecordingSettingsUpdate } from '../entities/RecordingSettings'

export interface RecordingSettingsRepository {
  get(): Promise<RecordingSettings>
  save(update: RecordingSettingsUpdate): Promise<RecordingSettings>
}
