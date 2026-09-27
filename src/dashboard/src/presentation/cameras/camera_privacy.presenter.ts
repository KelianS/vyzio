import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { PrivacyStrategy } from '../../domain/entities/camera.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { SchedulesContainer } from '../../infrastructure/providers/schedules.container'
import type { CameraPrivacyAction } from './camera_privacy.actions'
import { reloadCameraList } from './camera_list_reload'

export interface CameraPrivacyPresenterContext {
  container: CamerasContainer
  schedulesContainer: SchedulesContainer
  dispatch: (action: CameraPrivacyAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildCameraPrivacyPresenter({
  container,
  schedulesContainer,
  dispatch,
  toast,
}: CameraPrivacyPresenterContext) {
  // Moving to another camera keeps the tab mounted: only the latest read may answer.
  const nextPresetsRead = latestOnly()
  const nextRulesRead = latestOnly()

  function readPresets(cameraId: string, ptzSupported: boolean) {
    const isLatest = nextPresetsRead()
    if (!ptzSupported) {
      dispatch({ type: 'PRESETS_SKIPPED' })
      return
    }
    dispatch({ type: 'PRESETS_STARTED' })
    container.getPtzPresets
      .execute(cameraId)
      .then(({ presets }) => {
        if (isLatest()) dispatch({ type: 'PRESETS_LOADED', presets })
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'PRESETS_FAILED', error: toAppError(e) })
      })
  }

  function readRules() {
    const isLatest = nextRulesRead()
    dispatch({ type: 'RULES_STARTED' })
    schedulesContainer.listScheduleRules
      .execute()
      .then((rules) => {
        if (isLatest()) dispatch({ type: 'RULES_LOADED', rules })
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'RULES_FAILED', error: toAppError(e) })
      })
  }

  return {
    onLoad(cameraId: string, ptzSupported: boolean) {
      readPresets(cameraId, ptzSupported)
      readRules()
    },

    onRetryPresets: readPresets,

    onRetryRules: readRules,

    /** Resolves true once saved, so the view clears its draft. */
    async onSaveStrategy(cameraId: string, strategy: PrivacyStrategy) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        await container.setPrivacyStrategy.execute(cameraId, strategy)
        toast('Mode vie privée enregistré.', 'success')
        reloadCameraList(container)
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
