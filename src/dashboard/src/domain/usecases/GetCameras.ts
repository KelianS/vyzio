import type { Camera } from '../entities/Camera'
import type { CameraRepository } from '../ports/CameraRepository'

export class GetCameras {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<Camera[]> {
    return this.repository.getAll()
  }
}
