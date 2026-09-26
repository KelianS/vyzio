import { describe, expect, it, vi } from 'vitest'
import { GetHubOverview } from './get_hub_overview.use_case'
import type { HubRepository } from '../ports/hub.port'

describe('GetHubOverview', () => {
  it('execute_ShouldLoadTheOverviewFromTheRepository_WhenCalled', async () => {
    const overview = {
      systemHealthy: true,
      recentEvents: [],
      profiles: [],
      notifications: {
        activeChannels: 1,
        sentCount: 2,
        lastSentAt: null,
      },
      warnings: [],
    }

    const repository: HubRepository = {
      getOverview: vi.fn().mockResolvedValue(overview),
    }

    const useCase = new GetHubOverview(repository)

    await expect(useCase.execute()).resolves.toEqual(overview)
    expect(repository.getOverview).toHaveBeenCalledOnce()
  })
})
