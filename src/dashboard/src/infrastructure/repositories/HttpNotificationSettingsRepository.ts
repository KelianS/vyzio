import type {
  NotificationChannelConfig,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../../domain/entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'
import { fetchJson } from '../http/fetchJson'

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
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`)
  return response.json() as Promise<T>
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`)
  return response.json() as Promise<T>
}
