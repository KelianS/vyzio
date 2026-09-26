import type { CameraRepository } from '../ports/camera.port'

export class CapturePtzPresetThumbnail {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, presetId: number): Promise<void> {
    return this.repository.capturePtzPresetThumbnail(cameraId, presetId)
  }
}
