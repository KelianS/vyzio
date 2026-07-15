import type { CameraRepository } from '../../domain/ports/CameraRepository'
import type { CameraImageSettings } from '../../domain/entities/CameraImageSettings'

export class SetCameraImageSettings {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, settings: CameraImageSettings): Promise<CameraImageSettings> {
    return this.repository.setImageSettings(cameraId, settings)
  }
}
