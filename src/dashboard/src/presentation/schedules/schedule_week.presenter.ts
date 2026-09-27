import { toAppError } from '../../common/errors/to_app_error'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import type { SchedulesContainer } from '../../infrastructure/providers/schedules.container'
import { reloadCameraList } from '../cameras/camera_list_reload'
import type { ScheduleWeekAction } from './schedule_week.actions'

/** The "now" marker moves by the minute, the grain of a range. */
const CLOCK_INTERVAL_MS = 60_000

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

  function readClock() {
    container.getHouseClock
      .execute()
      .then((clock) => dispatch({ type: 'CLOCK_READ', clock }))
      .catch((e: unknown) => dispatch({ type: 'CLOCK_FAILED', error: toAppError(e) }))
  }

  return {
    onLoad: load,
    onReloadCameras: () => reloadCameraList(camerasContainer),

    /** Reads the house's clock now and every minute after; returns the stop. */
    onWatchClock() {
      readClock()
      const interval = setInterval(readClock, CLOCK_INTERVAL_MS)
      return () => clearInterval(interval)
    },
  }
}
