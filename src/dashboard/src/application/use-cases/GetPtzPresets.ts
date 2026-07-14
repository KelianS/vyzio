import type { CameraRepository } from '../../domain/ports/CameraRepository'
import type { PtzPreset } from '../../domain/entities/PtzPreset'

export class GetPtzPresets {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
  ): Promise<{ presets: PtzPreset[]; calibrated: boolean; currentPosition: { x: number; y: number } | null }> {
    return this.repository.getPtzPresets(cameraId)
  }
}
