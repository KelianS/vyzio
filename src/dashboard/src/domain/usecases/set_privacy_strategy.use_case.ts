import type { Camera } from '../entities/camera.entity'
import type { CameraRepository } from '../ports/camera.port'

export class SetPrivacyStrategy {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, strategy: string): Promise<Camera> {
    return this.repository.setPrivacyStrategy(cameraId, strategy)
  }
}
