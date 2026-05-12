import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class DiscoverCameras {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<DiscoveredCamera[]> {
    return this.repository.discover()
  }
}