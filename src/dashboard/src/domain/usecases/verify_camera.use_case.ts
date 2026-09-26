import type { CameraStatus } from '../entities/camera_status.entity'
import type { CameraRepository } from '../ports/camera.port'

export class VerifyCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraStatus> {
    return this.repository.verify(cameraId)
  }
}
