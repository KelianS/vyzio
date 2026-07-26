import { describe, expect, it, vi } from 'vitest'
import { VerifyCamera } from './VerifyCamera'
import type { CameraRepository } from '../ports/CameraRepository'

describe('VerifyCamera', () => {
  it('delegates verification to the camera repository', async () => {
    const status = {
      cameraId: 'camera-1',
      displayName: 'Front Door',
      status: 'online',
      validationState: 'draft',
      connected: true,
      previewAvailable: true,
      needsAttention: true,
      guidance: 'Camera responded to the stream verification.',
      lastReachabilityCheckAt: null,
      lastSuccessfulFrameAt: null,
    }

    const repository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verifyDraft: vi.fn(),
      verify: vi.fn().mockResolvedValue(status),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new VerifyCamera(repository as unknown as CameraRepository)

    await expect(useCase.execute('camera-1')).resolves.toEqual(status)
    expect(repository.verify).toHaveBeenCalledWith('camera-1')
  })
})
