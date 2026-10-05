import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { ToastTone } from '../../common/components/toast'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { reloadCameraList } from '../cameras/camera_list_reload'
import type { HubAction } from './hub.actions'
import { privacyWording, type PrivacyRequest } from './privacy_request'

export interface HubPresenterContext {
  container: HubContainer
  camerasContainer: CamerasContainer
  dispatch: (action: HubAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildHubPresenter({
  container,
  camerasContainer,
  dispatch,
  toast,
}: HubPresenterContext) {
  const reloadCameras = () => reloadCameraList(camerasContainer)

  return {
    onMount() {
      reloadCameras()
      dispatch({ type: 'LOAD_STARTED' })
      container.getHubOverview
        .execute()
        .then((data) => dispatch({ type: 'LOAD_SUCCEEDED', data }))
        .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
      camerasContainer.getCameraLabels
        .execute()
        .then((labels) => dispatch({ type: 'LABELS_LOADED', labels }))
        .catch((e: unknown) => toastError(toast, toAppError(e)))
    },

    onReloadCameras: reloadCameras,

    onPrivacyPendingSet(request: PrivacyRequest | null) {
      dispatch({ type: 'PRIVACY_PENDING_SET', request })
    },

    // One camera or all of them: same path, so same confirmation, same wait, same announcement.
    async onTogglePrivacy(request: PrivacyRequest): Promise<void> {
      dispatch({ type: 'PRIVACY_TOGGLE_STARTED' })
      try {
        await camerasContainer.batchToggleCameraPrivacyMode.execute(
          request.cameraIds,
          request.active,
        )
        reloadCameras()
        dispatch({ type: 'PRIVACY_TOGGLE_SUCCEEDED' })
        toast(privacyWording(request).done, 'success')
      } catch (e) {
        // A batch that stopped part way has still switched the cameras before the failing one.
        reloadCameras()
        dispatch({ type: 'PRIVACY_TOGGLE_FAILED' })
        toastError(toast, toAppError(e))
      }
    },
  }
}
