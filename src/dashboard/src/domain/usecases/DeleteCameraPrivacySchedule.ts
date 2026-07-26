import type { CameraRepository } from '../ports/CameraRepository'

export class DeleteCameraPrivacySchedule {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, scheduleId: string): Promise<void> {
    return this.repository.deletePrivacySchedule(cameraId, scheduleId)
  }
}
