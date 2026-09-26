import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import { useRootStore } from '../../infrastructure/store/root.store'

// The list is state shared across screens: each one reads it again through the store, never alone.
export function reloadCameraList(camerasContainer: CamerasContainer): void {
  void useRootStore.getState().loadCameras(camerasContainer.getCameras)
}
