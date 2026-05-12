import { describe, expect, it, vi } from 'vitest'
import { DiscoverCameras } from './DiscoverCameras'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

describe('DiscoverCameras', () => {
  it('delegates discovery to the camera repository', async () => {
    const candidates = [
      {
        displayName: 'Driveway',
        host: '192.168.1.20',
        port: 554,
        sourceType: 'onvif',
        streamPath: null,
        discoverySource: 'onvif',
        note: 'ONVIF device announced.',
      },
    ]

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn().mockResolvedValue(candidates),
      create: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
    }

    const useCase = new DiscoverCameras(repository)

    await expect(useCase.execute()).resolves.toEqual(candidates)
    expect(repository.discover).toHaveBeenCalledOnce()
  })
})