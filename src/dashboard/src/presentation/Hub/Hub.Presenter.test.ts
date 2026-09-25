import { describe, expect, it, vi } from 'vitest'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { HttpError } from '../../infrastructure/http/HttpError'
import { buildHubPresenter } from './Hub.Presenter'

describe('buildHubPresenter', () => {
  it('onTogglePrivacy_ShouldReloadTheCamerasAndReportTheFailure_WhenTheBatchFails', async () => {
    const getCameras = { execute: vi.fn().mockResolvedValue([]) }
    const camerasContainer = {
      getCameras,
      batchToggleCameraPrivacyMode: {
        execute: vi
          .fn()
          .mockRejectedValue(
            new HttpError(
              502,
              '/api/cameras/privacy/batch',
              'camera_unreachable: DVRIP: no answer',
              'camera_unreachable',
            ),
          ),
      },
    } as unknown as CamerasContainer
    const dispatch = vi.fn()
    const toast = vi.fn()
    const presenter = buildHubPresenter({
      container: {} as HubContainer,
      camerasContainer,
      dispatch,
      toast,
    })

    await presenter.onTogglePrivacy({
      cameraIds: ['cam1', 'cam2'],
      active: false,
      cameraLabel: null,
    })

    expect(getCameras.execute).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith({ type: 'PRIVACY_TOGGLE_FAILED' })
    expect(toast).toHaveBeenCalledWith(expect.any(String), 'error', expect.any(String))
  })
})
