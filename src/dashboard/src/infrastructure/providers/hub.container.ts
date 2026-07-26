import { GetHubOverview } from '../../domain/usecases/GetHubOverview'
import { GetSystemStats, type SystemStatsRepository } from '../../domain/usecases/GetSystemStats'
import type { HubRepository } from '../../domain/ports/HubRepository'

export interface HubContainer {
  getHubOverview: GetHubOverview
  getSystemStats: GetSystemStats
}

export function makeHubContainer(
  hubRepository: HubRepository,
  systemRepository: SystemStatsRepository,
): HubContainer {
  return {
    getHubOverview: new GetHubOverview(hubRepository),
    getSystemStats: new GetSystemStats(systemRepository),
  }
}
