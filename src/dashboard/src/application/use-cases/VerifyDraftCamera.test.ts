import { describe, expect, it, vi } from 'vitest'
import { VerifyDraftCamera } from './VerifyDraftCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

describe('VerifyDraftCamera', () => {
  it('delegates draft verification to the camera repository', async () => {
    const status = {
      cameraId: 'draft-camera',
      displayName: 'Front Door',
      status: 'online',
      validationState: 'draft',
      connected: true,
      previewAvailable: true,
      needsAttention: false,
      guidance: 'Le flux RTSP repond correctement.',
      lastReachabilityCheckAt: null,
      lastSuccessfulFrameAt: null,
    }

    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      create: vi.fn(),
      verifyDraft: vi.fn().mockResolvedValue(status),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      getVendorAssistance: vi.fn(),
    }

    const useCase = new VerifyDraftCamera(repository)
    const input = {
      displayName: 'Front Door',
      host: '192.168.1.10',
      port: 554,
      username: 'admin',
      password: 'secret',
      streamPath: '/Streaming/Channels/101',
      sourceType: 'rtsp_manual',
      detectionPreset: 'person_default',
    }

    await expect(useCase.execute(input)).resolves.toEqual(status)
    expect(repository.verifyDraft).toHaveBeenCalledWith(input)
  })
})
