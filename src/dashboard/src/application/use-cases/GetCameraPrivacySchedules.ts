import type { CameraPrivacySchedule } from '../../domain/entities/CameraPrivacySchedule'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class GetCameraPrivacySchedules {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraPrivacySchedule[]> {
    return this.repository.getPrivacySchedules(cameraId)
  }
}
