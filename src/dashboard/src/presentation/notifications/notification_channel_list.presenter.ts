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
      container.listNotificationChannels
        .execute()
        .then((channels) => dispatch({ type: 'LOAD_SUCCEEDED', channels }))
        // An unread list still reads as an empty one.
        .catch(() => dispatch({ type: 'LOAD_FAILED' }))
    },
  }
}
