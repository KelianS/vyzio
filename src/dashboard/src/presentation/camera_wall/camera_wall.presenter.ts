import type { Toast } from '../../common/components/toast'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import { reloadCameraList } from '../cameras/camera_list_reload'
import { setCamerasPrivacy } from '../hub/privacy_toggle'
import type { CameraWallAction } from './camera_wall.actions'

export interface CameraWallPresenterContext {
  camerasContainer: CamerasContainer
  dispatch: (action: CameraWallAction) => void
  toast: Toast
}

export function buildCameraWallPresenter({
  camerasContainer,
  dispatch,
  toast,
}: CameraWallPresenterContext) {
  return {
    onReloadCameras() {
      reloadCameraList(camerasContainer)
    },

    /** The same immediate act as the home's eye (PRIV-21). */
    async onTogglePrivacy(cameraId: string, active: boolean): Promise<void> {
      dispatch({ type: 'PRIVACY_STARTED', cameraIds: [cameraId] })
      await setCamerasPrivacy(camerasContainer, toast, [cameraId], active)
      dispatch({ type: 'PRIVACY_FINISHED', cameraIds: [cameraId] })
    },
  }
}
