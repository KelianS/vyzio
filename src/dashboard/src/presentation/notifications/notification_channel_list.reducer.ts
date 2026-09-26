import type { NotificationChannelListAction } from './notification_channel_list.actions'
import type { NotificationChannelListUido } from './notification_channel_list.uido'

export function notificationChannelListReducer(
  state: NotificationChannelListUido,
  action: NotificationChannelListAction,
): NotificationChannelListUido {
  switch (action.type) {
    case 'LOAD_SUCCEEDED':
      return { ...state, channels: action.channels, loading: false }
    case 'LOAD_FAILED':
      return { ...state, channels: [], loading: false }
  }
}
