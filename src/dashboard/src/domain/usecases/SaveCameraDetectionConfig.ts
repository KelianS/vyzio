import type { DetectionConfig, DetectionConfigUpdate } from '../entities/DetectionConfig'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class SaveCameraDetectionConfig {
  constructor(private readonly repository: ProfileRepository) {}
  execute(cameraId: string, update: DetectionConfigUpdate): Promise<DetectionConfig> {
    return this.repository.saveCameraDetectionConfig(cameraId, update)
  }
}
