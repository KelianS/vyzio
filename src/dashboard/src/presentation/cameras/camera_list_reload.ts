import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import { useRootStore } from '../../infrastructure/store/root.store'

// The list is state shared across screens: each one reads it again through the store, never alone.
export function reloadCameraList(camerasContainer: CamerasContainer): void {
  void useRootStore.getState().loadCameras(camerasContainer.getCameras)
}

/** The camera was removed elsewhere: the tab says so, and the shared list learns it so its page does too (DESIGN SYSTEM § Errors). */
export function reportCameraGone(
  camerasContainer: CamerasContainer,
  dispatch: (action: { type: 'CAMERA_GONE' }) => void,
): void {
  dispatch({ type: 'CAMERA_GONE' })
  reloadCameraList(camerasContainer)
}
