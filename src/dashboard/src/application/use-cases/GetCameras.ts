import type { Camera } from '../../domain/entities/Camera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class GetCameras {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<Camera[]> {
    return this.repository.getAll()
  }
}