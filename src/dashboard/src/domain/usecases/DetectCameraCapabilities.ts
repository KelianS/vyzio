import type { CameraRepository } from '../ports/CameraRepository'

export class DetectCameraCapabilities {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<void> {
    return this.repository.detectCapabilities(cameraId)
  }
}
