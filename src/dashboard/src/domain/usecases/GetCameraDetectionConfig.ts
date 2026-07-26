import type { DetectionConfig } from '../entities/DetectionConfig'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class GetCameraDetectionConfig {
  constructor(private readonly repository: ProfileRepository) {}
  execute(cameraId: string): Promise<DetectionConfig | null> {
    return this.repository.getCameraDetectionConfig(cameraId)
  }
}
