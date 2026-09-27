import type { CameraProtocol } from '../entities/camera_protocol.entity'
import type { CameraRepository } from '../ports/camera.port'

export class GetCameraProtocols {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraProtocol[]> {
    return this.repository.getProtocols(cameraId)
  }
}
