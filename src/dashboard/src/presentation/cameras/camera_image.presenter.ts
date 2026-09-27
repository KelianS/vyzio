import type { ToastTone } from '../../common/components/toast'
import { AppErrorKind, toastError, type AppError } from '../../common/errors/app_error'
import type { CameraCapabilityBinding } from '../../domain/entities/camera_capability_binding.entity'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { CameraImageSettings } from '../../domain/entities/camera_image_settings.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { CameraImageAction } from './camera_image.actions'
import { reportCameraGone } from './camera_list_reload'

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
  const nextPtzRead = latestOnly()

  // Read together: only the capabilities' 404 tells a camera removed elsewhere from a silent one.
  function readSettings(cameraId: string) {
    const isLatest = nextSettingsRead()
    dispatch({ type: 'SETTINGS_STARTED' })
    void Promise.allSettled([
      container.getCameraImageSettings.execute(cameraId),
      container.getCameraCapabilities.execute(cameraId),
    ]).then(([settings, bindings]) => {
      if (!isLatest()) return
      if (bindings.status === 'rejected' && isNotFound(bindings.reason))
        reportCameraGone(container, dispatch)
      else if (settings.status === 'rejected')
        dispatch({ type: 'SETTINGS_FAILED', error: imageSettingsError(settings.reason) })
      else {
        dispatch({ type: 'SETTINGS_LOADED', settings: settings.value })
        answerBindings(bindings)
      }
    })
  }

  function readBindings(cameraId: string) {
    // The settings' token: a camera switch must void a pending bindings retry too.
    const isLatest = nextSettingsRead()
    dispatch({ type: 'BINDINGS_STARTED' })
    container.getCameraCapabilities
      .execute(cameraId)
      .then((bindings) => {
        if (isLatest()) dispatch({ type: 'BINDINGS_LOADED', bindings })
      })
      .catch((e: unknown) => {
        if (!isLatest()) return
        if (isNotFound(e)) reportCameraGone(container, dispatch)
        else dispatch({ type: 'BINDINGS_FAILED', error: toAppError(e) })
      })
  }

  function answerBindings(bindings: PromiseSettledResult<CameraCapabilityBinding[]>) {
    if (bindings.status === 'fulfilled')
      dispatch({ type: 'BINDINGS_LOADED', bindings: bindings.value })
    else dispatch({ type: 'BINDINGS_FAILED', error: toAppError(bindings.reason) })
  }

  function isNotFound(reason: unknown) {
    return toAppError(reason).kind === AppErrorKind.NotFound
  }

  // The image settings' 404 also means the camera did not answer; only the capabilities' says it is gone.
  function imageSettingsError(reason: unknown): AppError {
    const error = toAppError(reason)
    return error.kind === AppErrorKind.NotFound
      ? { ...error, kind: AppErrorKind.CameraUnreachable }
      : error
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
      if (subjects.imageSettings) readSettings(cameraId)
      if (subjects.ptz) readPtz(cameraId)
    },

    onRetrySettings: readSettings,
    onRetryBindings: readBindings,
    onRetryPtz: readPtz,

    /** Resolves true once saved, so the view clears its draft. */
    async onSave(cameraId: string, settings: CameraImageSettings) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        // The save answers with what the camera kept: no second read that could fail under the shown settings.
        const saved = await container.setCameraImageSettings.execute(cameraId, settings)
        dispatch({ type: 'SETTINGS_SAVED', settings: saved })
        toast('Réglages d’image enregistrés.', 'success')
        return true
      } catch (e) {
        toastError(toast, imageSettingsError(e))
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
