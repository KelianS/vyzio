import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'
import type { DiscoveryRequest } from '../../domain/ports/CameraRepository'

export class DiscoverCameras {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input?: DiscoveryRequest): Promise<DiscoveredCamera[]> {
    return this.repository.discover(input)
  }
}
