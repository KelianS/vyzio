import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class PtzCalibrate {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<void> {
    return this.repository.ptzCalibrate(cameraId)
  }
}
