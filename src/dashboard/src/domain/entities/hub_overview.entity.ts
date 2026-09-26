import type { DetectionEvent } from './detection_event.entity'
import type { NotificationSummary } from './notification_summary.entity'
import type { Profile } from './profile.entity'

export interface HubOverview {
  systemHealthy: boolean
  recentEvents: DetectionEvent[]
  profiles: Profile[]
  notifications: NotificationSummary
  warnings: string[]
}
