import type { HubOverview } from '../entities/hub_overview.entity'
import type { HubRepository } from '../ports/hub.port'

export class GetHubOverview {
  constructor(private readonly repository: HubRepository) {}

  async execute(): Promise<HubOverview> {
    return this.repository.getOverview()
  }
}
