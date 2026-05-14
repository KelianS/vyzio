import { describe, expect, it, vi } from 'vitest'
import { CreateCamera } from './CreateCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

describe('CreateCamera', () => {
  it('delegates creation to the camera repository', async () => {
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

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn().mockResolvedValue(created),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new CreateCamera(repository)
    const input = {
      displayName: 'Front Door',
      host: '192.168.1.10',
      port: 554,
      username: null,
      password: null,
      streamPath: '/Streaming/Channels/101',
      sourceType: 'rtsp_manual',
      detectionPreset: 'person_default',
    }

    await expect(useCase.execute(input)).resolves.toEqual(created)
    expect(repository.create).toHaveBeenCalledWith(input)
  })
})