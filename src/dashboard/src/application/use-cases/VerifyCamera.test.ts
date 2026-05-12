import { describe, expect, it, vi } from 'vitest'
import { VerifyCamera } from './VerifyCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

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

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verify: vi.fn().mockResolvedValue(status),
      apply: vi.fn(),
    }

    const useCase = new VerifyCamera(repository)

    await expect(useCase.execute('camera-1')).resolves.toEqual(status)
    expect(repository.verify).toHaveBeenCalledWith('camera-1')
  })
})