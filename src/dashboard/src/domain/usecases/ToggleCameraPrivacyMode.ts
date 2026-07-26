import type { Camera } from '../entities/Camera'
import type { CameraRepository } from '../ports/CameraRepository'

export class ToggleCameraPrivacyMode {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, active: boolean): Promise<Camera> {
    return this.repository.togglePrivacyMode(cameraId, active)
  }
}
