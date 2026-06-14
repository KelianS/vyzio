import type { CameraPrivacySchedule } from '../../domain/entities/CameraPrivacySchedule'
import type { CameraRepository, CreatePrivacyScheduleInput } from '../../domain/ports/CameraRepository'

export class CreateCameraPrivacySchedule {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, input: CreatePrivacyScheduleInput): Promise<CameraPrivacySchedule> {
    return this.repository.createPrivacySchedule(cameraId, input)
  }
}
