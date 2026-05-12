import type { HubOverview } from '../entities/HubOverview'

export interface HubRepository {
  getOverview(): Promise<HubOverview>
}