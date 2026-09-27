import type { SupportedProtocol } from '../entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../entities/camera_protocol.entity'
import type { CameraRepository } from '../ports/camera.port'

export class CheckCameraProtocol {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, protocol: SupportedProtocol): Promise<CameraProtocol> {
    return this.repository.checkProtocol(cameraId, protocol)
  }
}
