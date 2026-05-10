import type { DetectionEvent } from '../entities/DetectionEvent'
import type { Profile } from '../entities/Profile'

export interface HubRepository {
  getHealth(): Promise<boolean>
  getRecentDetectionEvents(limit: number): Promise<DetectionEvent[]>
  getProfiles(): Promise<Profile[]>
}