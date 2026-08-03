import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { HubOverview } from '../../domain/entities/HubOverview'
import type { NotificationSummary } from '../../domain/entities/NotificationSummary'
import type { Profile, ProfileAlertMode, ProfileCategory } from '../../domain/entities/Profile'
import type { HubRepository } from '../../domain/ports/HubRepository'
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
  category: ProfileCategory
  alertMode: ProfileAlertMode
  lastSeenAt: string | null
  createdAt: string
}

interface NotificationSummaryDto {
  telegramConfigured: boolean
  sentCount: number
  lastSentAt: string | null
}

export class HttpHubRepository implements HubRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getOverview(): Promise<HubOverview> {
    const payload = await fetchJson<{
      systemHealthy: boolean
      recentEvents: DetectionEventDto[]
      profiles: ProfileDto[]
      notifications: NotificationSummaryDto
      warnings: string[]
    }>(`${this.apiBaseUrl}/api/hub/overview`)

    return {
      systemHealthy: payload.systemHealthy,
      recentEvents: payload.recentEvents.map(mapDetectionEvent),
      profiles: payload.profiles.map(mapProfile),
      notifications: mapNotificationSummary(payload.notifications),
      warnings: payload.warnings,
    }
  }
}

function mapDetectionEvent(event: DetectionEventDto): DetectionEvent {
  return {
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
  }
}

function mapProfile(profile: ProfileDto): Profile {
  return {
    id: profile.id,
    name: profile.name,
    category: profile.category,
    alertMode: profile.alertMode,
    lastSeenAt: profile.lastSeenAt,
    createdAt: profile.createdAt,
  }
}

function mapNotificationSummary(summary: NotificationSummaryDto): NotificationSummary {
  return {
    telegramConfigured: summary.telegramConfigured,
    sentCount: summary.sentCount,
    lastSentAt: summary.lastSentAt,
  }
}
