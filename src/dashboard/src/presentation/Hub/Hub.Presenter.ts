import { toAppError } from '../../common/errors/toAppError'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { HubAction } from './Hub.Actions'

export interface HubPresenterContext {
  container: HubContainer
  camerasContainer: CamerasContainer
  dispatch: (action: HubAction) => void
}

export function buildHubPresenter({ container, camerasContainer, dispatch }: HubPresenterContext) {
  function reloadCameras() {
    void useRootStore.getState().loadCameras(camerasContainer.getCameras)
  }

  return {
    onMount() {
      reloadCameras()
      dispatch({ type: 'LOAD_STARTED' })
      container.getHubOverview
        .execute()
        .then((data) => dispatch({ type: 'LOAD_SUCCEEDED', data }))
        .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
    },

    onBatchPendingSet(value: boolean | null) {
      dispatch({ type: 'BATCH_PENDING_SET', value })
    },

    async onTogglePrivacy(cameraId: string, active: boolean): Promise<void> {
      await camerasContainer.toggleCameraPrivacyMode.execute(cameraId, active)
      reloadCameras()
    },

    async onBatchTogglePrivacy(cameraIds: string[], active: boolean): Promise<void> {
      dispatch({ type: 'BATCH_TOGGLE_STARTED' })
      try {
        await camerasContainer.batchToggleCameraPrivacyMode.execute(cameraIds, active)
        reloadCameras()
        dispatch({ type: 'BATCH_TOGGLE_SUCCEEDED' })
      } catch {
        dispatch({ type: 'BATCH_TOGGLE_FAILED' })
      }
    },
  }
}

export type HubPresenter = ReturnType<typeof buildHubPresenter>
