import { toAppError } from '../../common/errors/to_app_error'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import type { SchedulesContainer } from '../../infrastructure/providers/schedules.container'
import { reloadCameraList } from '../cameras/camera_list_reload'
import type { ScheduleWeekAction } from './schedule_week.actions'

export interface ScheduleWeekPresenterContext {
  container: SchedulesContainer
  notificationsContainer: NotificationsContainer
  camerasContainer: CamerasContainer
  dispatch: (action: ScheduleWeekAction) => void
}

export function buildScheduleWeekPresenter({
  container,
  notificationsContainer,
  camerasContainer,
  dispatch,
}: ScheduleWeekPresenterContext) {
  function load() {
    dispatch({ type: 'LOAD_STARTED' })
    Promise.all([
      container.listScheduleRules.execute(),
      notificationsContainer.listNotificationChannels.execute(),
    ])
      .then(([rules, channels]) => dispatch({ type: 'LOAD_SUCCEEDED', rules, channels }))
      .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
  }

  return {
    onLoad: load,
    onReloadCameras: () => reloadCameraList(camerasContainer),
  }
}
