import type { CameraPrivacySchedule } from '../entities/camera_privacy_schedule.entity'
import type { CameraRepository } from '../ports/camera.port'

export class GetCameraPrivacySchedules {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraPrivacySchedule[]> {
    return this.repository.getPrivacySchedules(cameraId)
  }
}
