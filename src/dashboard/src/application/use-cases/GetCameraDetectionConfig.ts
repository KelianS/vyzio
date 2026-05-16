import type { DetectionConfig } from '../../domain/entities/DetectionConfig'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class GetCameraDetectionConfig {
  constructor(private readonly repository: ProfileRepository) {}
  execute(cameraId: string): Promise<DetectionConfig | null> {
    return this.repository.getCameraDetectionConfig(cameraId)
  }
}
