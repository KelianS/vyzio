import type { CameraRepository } from '../ports/camera.port'

/** Tells the server the press still lasts, or it stops the camera by itself (ADR-60). */
export class PtzSignalMove {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<boolean> {
    return this.repository.ptzSignalMove(cameraId)
  }
}
