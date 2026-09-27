import { toAppError } from '../../common/errors/to_app_error'
import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import type { NotificationChannelListAction } from './notification_channel_list.actions'

export interface NotificationChannelListPresenterContext {
  container: NotificationsContainer
  dispatch: (action: NotificationChannelListAction) => void
}

export function buildNotificationChannelListPresenter({
  container,
  dispatch,
}: NotificationChannelListPresenterContext) {
  return {
    onLoad() {
      dispatch({ type: 'LOAD_STARTED' })
      container.listNotificationChannels
        .execute()
        .then((channels) => dispatch({ type: 'LOAD_SUCCEEDED', channels }))
        .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
    },
  }
}
