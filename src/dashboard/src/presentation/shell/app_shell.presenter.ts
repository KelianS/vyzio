import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { useRootStore } from '../../infrastructure/store/root.store'
import { reloadCameraList } from '../cameras/camera_list_reload'

const POLL_INTERVAL_MS = 8000

export interface AppShellPresenterContext {
  camerasContainer: CamerasContainer
  hubContainer: HubContainer
}

export function buildAppShellPresenter({
  camerasContainer,
  hubContainer,
}: AppShellPresenterContext) {
  return {
    // Shared between screens, the camera list loads here: opening the list directly would show it empty.
    onMount() {
      reloadCameraList(camerasContainer)
    },

    /** Polls the system status so every screen reads it self-healing (ADR-33); returns the stop. */
    onWatchSystem() {
      const poll = () => void useRootStore.getState().loadSystemStats(hubContainer.getSystemStats)
      poll()
      const interval = setInterval(poll, POLL_INTERVAL_MS)
      return () => clearInterval(interval)
    },
  }
}
