import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../entities/recording_settings.entity'

export interface RecordingSettingsRepository {
  get(): Promise<RecordingSettings>
  save(update: RecordingSettingsUpdate): Promise<RecordingSettings>
}
