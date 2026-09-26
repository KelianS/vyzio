import { describe, expect, it, vi } from 'vitest'
import { GetCameras } from './get_cameras.use_case'
import type { CameraRepository } from '../ports/camera.port'

describe('GetCameras', () => {
  it('execute_ShouldLoadTheCamerasFromTheRepository_WhenCalled', async () => {
    const cameras = [
      {
        id: 'camera-1',
        slug: 'front-door',
        displayName: 'Front Door',
        sourceType: 'rtsp_manual',
        host: '192.168.1.10',
        port: 554,
        status: 'online',
        validationState: 'validated',
        isEnabled: true,
        previewAvailable: true,
        needsAttention: false,
        lastReachabilityCheckAt: null,
        lastSuccessfulFrameAt: null,
        frigateCameraName: 'front_door',
        vendorFamily: 'tplink_tapo',
      },
    ]

    const repository = {
      getAll: vi.fn().mockResolvedValue(cameras),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new GetCameras(repository as unknown as CameraRepository)

    await expect(useCase.execute()).resolves.toEqual(cameras)
    expect(repository.getAll).toHaveBeenCalledOnce()
  })
})
