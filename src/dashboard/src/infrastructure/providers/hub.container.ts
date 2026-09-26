import { GetHubOverview } from '../../domain/usecases/get_hub_overview.use_case'
import {
  GetSystemStats,
  type SystemStatsRepository,
} from '../../domain/usecases/get_system_stats.use_case'
import type { HubRepository } from '../../domain/ports/hub.port'

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
