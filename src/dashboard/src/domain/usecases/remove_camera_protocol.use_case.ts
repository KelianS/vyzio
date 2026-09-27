import type { SupportedProtocol } from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class RemoveCameraProtocol {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, protocol: SupportedProtocol): Promise<void> {
    return this.repository.removeProtocol(cameraId, protocol)
  }
}
