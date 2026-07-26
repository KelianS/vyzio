import { describe, expect, it, vi } from 'vitest'
import { ApplyCamera } from './ApplyCamera'
import type { CameraRepository } from '../ports/CameraRepository'

describe('ApplyCamera', () => {
  it('delegates apply to the camera repository', async () => {
    const result = {
      applied: true,
      message: 'Frigate configuration applied successfully.',
      configPath: 'config/frigate.generated.yml',
      camera: {
        cameraId: 'camera-1',
        displayName: 'Front Door',
        status: 'online',
        validationState: 'validated',
        connected: true,
        previewAvailable: true,
        needsAttention: false,
        guidance: 'Camera configuration has been applied to Frigate.',
        lastReachabilityCheckAt: null,
        lastSuccessfulFrameAt: null,
      },
    }

    const repository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn().mockResolvedValue(result),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new ApplyCamera(repository as unknown as CameraRepository)

    await expect(useCase.execute('camera-1')).resolves.toEqual(result)
    expect(repository.apply).toHaveBeenCalledWith('camera-1')
  })
})
