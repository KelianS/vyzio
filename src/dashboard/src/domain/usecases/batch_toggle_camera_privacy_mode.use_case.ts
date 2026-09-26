import type { Camera } from '../entities/camera.entity'
import type { CameraRepository } from '../ports/camera.port'

export class BatchToggleCameraPrivacyMode {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraIds: string[], active: boolean): Promise<Camera[]> {
    return this.repository.batchTogglePrivacyMode(cameraIds, active)
  }
}
