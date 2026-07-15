import type { CameraRepository } from '../../domain/ports/CameraRepository'
import type { CameraImageSettings } from '../../domain/entities/CameraImageSettings'

export class GetCameraImageSettings {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraImageSettings> {
    return this.repository.getImageSettings(cameraId)
  }
}
