import type { DiscoveredCamera } from '../entities/DiscoveredCamera'
import type { CameraRepository } from '../ports/CameraRepository'
import type { DiscoveryRequest } from '../ports/CameraRepository'

export class DiscoverCameras {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input?: DiscoveryRequest): Promise<DiscoveredCamera[]> {
    return this.repository.discover(input)
  }
}
