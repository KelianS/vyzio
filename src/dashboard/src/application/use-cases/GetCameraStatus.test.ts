import { describe, expect, it, vi } from 'vitest'
import { GetCameraStatus } from './GetCameraStatus'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

describe('GetCameraStatus', () => {
  it('delegates camera status loading to the camera repository', async () => {
    const status = {
      cameraId: 'camera-1',
      displayName: 'Front Door',
      status: 'online',
      validationState: 'validated',
      connected: true,
      previewAvailable: true,
      needsAttention: false,
      guidance: 'Camera is connected and ready.',
      lastReachabilityCheckAt: null,
      lastSuccessfulFrameAt: null,
    }

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn().mockResolvedValue(status),
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

    const useCase = new GetCameraStatus(repository)

    await expect(useCase.execute('camera-1')).resolves.toEqual(status)
    expect(repository.getStatus).toHaveBeenCalledWith('camera-1')
  })
})
