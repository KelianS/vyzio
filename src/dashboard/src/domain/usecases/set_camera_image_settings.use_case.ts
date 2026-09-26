import type { CameraRepository } from '../ports/camera.port'
import type { CameraImageSettings } from '../entities/camera_image_settings.entity'

export class SetCameraImageSettings {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, settings: CameraImageSettings): Promise<CameraImageSettings> {
    return this.repository.setImageSettings(cameraId, settings)
  }
}
