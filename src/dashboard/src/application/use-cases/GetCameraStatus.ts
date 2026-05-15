import type { CameraStatus } from '../../domain/entities/CameraStatus'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class GetCameraStatus {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraStatus> {
    return this.repository.getStatus(cameraId)
  }
}
