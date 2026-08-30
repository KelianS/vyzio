import type {
  ChannelListening,
  ChannelPairing,
  CommandJournalEntry,
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
      // An address naming a channel that does not exist is not a failure: the screen says so.
      // Everything else is one, and swallowing it would make a broken server look like a blank channel.
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
      // A channel that does not listen has no pairing: not a failure, there is nothing to show.
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

  async getListening(channel: NotificationChannelName): Promise<ChannelListening | null> {
    try {
      return await fetchJson<ChannelListening>(`${this.settingsUrl(channel)}/listening`)
    } catch (error) {
      // A channel that does not listen has no loop: nothing to show, not a failure.
      if (error instanceof HttpError && error.status === 400) return null
      throw error
    }
  }

  async getCommandJournal(channel: NotificationChannelName): Promise<CommandJournalEntry[]> {
    return fetchJson<CommandJournalEntry[]>(`${this.settingsUrl(channel)}/commands`)
  }

  private pairingUrl(channel: NotificationChannelName) {
    return `${this.settingsUrl(channel)}/pairing`
  }

  private settingsUrl(channel: NotificationChannelName) {
    return `${this.apiBaseUrl}/api/notifications/settings/${channel}`
  }
}
