import type { CameraRepository } from '../ports/camera.port'

/** A press of the joystick: one move until released (ADR-60). */
export class PtzStartMove {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, direction: string, speed = 50): Promise<void> {
    return this.repository.ptzStartMove(cameraId, direction, speed)
  }
}
