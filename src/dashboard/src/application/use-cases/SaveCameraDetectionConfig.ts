import type { DetectionConfig } from '../../domain/entities/DetectionConfig'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class SaveCameraDetectionConfig {
  constructor(private readonly repository: ProfileRepository) {}
  execute(cameraId: string, labels: string[]): Promise<DetectionConfig> {
    return this.repository.saveCameraDetectionConfig(cameraId, labels)
  }
}
