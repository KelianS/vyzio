import type { CameraPrivacySchedule } from '../entities/CameraPrivacySchedule'
import type { CameraRepository, CreatePrivacyScheduleInput } from '../ports/CameraRepository'

export class CreateCameraPrivacySchedule {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
    input: CreatePrivacyScheduleInput,
  ): Promise<CameraPrivacySchedule> {
    return this.repository.createPrivacySchedule(cameraId, input)
  }
}
