import { toAppError } from '../../common/errors/to_app_error'
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
      dispatch({ type: 'LOAD_STARTED' })
      container.listNotificationChannels
        .execute()
        .then((channels) => dispatch({ type: 'LOAD_SUCCEEDED', channels }))
        .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
    },
  }
}
