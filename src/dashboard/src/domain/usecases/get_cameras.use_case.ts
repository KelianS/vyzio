import type { Camera } from '../entities/camera.entity'
import type { CameraRepository } from '../ports/camera.port'

export class GetCameras {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<Camera[]> {
    return this.repository.getAll()
  }
}
