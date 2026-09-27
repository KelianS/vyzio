import type { CameraStreamLineup } from '../entities/camera_stream.entity'
import type { CameraStreamRepository } from '../ports/camera_stream.port'

export class RemoveCameraStream {
  constructor(private readonly repository: CameraStreamRepository) {}

  async execute(cameraId: string, streamId: string): Promise<CameraStreamLineup> {
    return this.repository.removeStream(cameraId, streamId)
  }
}
