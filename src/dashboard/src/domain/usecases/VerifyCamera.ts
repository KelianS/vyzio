import type { CameraStatus } from '../entities/CameraStatus'
import type { CameraRepository } from '../ports/CameraRepository'

export class VerifyCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraStatus> {
    return this.repository.verify(cameraId)
  }
}
