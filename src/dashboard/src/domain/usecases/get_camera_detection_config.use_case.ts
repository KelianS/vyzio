import type { DetectionConfig } from '../entities/detection_config.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class GetCameraDetectionConfig {
  constructor(private readonly repository: ProfileRepository) {}
  execute(cameraId: string): Promise<DetectionConfig | null> {
    return this.repository.getCameraDetectionConfig(cameraId)
  }
}
