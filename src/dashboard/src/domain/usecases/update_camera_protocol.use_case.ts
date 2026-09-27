import type { SupportedProtocol } from '../entities/camera_capability_binding.entity'
import type { CameraProtocol, CameraProtocolInput } from '../entities/camera_protocol.entity'
import type { CameraRepository } from '../ports/camera.port'

export class UpdateCameraProtocol {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
    protocol: SupportedProtocol,
    input: CameraProtocolInput,
  ): Promise<CameraProtocol> {
    return this.repository.updateProtocol(cameraId, protocol, input)
  }
}
