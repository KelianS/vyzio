import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import type { NotificationsAction } from './Notifications.Actions'
import type { ChannelId } from './Notifications.Uido'

export interface NotificationsPresenterContext {
  container: NotificationsContainer
  dispatch: (action: NotificationsAction) => void
}

export function buildNotificationsPresenter({
  container,
  dispatch,
}: NotificationsPresenterContext) {
  return {
    onMount() {
      container.getNotificationLabels
        .execute()
        .then((labels) => dispatch({ type: 'LABELS_LOADED', labels }))
        .catch(() => dispatch({ type: 'LABELS_LOADED', labels: [] }))
    },

    onSelectChannel(channel: ChannelId) {
      dispatch({ type: 'CHANNEL_SELECTED', channel })
    },

    onRefreshLog(channel: ChannelId) {
      container.getNotificationLog
        .execute(channel)
        .then((entries) => dispatch({ type: 'LOG_LOADED', entries }))
        .catch(() => dispatch({ type: 'LOG_LOADED', entries: [] }))
    },
  }
}

export type NotificationsPresenter = ReturnType<typeof buildNotificationsPresenter>
