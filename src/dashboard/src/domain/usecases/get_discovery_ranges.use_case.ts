import type { DiscoveryRange } from '../entities/discovered_camera.entity'
import type { CameraRepository } from '../ports/camera.port'

export class GetDiscoveryRanges {
  constructor(private readonly repository: CameraRepository) {}

  async execute(): Promise<DiscoveryRange[]> {
    return this.repository.getDiscoveryRanges()
  }
}
