import type { HubRepository } from '../../domain/ports/HubRepository'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { Profile } from '../../domain/entities/Profile'
import { fetchJson } from '../http/fetchJson'

interface DetectionEventDto {
  eventId: string
  frigateEventId: string
  lifecycle: string
  camera: string
  label: string
  identity: string | null
  profileId: string | null
  confidence: number | null
  occurredAt: string
  hasClip: boolean
  hasSnapshot: boolean
}

interface ProfileDto {
  id: string
  name: string
  category: string
  alertMode: string
  lastSeenAt: string | null
  createdAt: string
}

interface HealthDto {
  status: string
}

export class HttpHubRepository implements HubRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getHealth(): Promise<boolean> {
    const payload = await fetchJson<HealthDto>(`${this.apiBaseUrl}/health`)
    return payload.status.toLowerCase() === 'ok'
  }

  async getRecentDetectionEvents(limit: number): Promise<DetectionEvent[]> {
    const payload = await fetchJson<DetectionEventDto[]>(
      `${this.apiBaseUrl}/api/detection-events/recent?limit=${limit}`,
    )

    return payload.map((event) => ({
      eventId: event.eventId,
      frigateEventId: event.frigateEventId,
      lifecycle: event.lifecycle,
      camera: event.camera,
      label: event.label,
      identity: event.identity,
      profileId: event.profileId,
      confidence: event.confidence,
      occurredAt: event.occurredAt,
      hasClip: event.hasClip,
      hasSnapshot: event.hasSnapshot,
    }))
  }

  async getProfiles(): Promise<Profile[]> {
    const payload = await fetchJson<ProfileDto[]>(`${this.apiBaseUrl}/api/profiles/`)

    return payload.map((profile) => ({
      id: profile.id,
      name: profile.name,
      category: profile.category,
      alertMode: profile.alertMode,
      lastSeenAt: profile.lastSeenAt,
      createdAt: profile.createdAt,
    }))
  }
}