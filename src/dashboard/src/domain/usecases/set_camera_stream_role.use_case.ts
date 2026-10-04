import type { CameraStreamLineup, StreamRole } from '../entities/camera_stream.entity'
import type { CameraStreamRepository } from '../ports/camera_stream.port'

export class SetCameraStreamRole {
  constructor(private readonly repository: CameraStreamRepository) {}

  async execute(cameraId: string, streamId: string, role: StreamRole): Promise<CameraStreamLineup> {
    return this.repository.setStreamRole(cameraId, streamId, role)
  }
}
