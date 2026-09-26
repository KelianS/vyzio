import type { CameraRepository } from '../ports/camera.port'

export class PtzCalibrate {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<void> {
    return this.repository.ptzCalibrate(cameraId)
  }
}
