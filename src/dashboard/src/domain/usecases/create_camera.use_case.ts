import type { Camera } from '../entities/camera.entity'
import type { CameraDraftInput } from '../entities/camera_draft_input.entity'
import type { CameraRepository } from '../ports/camera.port'

export class CreateCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: CameraDraftInput): Promise<Camera> {
    return this.repository.create(input)
  }
}
