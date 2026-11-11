import { GetHubOverview } from '../../domain/usecases/get_hub_overview.use_case'
import {
  GetSystemStats,
  type SystemStatsRepository,
} from '../../domain/usecases/get_system_stats.use_case'
import type { HubRepository } from '../../domain/ports/hub.port'
import type { ProfileRepository } from '../../domain/ports/profile.port'
import { CheckDetectionClip } from '../../domain/usecases/check_detection_clip.use_case'

export interface HubContainer {
  getHubOverview: GetHubOverview
  getSystemStats: GetSystemStats
  checkDetectionClip: CheckDetectionClip
}

export function makeHubContainer(
  hubRepository: HubRepository,
  systemRepository: SystemStatsRepository,
  profileRepository: ProfileRepository,
): HubContainer {
  return {
    getHubOverview: new GetHubOverview(hubRepository),
    getSystemStats: new GetSystemStats(systemRepository),
    checkDetectionClip: new CheckDetectionClip(profileRepository),
  }
}
