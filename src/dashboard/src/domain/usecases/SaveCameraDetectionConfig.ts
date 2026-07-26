import type { DetectionConfig } from '../entities/DetectionConfig'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class SaveCameraDetectionConfig {
  constructor(private readonly repository: ProfileRepository) {}
  execute(
    cameraId: string,
    labels: string[],
    continuousRecordingEnabled: boolean,
  ): Promise<DetectionConfig> {
    return this.repository.saveCameraDetectionConfig(cameraId, labels, continuousRecordingEnabled)
  }
}
