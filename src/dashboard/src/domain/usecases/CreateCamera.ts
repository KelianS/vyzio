import type { Camera } from '../entities/Camera'
import type { CameraDraftInput } from '../entities/CameraDraftInput'
import type { CameraRepository } from '../ports/CameraRepository'

export class CreateCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: CameraDraftInput): Promise<Camera> {
    return this.repository.create(input)
  }
}
