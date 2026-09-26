import type { Camera } from '../entities/camera.entity'
import type { CameraRepository } from '../ports/camera.port'

export class ToggleCameraPrivacyMode {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, active: boolean): Promise<Camera> {
    return this.repository.togglePrivacyMode(cameraId, active)
  }
}
