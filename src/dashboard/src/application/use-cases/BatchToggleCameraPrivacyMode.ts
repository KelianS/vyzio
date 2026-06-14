import type { Camera } from '../../domain/entities/Camera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class BatchToggleCameraPrivacyMode {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraIds: string[], active: boolean): Promise<Camera[]> {
    return this.repository.batchTogglePrivacyMode(cameraIds, active)
  }
}
