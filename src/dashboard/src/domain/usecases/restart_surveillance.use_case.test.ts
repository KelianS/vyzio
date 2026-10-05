import { describe, expect, it, vi } from 'vitest'
import { RestartSurveillance } from './restart_surveillance.use_case'
import type { CameraRepository } from '../ports/camera.port'

describe('RestartSurveillance', () => {
  it('execute_ShouldApplyTheConfigurationThroughTheRepository_WhenCalled', async () => {
    // Arrange
    const configuration = {
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
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn().mockResolvedValue(configuration),
      delete: vi.fn(),
      update: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new RestartSurveillance(repository as unknown as CameraRepository)

    // Act
    const result = await useCase.execute()

    // Assert
    expect(result).toEqual(configuration)
    expect(repository.applyConfiguration).toHaveBeenCalledWith()
  })
})
