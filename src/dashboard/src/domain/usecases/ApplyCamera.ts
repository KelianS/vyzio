import type { CameraApplyResult } from '../entities/CameraApplyResult'
import type { CameraRepository } from '../ports/CameraRepository'

export class ApplyCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraApplyResult> {
    return this.repository.apply(cameraId)
  }
}
