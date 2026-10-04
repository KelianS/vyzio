import type { CameraStreamLineup } from '../entities/camera_stream.entity'
import type { CameraStreamRepository } from '../ports/camera_stream.port'

export class GetCameraStreams {
  constructor(private readonly repository: CameraStreamRepository) {}

  async execute(cameraId: string): Promise<CameraStreamLineup> {
    return this.repository.getStreams(cameraId)
  }
}
