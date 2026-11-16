import { GetHubOverview } from '../../domain/usecases/get_hub_overview.use_case'
import {
  GetSystemStats,
  type SystemStatsRepository,
} from '../../domain/usecases/get_system_stats.use_case'
import type { HubRepository } from '../../domain/ports/hub.port'
import type { ProfileRepository } from '../../domain/ports/profile.port'
import { GetDetectionHistory } from '../../domain/usecases/get_detection_history.use_case'
import { CutCameras, GetCamerasCut } from '../../domain/usecases/cameras_cut.use_case'
import type { CamerasCutRepository } from '../../domain/ports/cameras_cut.port'

export interface HubContainer {
  getHubOverview: GetHubOverview
  getSystemStats: GetSystemStats
  getDetectionHistory: GetDetectionHistory
  getCamerasCut: GetCamerasCut
  cutCameras: CutCameras
}

export function makeHubContainer(
  hubRepository: HubRepository,
  systemRepository: SystemStatsRepository,
  profileRepository: ProfileRepository,
  camerasCutRepository: CamerasCutRepository,
): HubContainer {
  return {
    getHubOverview: new GetHubOverview(hubRepository),
    getSystemStats: new GetSystemStats(systemRepository),
    getDetectionHistory: new GetDetectionHistory(profileRepository),
    getCamerasCut: new GetCamerasCut(camerasCutRepository),
    cutCameras: new CutCameras(camerasCutRepository),
  }
}
