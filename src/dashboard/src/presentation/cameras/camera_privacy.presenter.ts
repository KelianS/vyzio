import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { SCHEDULE_NO_DAY, toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { PrivacyStrategy } from '../../domain/entities/camera.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { CameraPrivacyAction } from './camera_privacy.actions'
import type { ScheduleForm } from './camera_privacy.uido'
import { reloadCameraList } from './camera_list_reload'

export interface CameraPrivacyPresenterContext {
  container: CamerasContainer
  dispatch: (action: CameraPrivacyAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildCameraPrivacyPresenter({
  container,
  dispatch,
  toast,
}: CameraPrivacyPresenterContext) {
  // Moving to another camera keeps the tab mounted: only the latest read may answer.
  const nextPresetsRead = latestOnly()
  const nextSchedulesRead = latestOnly()
  // The tab stays mounted across cameras: an add that answers after a switch must not land in the new list.
  let openCameraId: string | null = null

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

  // Switching cameras swaps the list in place rather than flashing "Chargement…" over it.
  function readSchedules(cameraId: string) {
    const isLatest = nextSchedulesRead()
    container.getCameraPrivacySchedules
      .execute(cameraId)
      .then((schedules) => {
        if (isLatest()) dispatch({ type: 'SCHEDULES_LOADED', schedules })
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'SCHEDULES_READ_FAILED', error: toAppError(e) })
      })
  }

  return {
    onLoad(cameraId: string, ptzSupported: boolean) {
      openCameraId = cameraId
      readPresets(cameraId, ptzSupported)
      readSchedules(cameraId)
    },

    onRetryPresets: readPresets,

    onRetrySchedules(cameraId: string) {
      dispatch({ type: 'SCHEDULES_RELOADING' })
      readSchedules(cameraId)
    },

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

    onOpenScheduleForm() {
      dispatch({ type: 'SCHEDULE_FORM_OPENED' })
    },
    onCloseScheduleForm() {
      dispatch({ type: 'SCHEDULE_FORM_CLOSED' })
    },

    onToggleDay(day: number) {
      dispatch({ type: 'DAY_TOGGLED', day })
    },
    onStartTimeChange(value: string) {
      dispatch({ type: 'START_TIME_SET', value })
    },
    onEndTimeChange(value: string) {
      dispatch({ type: 'END_TIME_SET', value })
    },

    /** Adds the range to each target camera; the open camera's list takes the range as created. */
    async onAddSchedule(targetIds: string[], form: ScheduleForm) {
      if (form.days.length === 0) {
        dispatch({ type: 'SCHEDULE_INVALID', message: SCHEDULE_NO_DAY })
        return
      }
      dispatch({ type: 'SCHEDULE_ADD_STARTED' })
      try {
        for (const targetId of targetIds) {
          const created = await container.createCameraPrivacySchedule.execute(targetId, {
            daysOfWeek: form.days,
            startTime: form.startTime,
            endTime: form.endTime,
          })
          // The add answers with the range: no second read that could fail under the shown list.
          if (targetId === openCameraId) dispatch({ type: 'SCHEDULE_ADDED', schedule: created })
        }
        dispatch({ type: 'SCHEDULE_FORM_CLOSED' })
      } catch (e) {
        dispatch({ type: 'SCHEDULE_FAILED', error: toAppError(e) })
      } finally {
        dispatch({ type: 'SCHEDULE_ADD_FINISHED' })
      }
    },

    async onDeleteSchedule(cameraId: string, scheduleId: string) {
      try {
        await container.deleteCameraPrivacySchedule.execute(cameraId, scheduleId)
        dispatch({ type: 'SCHEDULE_DELETED', scheduleId })
      } catch (e) {
        dispatch({ type: 'SCHEDULE_FAILED', error: toAppError(e) })
      }
    },
  }
}
