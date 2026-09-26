import type { CameraConfigurationApplyResult } from '../entities/camera_configuration_apply_result.entity'
import type { CameraRepository } from '../ports/camera.port'

// Takes up the saved configuration and restarts the surveillance (ADR-44). Named by its effect.
export class RestartSurveillance {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<CameraConfigurationApplyResult> {
    return this.repository.applyConfiguration()
  }
}
