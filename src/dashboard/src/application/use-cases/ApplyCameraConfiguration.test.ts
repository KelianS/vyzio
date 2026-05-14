import { describe, expect, it, vi } from 'vitest'
import { ApplyCameraConfiguration } from './ApplyCameraConfiguration'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

describe('ApplyCameraConfiguration', () => {
  it('delegates global configuration apply to the camera repository', async () => {
    const result = {
      applied: true,
      message: 'Configuration appliquee pour 2 cameras.',
      configPath: 'config/frigate.generated.yml',
      cameraCount: 2,
    }

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn().mockResolvedValue(result),
      delete: vi.fn(),
update: vi.fn(),
  getVendorAssistance: vi.fn(),
    }

    const useCase = new ApplyCameraConfiguration(repository)

    await expect(useCase.execute()).resolves.toEqual(result)
    expect(repository.applyConfiguration).toHaveBeenCalledWith()
  })
})