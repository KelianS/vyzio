import type { DetectionConfig, DetectionConfigUpdate } from '../entities/detection_config.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class SaveCameraDetectionConfig {
  constructor(private readonly repository: ProfileRepository) {}
  execute(cameraId: string, update: DetectionConfigUpdate): Promise<DetectionConfig> {
    return this.repository.saveCameraDetectionConfig(cameraId, update)
  }
}
