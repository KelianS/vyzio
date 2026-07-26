import type { Camera } from '../entities/Camera'
import type { CameraDraftInput } from '../entities/CameraDraftInput'
import type { CameraRepository } from '../ports/CameraRepository'

export class UpdateCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, input: CameraDraftInput): Promise<Camera> {
    return this.repository.update(cameraId, input)
  }
}
