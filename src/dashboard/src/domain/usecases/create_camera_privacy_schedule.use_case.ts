import type { CameraPrivacySchedule } from '../entities/camera_privacy_schedule.entity'
import type { CameraRepository, CreatePrivacyScheduleInput } from '../ports/camera.port'

export class CreateCameraPrivacySchedule {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
    input: CreatePrivacyScheduleInput,
  ): Promise<CameraPrivacySchedule> {
    return this.repository.createPrivacySchedule(cameraId, input)
  }
}
