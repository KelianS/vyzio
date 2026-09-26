import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import type { AddNotificationChannelAction } from './add_notification_channel.actions'

export interface AddNotificationChannelPresenterContext {
  container: NotificationsContainer
  dispatch: (action: AddNotificationChannelAction) => void
}

export function buildAddNotificationChannelPresenter({
  container,
  dispatch,
}: AddNotificationChannelPresenterContext) {
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
