import type { CameraPrivacySchedule } from '../entities/CameraPrivacySchedule'
import type { CameraRepository } from '../ports/CameraRepository'

export class GetCameraPrivacySchedules {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraPrivacySchedule[]> {
    return this.repository.getPrivacySchedules(cameraId)
  }
}
