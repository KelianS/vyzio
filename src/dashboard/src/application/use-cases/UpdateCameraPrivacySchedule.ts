import type { CameraPrivacySchedule } from '../../domain/entities/CameraPrivacySchedule'
import type { CameraRepository, UpdatePrivacyScheduleInput } from '../../domain/ports/CameraRepository'

export class UpdateCameraPrivacySchedule {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
    scheduleId: string,
    input: UpdatePrivacyScheduleInput,
  ): Promise<CameraPrivacySchedule> {
    return this.repository.updatePrivacySchedule(cameraId, scheduleId, input)
  }
}
