import type { HubOverview } from '../../domain/entities/HubOverview'
import type { HubRepository } from '../../domain/ports/HubRepository'

export class GetHubOverview {
  constructor(private readonly repository: HubRepository) {}

  async execute(): Promise<HubOverview> {
    const [systemHealthy, recentEvents, profiles] = await Promise.all([
      this.repository.getHealth(),
      this.repository.getRecentDetectionEvents(5),
      this.repository.getProfiles(),
    ])

    return {
      systemHealthy,
      recentEvents,
      profiles,
    }
  }
}