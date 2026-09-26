import type { HubOverview } from '../entities/hub_overview.entity'

export interface HubRepository {
  getOverview(): Promise<HubOverview>
}
