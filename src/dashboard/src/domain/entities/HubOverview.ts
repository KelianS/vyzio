import type { DetectionEvent } from './DetectionEvent'
import type { Profile } from './Profile'

export interface HubOverview {
  systemHealthy: boolean
  recentEvents: DetectionEvent[]
  profiles: Profile[]
}