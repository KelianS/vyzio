import type { CameraStreamLineup } from '../entities/camera_stream.entity'
import type { CameraStreamRepository } from '../ports/camera_stream.port'

export class SetCameraStreamEnabled {
  constructor(private readonly repository: CameraStreamRepository) {}

  async execute(cameraId: string, streamId: string, enabled: boolean): Promise<CameraStreamLineup> {
    return this.repository.setStreamEnabled(cameraId, streamId, enabled)
  }
}
