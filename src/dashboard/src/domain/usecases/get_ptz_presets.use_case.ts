import type { CameraRepository } from '../ports/camera.port'
import type { PtzPreset } from '../entities/ptz_preset.entity'

export class GetPtzPresets {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<{
    presets: PtzPreset[]
    calibrated: boolean
    currentPosition: { x: number; y: number } | null
  }> {
    return this.repository.getPtzPresets(cameraId)
  }
}
