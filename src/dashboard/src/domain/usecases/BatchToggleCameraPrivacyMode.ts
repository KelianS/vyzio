import type { Camera } from '../entities/Camera'
import type { CameraRepository } from '../ports/CameraRepository'

export class BatchToggleCameraPrivacyMode {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraIds: string[], active: boolean): Promise<Camera[]> {
    return this.repository.batchTogglePrivacyMode(cameraIds, active)
  }
}
