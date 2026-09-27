import type { CameraProtocol, CameraProtocolAddition } from '../entities/camera_protocol.entity'
import type { CameraRepository } from '../ports/camera.port'

export class AddCameraProtocol {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, addition: CameraProtocolAddition): Promise<CameraProtocol> {
    return this.repository.addProtocol(cameraId, addition)
  }
}
