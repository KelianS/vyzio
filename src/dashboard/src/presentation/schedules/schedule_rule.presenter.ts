import type { ToastTone } from '../../common/components/toast'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { NewScheduleRule, ScheduleRuleInput } from '../../domain/entities/schedule_rule.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import type { SchedulesContainer } from '../../infrastructure/providers/schedules.container'
import { reloadCameraList } from '../cameras/camera_list_reload'
import type { ScheduleRuleAction } from './schedule_rule.actions'

export interface ScheduleRulePresenterContext {
  container: SchedulesContainer
  notificationsContainer: NotificationsContainer
  camerasContainer: CamerasContainer
  dispatch: (action: ScheduleRuleAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildScheduleRulePresenter({
  container,
  notificationsContainer,
  camerasContainer,
  dispatch,
  toast,
}: ScheduleRulePresenterContext) {
  // A rule deleted elsewhere answers "not found": the page says it is gone, not that it failed.
  function fail(error: AppError, failed: (error: AppError) => ScheduleRuleAction) {
    dispatch(error.kind === AppErrorKind.NotFound ? { type: 'RULE_GONE' } : failed(error))
  }

  return {
    /** Reads the rule to edit, if any, and the channels a notification range may target. */
    onLoad(ruleId: string | null) {
      dispatch({ type: 'LOAD_STARTED' })
      Promise.all([
        ruleId === null ? Promise.resolve(null) : container.getScheduleRule.execute(ruleId),
        notificationsContainer.listNotificationChannels.execute(),
      ])
        .then(([rule, channels]) => {
          if (ruleId !== null && rule === null) dispatch({ type: 'RULE_GONE' })
          else dispatch({ type: 'LOAD_SUCCEEDED', rule, channels })
        })
        .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
    },

    onReloadCameras: () => reloadCameraList(camerasContainer),

    /** Resolves true once added, so the view leaves for the week. */
    async onCreate(rule: NewScheduleRule) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        await container.createScheduleRule.execute(rule)
        dispatch({ type: 'ADDED' })
        toast('Plage ajoutée.', 'success')
        return true
      } catch (e) {
        dispatch({ type: 'SAVE_FAILED', error: toAppError(e) })
        return false
      }
    },

    /** Resolves true once saved, so the view clears its draft. */
    async onUpdate(ruleId: string, input: ScheduleRuleInput) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        const saved = await container.updateScheduleRule.execute(ruleId, input)
        dispatch({ type: 'SAVED', rule: saved })
        toast('Plage enregistrée.', 'success')
        return true
      } catch (e) {
        fail(toAppError(e), (error) => ({ type: 'SAVE_FAILED', error }))
        return false
      }
    },

    onAskDelete() {
      dispatch({ type: 'DELETE_ASKED' })
    },
    onCancelDelete() {
      dispatch({ type: 'DELETE_CANCELLED' })
    },

    /** Resolves true once deleted, so the view leaves for the week. */
    async onDelete(ruleId: string) {
      dispatch({ type: 'DELETE_STARTED' })
      try {
        await container.deleteScheduleRule.execute(ruleId)
        toast('Plage supprimée.', 'success')
        return true
      } catch (e) {
        fail(toAppError(e), (error) => ({ type: 'DELETE_FAILED', error }))
        return false
      }
    },
  }
}
