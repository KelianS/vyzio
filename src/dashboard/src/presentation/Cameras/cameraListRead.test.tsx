import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { HttpError } from '../../infrastructure/http/HttpError'
import type { Camera } from '../../domain/entities/Camera'
import type { GetCameras } from '../../domain/usecases/GetCameras'
import { useCameraListFailureToast } from './cameraListRead'

const toast = vi.fn()
vi.mock('../../common/components/Toast', () => ({ useToast: () => ({ toast }) }))

const failing = {
  execute: vi.fn().mockRejectedValue(new HttpError(500, '/api/cameras', 'HTTP 500 /api/cameras')),
} as unknown as GetCameras

describe('useCameraListFailureToast', () => {
  afterEach(() => {
    toast.mockReset()
    useRootStore.setState({ cameras: [], camerasError: null, camerasLoading: true })
  })

  it('useCameraListFailureToast_ShouldToastTheFailure_WhenAReloadFailsUnderAShownList', async () => {
    useRootStore.setState({ cameras: [{ id: 'camera-1' } as Camera] })
    renderHook(() => useCameraListFailureToast())

    await act(() => useRootStore.getState().loadCameras(failing))

    expect(toast).toHaveBeenCalledWith(expect.any(String), 'error', expect.stringContaining('500'))
  })

  it('useCameraListFailureToast_ShouldStayQuiet_WhenNoListIsShown', async () => {
    renderHook(() => useCameraListFailureToast())

    await act(() => useRootStore.getState().loadCameras(failing))

    expect(toast).not.toHaveBeenCalled()
  })
})
