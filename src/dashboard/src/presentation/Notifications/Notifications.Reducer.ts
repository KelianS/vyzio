import type { NotificationsAction } from './Notifications.Actions'
import type { NotificationsUido } from './Notifications.Uido'

export function notificationsReducer(
  state: NotificationsUido,
  action: NotificationsAction,
): NotificationsUido {
  switch (action.type) {
    case 'CHANNEL_SELECTED':
      return { ...state, selectedChannel: action.channel }
    case 'LOG_LOADED':
      return { ...state, notifLog: action.entries }
    case 'LABELS_LOADED':
      return { ...state, detectionLabels: action.labels }
  }
}
