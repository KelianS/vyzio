import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import { reloadCameraList } from './camera_list_reload'

export interface CamerasPresenterContext {
  container: CamerasContainer
}

// The list is shared state in the store; this screen only asks to read it again.
export function buildCamerasPresenter({ container }: CamerasPresenterContext) {
  return {
    onRetry() {
      reloadCameraList(container)
    },
  }
}
