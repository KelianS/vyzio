import type {
  NotificationChannelConfig,
  NotificationLogEntry,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../../domain/entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'
import { fetchJson, postJson, putJson } from '../http/fetchJson'
import { HttpError } from '../http/HttpError'

export class HttpNotificationSettingsRepository implements NotificationSettingsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getChannelConfig(channel: string): Promise<NotificationChannelConfig | null> {
    try {
      return await fetchJson<NotificationChannelConfig>(
        `${this.apiBaseUrl}/api/notifications/settings/${channel}`,
      )
    } catch {
      return null
    }
  }

  async saveChannelConfig(
    channel: string,
    request: SaveNotificationChannelConfigRequest,
  ): Promise<NotificationChannelConfig> {
    return putJson<NotificationChannelConfig>(
      `${this.apiBaseUrl}/api/notifications/settings/${channel}`,
      request,
    )
  }

  async testChannel(channel: string): Promise<TestNotificationChannelResult> {
    return postJson<TestNotificationChannelResult>(
      `${this.apiBaseUrl}/api/notifications/settings/${channel}/test`,
    )
  }

  async deleteChannel(channel: string): Promise<boolean> {
    const url = `${this.apiBaseUrl}/api/notifications/settings/${channel}`
    const response = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
    if (response.status === 404) return false
    if (!response.ok) throw new HttpError(response.status, url)
    return true
  }

  async getNotificationLog(channel: string): Promise<NotificationLogEntry[]> {
    try {
      return await fetchJson<NotificationLogEntry[]>(
        `${this.apiBaseUrl}/api/notifications/log/${channel}`,
      )
    } catch {
      return []
    }
  }
}
