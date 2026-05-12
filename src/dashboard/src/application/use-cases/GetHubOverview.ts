import type { HubOverview } from '../../domain/entities/HubOverview'
import type { HubRepository } from '../../domain/ports/HubRepository'

export class GetHubOverview {
  constructor(private readonly repository: HubRepository) {}

  async execute(): Promise<HubOverview> {
    const [healthResult, eventsResult, profilesResult] = await Promise.allSettled([
      this.repository.getHealth(),
      this.repository.getRecentDetectionEvents(5),
      this.repository.getProfiles(),
    ])

    const warnings: string[] = []

    const systemHealthy = healthResult.status === 'fulfilled'
      ? healthResult.value
      : false

    const recentEvents = eventsResult.status === 'fulfilled'
      ? eventsResult.value
      : []

    const profiles = profilesResult.status === 'fulfilled'
      ? profilesResult.value
      : []

    if (eventsResult.status === 'rejected') {
      warnings.push('Evenements indisponibles pour le moment.')
    }

    if (profilesResult.status === 'rejected') {
      warnings.push('Profils indisponibles pour le moment.')
    }

    if (healthResult.status === 'rejected') {
      warnings.push('Etat API indisponible.')
    }

    return {
      systemHealthy,
      recentEvents,
      profiles,
      warnings,
    }
  }
}