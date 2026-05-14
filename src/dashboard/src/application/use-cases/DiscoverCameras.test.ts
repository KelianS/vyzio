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
        rtspActive: false,
        discoverySource: 'onvif',
        note: 'ONVIF device announced.',
        macAddress: null,
        isSupported: false,
        qualification: 'camera_confirmed',
        supportLevel: 'unknown',
        vendorFamily: null,
        qualificationReasons: ['onvif_detected'],
      },
    ]

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn().mockResolvedValue(candidates),
      create: vi.fn(),
      update: vi.fn(),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new DiscoverCameras(repository)

    await expect(useCase.execute()).resolves.toEqual(candidates)
    expect(repository.discover).toHaveBeenCalledOnce()
  })

  it('passes a targeted refresh request to the camera repository', async () => {
    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new DiscoverCameras(repository)

    await expect(useCase.execute({ host: '192.168.1.20', port: 554 })).resolves.toEqual([])
    expect(repository.discover).toHaveBeenCalledWith({ host: '192.168.1.20', port: 554 })
  })
})