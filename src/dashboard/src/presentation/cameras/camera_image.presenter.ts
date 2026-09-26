import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { CameraImageSettings } from '../../domain/entities/camera_image_settings.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { CameraImageAction } from './camera_image.actions'

export interface CameraImagePresenterContext {
  container: CamerasContainer
  dispatch: (action: CameraImageAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

/** What the open camera exposes on this tab. */
export interface CameraImageSubjects {
  imageSettings: boolean
  ptz: boolean
}

export function buildCameraImagePresenter({
  container,
  dispatch,
  toast,
}: CameraImagePresenterContext) {
  // Moving to another camera keeps the tab mounted: only the latest read may answer.
  const nextSettingsRead = latestOnly()
  const nextBindingsRead = latestOnly()
  const nextPtzRead = latestOnly()

  function readSettings(cameraId: string) {
    const isLatest = nextSettingsRead()
    dispatch({ type: 'SETTINGS_STARTED' })
    container.getCameraImageSettings
      .execute(cameraId)
      .then((settings) => {
        if (isLatest()) dispatch({ type: 'SETTINGS_LOADED', settings })
      })
      // Control does not depend on these settings: a failed read leaves it alone on screen.
      .catch(() => {
        if (isLatest()) dispatch({ type: 'SETTINGS_FAILED' })
      })
  }

  function readBindings(cameraId: string) {
    const isLatest = nextBindingsRead()
    container.getCameraCapabilities
      .execute(cameraId)
      .then((bindings) => {
        if (isLatest()) dispatch({ type: 'BINDINGS_LOADED', bindings })
      })
      // Unknown bindings keep every setting offered, as a camera with no DVRIP binding would.
      .catch(() => undefined)
  }

  // Switching cameras swaps the state after the answer, rather than flashing "Chargement…".
  function readPtz(cameraId: string) {
    const isLatest = nextPtzRead()
    container.getPtzPresets
      .execute(cameraId)
      .then(({ calibrated, currentPosition }) => {
        if (isLatest()) dispatch({ type: 'PTZ_LOADED', calibrated, currentPosition })
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'PTZ_FAILED', error: toAppError(e) })
      })
  }

  return {
    onLoad(cameraId: string, subjects: CameraImageSubjects) {
      if (subjects.imageSettings) {
        readSettings(cameraId)
        readBindings(cameraId)
      }
      if (subjects.ptz) readPtz(cameraId)
    },

    /** Resolves true once saved, so the view clears its draft. */
    async onSave(cameraId: string, settings: CameraImageSettings) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        await container.setCameraImageSettings.execute(cameraId, settings)
        toast('Réglages d’image enregistrés.', 'success')
        readSettings(cameraId)
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'SAVE_FINISHED' })
      }
    },

    onOpenLiveView() {
      dispatch({ type: 'LIVE_VIEW_OPENED' })
    },

    // The live view may have calibrated or moved the camera: read again when closing it.
    onCloseLiveView(cameraId: string) {
      dispatch({ type: 'LIVE_VIEW_CLOSED' })
      readPtz(cameraId)
    },
  }
}
