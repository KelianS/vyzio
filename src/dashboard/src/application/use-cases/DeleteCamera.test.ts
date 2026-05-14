import { describe, expect, it, vi } from 'vitest'
import { DeleteCamera } from './DeleteCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

describe('DeleteCamera', () => {
  it('delegates deletion to the camera repository', async () => {
    const result = {
      deleted: true,
      message: 'Camera "Front Door" deleted.',
      configPath: 'config/frigate.generated.yml',
    }

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn().mockResolvedValue(result),
update: vi.fn(),
  getVendorAssistance: vi.fn(),
    }

    const useCase = new DeleteCamera(repository)

    await expect(useCase.execute('camera-1')).resolves.toEqual(result)
    expect(repository.delete).toHaveBeenCalledWith('camera-1')
  })
})