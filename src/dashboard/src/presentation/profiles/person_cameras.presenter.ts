import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import { reloadCameraList } from '../cameras/camera_list_reload'
import type { PersonCamerasAction } from './person_cameras.actions'

export interface PersonCamerasPresenterContext {
  container: ProfilesContainer
  camerasContainer: CamerasContainer
  dispatch: (action: PersonCamerasAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildPersonCamerasPresenter({
  container,
  camerasContainer,
  dispatch,
  toast,
}: PersonCamerasPresenterContext) {
  // Moving to another person keeps the tab mounted: only the latest read may answer.
  const nextLoad = latestOnly()

  function load(personId: string) {
    const isLatest = nextLoad()
    dispatch({ type: 'LOAD_STARTED' })
    container.getProfileCameraLinks
      .execute(personId)
      .then((links) => {
        if (isLatest()) dispatch({ type: 'LOAD_SUCCEEDED', links })
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'LOAD_FAILED', error: toAppError(e) })
      })
  }

  return {
    onLoad: load,

    onReloadCameras: () => reloadCameraList(camerasContainer),

    /** Resolves true once saved, so the view clears its draft. */
    async onSave(personId: string, cameraIds: string[]) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        // The save answers the links it kept: no second read that could fail under the form.
        const links = await container.setProfileCameraLinks.execute(personId, cameraIds)
        dispatch({ type: 'SAVE_SUCCEEDED', links })
        toast('Caméras enregistrées.', 'success')
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'SAVE_FINISHED' })
      }
    },
  }
}
