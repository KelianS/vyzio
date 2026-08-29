import type {
  ChannelPairing,
  NotificationChannelConfig,
  NotificationChannelName,
  NotificationChannelSummary,
  NotificationLogEntry,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../../domain/entities/NotificationChannelConfig'
import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'
import { fetchJson, postJson, putJson } from '../http/fetchJson'
import { HttpError } from '../http/HttpError'

export class HttpNotificationSettingsRepository implements NotificationSettingsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async listChannels(): Promise<NotificationChannelSummary[]> {
    return fetchJson<NotificationChannelSummary[]>(`${this.apiBaseUrl}/api/notifications/channels`)
  }

  async getChannelConfig(
    channel: NotificationChannelName,
  ): Promise<NotificationChannelConfig | null> {
    try {
      return await fetchJson<NotificationChannelConfig>(this.settingsUrl(channel))
    } catch (error) {
      // Une adresse qui nomme un canal inexistant n'est pas une panne : l'ecran le dit.
      // Tout le reste en est une, et l'avaler ferait passer un serveur en vrac pour un canal vierge.
      if (error instanceof HttpError && error.status === 400) return null
      throw error
    }
  }

  async saveChannelConfig(
    channel: NotificationChannelName,
    request: SaveNotificationChannelConfigRequest,
  ): Promise<NotificationChannelConfig> {
    return putJson<NotificationChannelConfig>(this.settingsUrl(channel), request)
  }

  async testChannel(channel: NotificationChannelName): Promise<TestNotificationChannelResult> {
    return postJson<TestNotificationChannelResult>(`${this.settingsUrl(channel)}/test`)
  }

  async deleteChannel(channel: NotificationChannelName): Promise<boolean> {
    const url = this.settingsUrl(channel)
    const response = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
    if (response.status === 404) return false
    if (!response.ok) throw new HttpError(response.status, url)
    return true
  }

  async getNotificationLog(channel: NotificationChannelName): Promise<NotificationLogEntry[]> {
    return fetchJson<NotificationLogEntry[]>(`${this.apiBaseUrl}/api/notifications/log/${channel}`)
  }

  async getPairing(channel: NotificationChannelName): Promise<ChannelPairing | null> {
    try {
      return await fetchJson<ChannelPairing>(this.pairingUrl(channel))
    } catch (error) {
      // Un canal qui n'ecoute pas n'a pas d'appairage : ce n'est pas une panne, il n'y a rien a montrer.
      if (error instanceof HttpError && error.status === 400) return null
      throw error
    }
  }

  async startPairing(channel: NotificationChannelName): Promise<ChannelPairing | null> {
    try {
      return await postJson<ChannelPairing>(this.pairingUrl(channel))
    } catch (error) {
      if (error instanceof HttpError && error.status === 400) return null
      throw error
    }
  }

  async revokePairing(channel: NotificationChannelName): Promise<boolean> {
    const url = this.pairingUrl(channel)
    const response = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
    if (response.status === 404) return false
    if (!response.ok) throw new HttpError(response.status, url)
    return true
  }

  private pairingUrl(channel: NotificationChannelName) {
    return `${this.settingsUrl(channel)}/pairing`
  }

  private settingsUrl(channel: NotificationChannelName) {
    return `${this.apiBaseUrl}/api/notifications/settings/${channel}`
  }
}
