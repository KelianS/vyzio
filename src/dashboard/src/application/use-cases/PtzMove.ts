import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class PtzMove {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, direction: string, speed = 50): Promise<void> {
    return this.repository.ptzMove(cameraId, direction, speed)
  }
}
