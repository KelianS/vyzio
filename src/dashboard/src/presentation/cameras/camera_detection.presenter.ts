import type { ToastTone } from '../../common/components/toast'
import { AppErrorKind, toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { refreshSurveillance } from '../surveillance/surveillance_refresh'
import { reportCameraGone } from './camera_list_reload'
import type { CameraDetectionAction } from './camera_detection.actions'
import type { DetectionUpdate } from './camera_detection_settings'
import { detectionConfigUpdate } from './detection_config_update'

export interface CameraDetectionPresenterContext {
  container: CamerasContainer
  hubContainer: HubContainer
  dispatch: (action: CameraDetectionAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildCameraDetectionPresenter({
  container,
  hubContainer,
  dispatch,
  toast,
}: CameraDetectionPresenterContext) {
  // Moving to another camera keeps the tab mounted: only the latest read may answer.
  const nextLoad = latestOnly()
  let catalogue: Promise<DetectionLabel[]> | null = null

  // The catalogue does not depend on the camera: read once, and again only after a failure.
  function readCatalogue() {
    catalogue ??= container.getCameraLabels.execute().catch((e: unknown) => {
      catalogue = null
      throw e
    })
    return catalogue
  }

  function load(cameraId: string) {
    const isLatest = nextLoad()
    dispatch({ type: 'LOAD_STARTED' })
    Promise.all([container.getCameraDetectionConfig.execute(cameraId), readCatalogue()])
      .then(([config, labels]) => {
        if (!isLatest()) return
        if (config) dispatch({ type: 'LOAD_SUCCEEDED', config, labels })
        else reportCameraGone(container, dispatch)
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'LOAD_FAILED', error: toAppError(e) })
      })
  }

  return {
    onLoad: load,

    /** Resolves true once saved, so the view clears its draft. */
    async onSave(cameraId: string, config: DetectionConfig, values: DetectionUpdate) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        // The save answers with what was kept: no second read that could fail under the shown settings.
        const saved = await container.saveCameraDetectionConfig.execute(
          cameraId,
          detectionConfigUpdate(config, values),
        )
        dispatch({ type: 'SAVE_SUCCEEDED', config: saved })
        toast('Réglages de détection enregistrés.', 'success')
        refreshSurveillance(hubContainer)
        return true
      } catch (e) {
        const error = toAppError(e)
        if (error.kind === AppErrorKind.NotFound) reportCameraGone(container, dispatch)
        else toastError(toast, error)
        return false
      } finally {
        dispatch({ type: 'SAVE_FINISHED' })
      }
    },
  }
}
