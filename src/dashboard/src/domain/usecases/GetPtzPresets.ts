import type { CameraRepository } from '../ports/CameraRepository'
import type { PtzPreset } from '../entities/PtzPreset'

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
