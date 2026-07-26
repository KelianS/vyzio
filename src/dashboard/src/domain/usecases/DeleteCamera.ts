import type { CameraRepository } from '../ports/CameraRepository'

export class DeleteCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
  ): Promise<{ deleted: boolean; message: string; configPath: string }> {
    return this.repository.delete(cameraId)
  }
}
