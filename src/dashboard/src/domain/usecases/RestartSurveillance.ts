import type { CameraConfigurationApplyResult } from '../entities/CameraConfigurationApplyResult'
import type { CameraRepository } from '../ports/CameraRepository'

// Takes up the saved configuration and restarts the surveillance (ADR-44). Named by its effect.
export class RestartSurveillance {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<CameraConfigurationApplyResult> {
    return this.repository.applyConfiguration()
  }
}
