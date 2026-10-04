import type { Camera } from '../entities/camera.entity'
import type { NewCameraInput } from '../entities/camera_input.entity'
import type { CameraRepository } from '../ports/camera.port'

export class CreateCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: NewCameraInput): Promise<Camera> {
    return this.repository.create(input)
  }
}
