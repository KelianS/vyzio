import type { CameraRepository } from '../ports/camera.port'
import type { CameraImageSettings } from '../entities/camera_image_settings.entity'

export class GetCameraImageSettings {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraImageSettings> {
    return this.repository.getImageSettings(cameraId)
  }
}
