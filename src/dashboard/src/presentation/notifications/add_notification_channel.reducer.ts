import type { AddNotificationChannelAction } from './add_notification_channel.actions'
import type { AddNotificationChannelUido } from './add_notification_channel.uido'

export function addNotificationChannelReducer(
  state: AddNotificationChannelUido,
  action: AddNotificationChannelAction,
): AddNotificationChannelUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, channels: action.channels, loading: false }
    case 'LOAD_FAILED':
      return { ...state, channels: [], loading: false, error: action.error }
  }
}
