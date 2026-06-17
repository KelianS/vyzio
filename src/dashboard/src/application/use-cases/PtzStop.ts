import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class PtzStop {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<void> {
    return this.repository.ptzStop(cameraId)
  }
}
