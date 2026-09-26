import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { RecordingSettingsUpdate } from '../../domain/entities/recording_settings.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { refreshSurveillance } from '../surveillance/surveillance_refresh'
import type { ConservationAction } from './conservation.actions'

export interface ConservationPresenterContext {
  container: CamerasContainer
  hubContainer: HubContainer
  dispatch: (action: ConservationAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildConservationPresenter({
  container,
  hubContainer,
  dispatch,
  toast,
}: ConservationPresenterContext) {
  function load() {
    dispatch({ type: 'LOAD_STARTED' })
    container.getRecordingSettings
      .execute()
      .then((settings) => dispatch({ type: 'LOAD_SUCCEEDED', settings }))
      .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
  }

  return {
    onLoad: load,

    /** Resolves true once saved, so the view clears its draft. */
    async onSave(values: RecordingSettingsUpdate) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        await container.saveRecordingSettings.execute(values)
        toast('Durées de conservation enregistrées.', 'success')
        refreshSurveillance(hubContainer)
        load()
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
