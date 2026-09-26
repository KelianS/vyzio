import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { refreshSurveillance } from '../surveillance/surveillance_refresh'
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
        if (isLatest()) dispatch({ type: 'LOAD_SUCCEEDED', config, labels })
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
        await container.saveCameraDetectionConfig.execute(
          cameraId,
          detectionConfigUpdate(config, values),
        )
        toast('Réglages de détection enregistrés.', 'success')
        refreshSurveillance(hubContainer)
        load(cameraId)
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
