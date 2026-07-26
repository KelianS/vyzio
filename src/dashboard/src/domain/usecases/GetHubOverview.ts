import type { HubOverview } from '../entities/HubOverview'
import type { HubRepository } from '../ports/HubRepository'

export class GetHubOverview {
  constructor(private readonly repository: HubRepository) {}

  async execute(): Promise<HubOverview> {
    return this.repository.getOverview()
  }
}
