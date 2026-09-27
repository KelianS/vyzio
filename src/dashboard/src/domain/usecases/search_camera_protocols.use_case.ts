import type { CameraProtocol } from '../entities/camera_protocol.entity'
import type { CameraRepository } from '../ports/camera.port'

/** The protocol level alone: the usual protocols that answer are added, no capability is touched (ADR-61). */
export class SearchCameraProtocols {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraProtocol[]> {
    return this.repository.searchProtocols(cameraId)
  }
}
