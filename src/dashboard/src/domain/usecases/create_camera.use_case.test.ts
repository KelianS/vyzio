import { describe, expect, it, vi } from 'vitest'
import { CreateCamera } from './create_camera.use_case'
import type { CameraRepository } from '../ports/camera.port'

describe('CreateCamera', () => {
  it('execute_ShouldCreateTheCameraThroughTheRepository_WhenCalled', async () => {
    // Arrange
    const created = {
      id: 'camera-1',
      slug: 'front-door',
      displayName: 'Front Door',
      sourceType: 'rtsp_manual',
      host: '192.168.1.10',
      port: 554,
      status: 'needs_attention',
      validationState: 'draft',
      isEnabled: false,
      previewAvailable: false,
      needsAttention: true,
      lastReachabilityCheckAt: null,
      lastSuccessfulFrameAt: null,
      frigateCameraName: 'front_door',
      vendorFamily: null,
    }

    const repository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn().mockResolvedValue(created),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new CreateCamera(repository as unknown as CameraRepository)
    const input = {
      displayName: 'Front Door',
      host: '192.168.1.10',
      username: null,
      password: null,
      sourceType: 'rtsp_manual',
      stream: { protocol: 'rtsp' as const, port: 554, path: '/Streaming/Channels/101' },
    }

    // Act
    const result = await useCase.execute(input)

    // Assert
    expect(result).toEqual(created)
    expect(repository.create).toHaveBeenCalledWith(input)
  })
})
