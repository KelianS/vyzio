import { describe, expect, it, vi } from 'vitest'
import { GetHubOverview } from './GetHubOverview'
import type { HubRepository } from '../ports/HubRepository'

describe('GetHubOverview', () => {
  it('delegates overview loading to the hub repository', async () => {
    const overview = {
      systemHealthy: true,
      recentEvents: [],
      profiles: [],
      notifications: {
        telegramConfigured: true,
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
