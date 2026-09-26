import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../../domain/entities/recording_settings.entity'
import type { RecordingSettingsRepository } from '../../domain/ports/recording_settings.port'
import { fetchJson, putJson } from '../http/fetch_json'

export class HttpRecordingSettingsRepository implements RecordingSettingsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async get(): Promise<RecordingSettings> {
    return fetchJson<RecordingSettings>(`${this.apiBaseUrl}/api/settings/recording`)
  }

  async save(update: RecordingSettingsUpdate): Promise<RecordingSettings> {
    return putJson<RecordingSettings>(`${this.apiBaseUrl}/api/settings/recording`, update)
  }
}
