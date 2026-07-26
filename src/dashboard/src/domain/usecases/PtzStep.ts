import type { CameraRepository } from '../ports/CameraRepository'

export class PtzStep {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, direction: string, speed = 50): Promise<void> {
    return this.repository.ptzStep(cameraId, direction, speed)
  }
}
