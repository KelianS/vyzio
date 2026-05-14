import type { HubOverview } from '../../domain/entities/HubOverview'
import type { HubRepository } from '../../domain/ports/HubRepository'

export class GetHubOverview {
  constructor(private readonly repository: HubRepository) {}

  async execute(): Promise<HubOverview> {
    return this.repository.getOverview()
  }
}
