import { describe, expect, it, vi } from 'vitest'
import { DeleteCamera } from './delete_camera.use_case'
import type { CameraRepository } from '../ports/camera.port'

describe('DeleteCamera', () => {
  it('execute_ShouldDeleteTheCameraThroughTheRepository_WhenCalled', async () => {
    // Arrange
    const deletion = {
      deleted: true,
      message: 'Camera "Front Door" deleted.',
      configPath: 'config/frigate.generated.yml',
    }

    const repository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn().mockResolvedValue(deletion),
      update: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new DeleteCamera(repository as unknown as CameraRepository)

    // Act
    const result = await useCase.execute('camera-1')

    // Assert
    expect(result).toEqual(deletion)
    expect(repository.delete).toHaveBeenCalledWith('camera-1')
  })
})
