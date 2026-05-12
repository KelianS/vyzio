import { describe, expect, it, vi } from 'vitest'
import { ApplyCamera } from './ApplyCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

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

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn().mockResolvedValue(result),
    }

    const useCase = new ApplyCamera(repository)

    await expect(useCase.execute('camera-1')).resolves.toEqual(result)
    expect(repository.apply).toHaveBeenCalledWith('camera-1')
  })
})