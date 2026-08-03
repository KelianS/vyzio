import { describe, expect, it, vi } from 'vitest'
import { RestartSurveillance } from './RestartSurveillance'
import type { CameraRepository } from '../ports/CameraRepository'

describe('RestartSurveillance', () => {
  it('delegates the installation-wide restart to the camera repository', async () => {
    const result = {
      applied: true,
      message: 'Configuration appliquee pour 2 cameras.',
      configPath: 'config/frigate.generated.yml',
      cameraCount: 2,
    }

    const repository = {
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

    const useCase = new RestartSurveillance(repository as unknown as CameraRepository)

    await expect(useCase.execute()).resolves.toEqual(result)
    expect(repository.applyConfiguration).toHaveBeenCalledWith()
  })
})
