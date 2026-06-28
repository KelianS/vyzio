import type { Camera } from '../../domain/entities/Camera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class ToggleCameraPrivacyMode {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, active: boolean): Promise<Camera> {
    return this.repository.togglePrivacyMode(cameraId, active)
  }
}
