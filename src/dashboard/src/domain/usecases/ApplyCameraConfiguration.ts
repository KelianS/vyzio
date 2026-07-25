import type { CameraConfigurationApplyResult } from '../entities/CameraConfigurationApplyResult'
import type { CameraRepository } from '../ports/CameraRepository'

export class ApplyCameraConfiguration {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<CameraConfigurationApplyResult> {
    return this.repository.applyConfiguration()
  }
}
