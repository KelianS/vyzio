import { appErrorMessage } from '../../common/errors/AppError'
import { toAppError } from '../../common/errors/toAppError'
import type { ToastTone } from '../../common/components/Toast'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { HubAction } from './Hub.Actions'
import { privacyWording, type PrivacyRequest } from './privacyRequest'

export interface HubPresenterContext {
  container: HubContainer
  camerasContainer: CamerasContainer
  dispatch: (action: HubAction) => void
  toast: (message: string, tone?: ToastTone) => void
}

export function buildHubPresenter({
  container,
  camerasContainer,
  dispatch,
  toast,
}: HubPresenterContext) {
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

    onPrivacyPendingSet(request: PrivacyRequest | null) {
      dispatch({ type: 'PRIVACY_PENDING_SET', request })
    },

    // Une camera ou toutes : meme chemin, donc meme confirmation, meme attente, meme annonce.
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
        dispatch({ type: 'PRIVACY_TOGGLE_FAILED' })
        toast(appErrorMessage(toAppError(e)), 'error')
      }
    },
  }
}

export type HubPresenter = ReturnType<typeof buildHubPresenter>
