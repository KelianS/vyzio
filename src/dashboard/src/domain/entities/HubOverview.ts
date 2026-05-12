import type { DetectionEvent } from './DetectionEvent'
import type { NotificationSummary } from './NotificationSummary'
import type { Profile } from './Profile'

export interface HubOverview {
  systemHealthy: boolean
  recentEvents: DetectionEvent[]
  profiles: Profile[]
  notifications: NotificationSummary
  warnings: string[]
}