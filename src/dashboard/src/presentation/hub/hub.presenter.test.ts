import { describe, expect, it, vi } from 'vitest'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import { HttpError } from '../../infrastructure/http/http_error'
import { buildHubPresenter } from './hub.presenter'

describe('buildHubPresenter', () => {
  it('onTogglePrivacy_ShouldReloadTheCamerasAndReportTheFailure_WhenTheBatchFails', async () => {
    // Arrange
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
      notificationsContainer: {} as NotificationsContainer,
      dispatch,
      toast,
    })

    // Act
    await presenter.onTogglePrivacy(['cam1', 'cam2'], false)

    // Assert
    expect(getCameras.execute).toHaveBeenCalled()
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'PRIVACY_FINISHED',
      cameraIds: ['cam1', 'cam2'],
    })
    expect(toast).toHaveBeenCalledWith(expect.any(String), 'error', expect.any(String))
  })

  it('onMount_ShouldCountTheDetectionsOfTheLastHour_WhenTheHomeOpens', () => {
    // Arrange
    const getDetectionHistory = {
      execute: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    }
    const presenter = buildHubPresenter({
      container: {
        getHubOverview: { execute: vi.fn().mockReturnValue(new Promise(() => undefined)) },
        getCamerasCut: { execute: vi.fn().mockReturnValue(new Promise(() => undefined)) },
        getDetectionHistory,
      } as unknown as HubContainer,
      camerasContainer: {
        getCameras: { execute: vi.fn().mockResolvedValue([]) },
      } as unknown as CamerasContainer,
      notificationsContainer: {
        getSilence: { execute: vi.fn().mockReturnValue(new Promise(() => undefined)) },
      } as unknown as NotificationsContainer,
      dispatch: vi.fn(),
      toast: vi.fn(),
      now: () => new Date('2026-11-16T20:00:00Z'),
    })

    // Act
    presenter.onMount()

    // Assert
    expect(getDetectionHistory.execute).toHaveBeenCalledWith({
      from: '2026-11-16T19:00:00.000Z',
      limit: 100,
    })
  })
})
