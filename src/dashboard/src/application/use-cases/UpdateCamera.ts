import type { Camera } from '../../domain/entities/Camera'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class UpdateCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, input: CameraDraftInput): Promise<Camera> {
    return this.repository.update(cameraId, input)
  }
}