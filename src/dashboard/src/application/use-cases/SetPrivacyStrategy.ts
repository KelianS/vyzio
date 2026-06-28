import type { Camera } from '../../domain/entities/Camera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class SetPrivacyStrategy {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, strategy: string): Promise<Camera> {
    return this.repository.setPrivacyStrategy(cameraId, strategy)
  }
}
