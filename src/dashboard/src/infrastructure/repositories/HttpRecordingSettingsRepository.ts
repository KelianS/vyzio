import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../../domain/entities/RecordingSettings'
import type { RecordingSettingsRepository } from '../../domain/ports/RecordingSettingsRepository'
import { fetchJson, putJson } from '../http/fetchJson'

export class HttpRecordingSettingsRepository implements RecordingSettingsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async get(): Promise<RecordingSettings> {
    return fetchJson<RecordingSettings>(`${this.apiBaseUrl}/api/settings/recording`)
  }

  async save(update: RecordingSettingsUpdate): Promise<RecordingSettings> {
    return putJson<RecordingSettings>(`${this.apiBaseUrl}/api/settings/recording`, update)
  }
}
