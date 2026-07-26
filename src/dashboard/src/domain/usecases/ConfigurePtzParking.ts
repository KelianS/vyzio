import type { CameraRepository } from '../ports/CameraRepository'

export class ConfigurePtzParking {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<void> {
    return this.repository.ptzConfigureParking(cameraId)
  }
}
