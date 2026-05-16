import { describe, expect, it, vi } from 'vitest'
import { UpdateCamera } from './UpdateCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

describe('UpdateCamera', () => {
  it('updates a configured camera through the repository', async () => {
    const repository: CameraRepository = {
      getAll: vi.fn(),
      getStatus: vi.fn(),
      discover: vi.fn(),
      getVendorAssistance: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({
        id: 'camera-1',
        slug: 'front-door',
        displayName: 'Entry',
        sourceType: 'rtsp_manual',
        host: '192.168.1.10',
        port: 554,
        status: 'online',
        validationState: 'validated',
        isEnabled: true,
        previewAvailable: true,
        needsAttention: false,
        lastReachabilityCheckAt: null,
        lastSuccessfulFrameAt: null,
        frigateCameraName: 'front_door',
        vendorFamily: null,
      }),
      verifyDraft: vi.fn(),
      verify: vi.fn(),
      apply: vi.fn(),
      applyConfiguration: vi.fn(),
      delete: vi.fn(),
    }

    const useCase = new UpdateCamera(repository)
    const result = await useCase.execute('camera-1', {
      displayName: 'Entry',
      host: '192.168.1.10',
      port: 554,
      username: null,
      password: null,
      streamPath: '/Streaming/Channels/101',
      sourceType: 'rtsp_manual',
      vendorFamily: null,
    })

    expect(result.displayName).toBe('Entry')
    expect(repository.update).toHaveBeenCalledWith(
      'camera-1',
      expect.objectContaining({ displayName: 'Entry' }),
    )
  })
})
