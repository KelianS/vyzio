import type { CameraConfigurationApplyResult } from '../../domain/entities/CameraConfigurationApplyResult'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class ApplyCameraConfiguration {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<CameraConfigurationApplyResult> {
    return this.repository.applyConfiguration()
  }
}