import { describe, expect, it, vi } from 'vitest'
import { DiscoverCameras } from './discover_cameras.use_case'
import type { CameraRepository } from '../ports/camera.port'

describe('DiscoverCameras', () => {
  it('execute_ShouldDiscoverThroughTheRepository_WhenNoHostIsGiven', async () => {
    // Arrange
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
        qualification: 'camera_confirmed',
        vendorFamily: null,
        qualificationReasons: ['onvif_detected'],
      },
    ]

    const repository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn().mockResolvedValue({ ranges: [], candidates }),
      create: vi.fn(),
      update: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new DiscoverCameras(repository as unknown as CameraRepository)

    // Act
    const result = await useCase.execute()

    // Assert
    expect(result).toEqual({ ranges: [], candidates })
    expect(repository.discover).toHaveBeenCalledOnce()
  })

  it('execute_ShouldPassTheTargetToTheRepository_WhenAHostIsGiven', async () => {
    // Arrange
    const repository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn().mockResolvedValue({ ranges: [], candidates: [] }),
      create: vi.fn(),
      update: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new DiscoverCameras(repository as unknown as CameraRepository)

    // Act
    const result = await useCase.execute({ host: '192.168.1.20', port: 554 })

    // Assert
    expect(result).toEqual({ ranges: [], candidates: [] })
    expect(repository.discover).toHaveBeenCalledWith({ host: '192.168.1.20', port: 554 })
  })
})
