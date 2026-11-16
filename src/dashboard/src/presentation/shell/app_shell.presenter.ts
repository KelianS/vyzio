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

    /** Polls the system status so every screen reads it self-healing (ADR-02); returns the stop. */
    onWatchSystem() {
      const poll = () => void useRootStore.getState().loadSystemStats(hubContainer.getSystemStats)
      poll()
      const interval = setInterval(poll, POLL_INTERVAL_MS)
      return () => clearInterval(interval)
    },

    /** Reads the camera list again in the background, so a camera's state follows without a reload; returns the stop. */
    onWatchCameras() {
      let reading = false
      const interval = setInterval(() => {
        // One read at a time: a slow answer or a load in progress is not doubled.
        if (reading || useRootStore.getState().camerasLoading) return
        reading = true
        void useRootStore
          .getState()
          .refreshCameras(camerasContainer.getCameras)
          .finally(() => {
            reading = false
          })
      }, POLL_INTERVAL_MS)
      return () => clearInterval(interval)
    },
  }
}
