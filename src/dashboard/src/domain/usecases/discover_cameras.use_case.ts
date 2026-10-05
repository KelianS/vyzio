import type { DiscoveredCamera } from '../entities/discovered_camera.entity'
import type { CameraRepository } from '../ports/camera.port'
import type { DiscoveryRequest } from '../ports/camera.port'

export class DiscoverCameras {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input?: DiscoveryRequest): Promise<DiscoveredCamera[]> {
    return this.repository.discover(input)
  }
}
