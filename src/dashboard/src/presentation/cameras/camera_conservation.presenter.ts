import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type {
  DetectionConfig,
  DetectionConfigUpdate,
} from '../../domain/entities/detection_config.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { refreshSurveillance } from '../surveillance/surveillance_refresh'
import type { CameraConservationAction } from './camera_conservation.actions'
import { detectionConfigUpdate } from './detection_config_update'

export type RetentionOverrides = Pick<
  DetectionConfigUpdate,
  'continuousDaysOverride' | 'motionDaysOverride' | 'eventClipDaysOverride'
>

export interface CameraConservationPresenterContext {
  container: CamerasContainer
  hubContainer: HubContainer
  dispatch: (action: CameraConservationAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildCameraConservationPresenter({
  container,
  hubContainer,
  dispatch,
  toast,
}: CameraConservationPresenterContext) {
  // Moving to another camera keeps the tab mounted: only the latest read may answer.
  const nextLoad = latestOnly()

  function load(cameraId: string) {
    const isLatest = nextLoad()
    dispatch({ type: 'LOAD_STARTED' })
    container.getCameraDetectionConfig
      .execute(cameraId)
      .then((config) => {
        if (isLatest()) dispatch({ type: 'LOAD_SUCCEEDED', config })
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'LOAD_FAILED', error: toAppError(e) })
      })
  }

  return {
    onLoad: load,

    /** Resolves true once saved, so the view clears its draft. */
    async onSave(cameraId: string, config: DetectionConfig, values: RetentionOverrides) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        await container.saveCameraDetectionConfig.execute(
          cameraId,
          detectionConfigUpdate(config, values),
        )
        toast('Durées de conservation enregistrées.', 'success')
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
